-- Motor de regras: quando acontece X, se as condições baterem, faça Y.
--
-- A regra fica em dados (jsonb), não em código: criar automação é inserir
-- linha, não abrir migration. O interpretador vive no banco de propósito — o
-- app escreve em tickets direto pelo supabase-js em vários pontos, e motor no
-- servidor Next seria contornado por qualquer um desses caminhos. No banco,
-- toda escrita passa pela regra, inclusive a que vier do e-mail de entrada.
--
-- Ações rodam em trigger BEFORE, alterando NEW no lugar de emitir um segundo
-- UPDATE. Isso elimina recursão por construção e garante que a política de SLA
-- (selecionada em BEFORE INSERT, depois desta) já veja a prioridade final.
--
-- Limite conhecido e aceito: uma regra de "chamado atualizado" reaplica sua
-- ação toda vez que as condições baterem. Se o analista baixar a prioridade de
-- um chamado que a regra eleva, a regra eleva de novo. É o comportamento dos
-- ITSMs de mercado; quem quiser evitar restringe a regra por condição.

create type public.automation_trigger as enum (
  'ticket_created',
  'ticket_updated',
  'comment_added'
);

create table public.automation_rules (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null default public.current_tenant_id()
    references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  trigger_on public.automation_trigger not null,
  match_mode text not null default 'all' check (match_mode in ('all', 'any')),
  conditions jsonb not null default '[]',
  actions jsonb not null default '[]',
  is_active boolean not null default true,
  position integer not null default 100,
  run_count integer not null default 0,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(conditions) = 'array'),
  check (jsonb_typeof(actions) = 'array')
);

create index automation_rules_lookup_idx
  on public.automation_rules (tenant_id, trigger_on, position)
  where is_active;

create trigger trg_automation_rules_updated_at
  before update on public.automation_rules
  for each row execute function public.set_updated_at();

-- Validação na escrita, não na execução: regra com campo escrito errado nunca
-- casaria e o cliente ficaria procurando por que a automação "não roda".
create or replace function public.validate_automation_rule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c jsonb;
  a jsonb;
  v_op text;
  v_type text;
  v_team uuid;
  v_assignee uuid;
begin
  for c in select value from jsonb_array_elements(new.conditions) loop
    if (c->>'field') is null or (c->>'field') not in (
      'type', 'priority', 'area', 'status', 'team_id', 'assignee_id',
      'requester_id', 'catalog_item_id', 'title', 'description', 'text',
      'comment_author_role'
    ) then
      raise exception 'Condição com campo inválido: %', coalesce(c->>'field', '(vazio)');
    end if;

    v_op := c->>'op';
    if v_op not in ('eq', 'neq', 'in', 'contains', 'not_contains', 'is_empty', 'is_not_empty') then
      raise exception 'Condição com operador inválido: %', coalesce(v_op, '(vazio)');
    end if;

    if v_op not in ('is_empty', 'is_not_empty') and (c->'value') is null then
      raise exception 'Condição "%" exige um valor', v_op;
    end if;

    if v_op = 'in' and jsonb_typeof(c->'value') <> 'array' then
      raise exception 'O operador "in" exige uma lista de valores';
    end if;
  end loop;

  if jsonb_array_length(new.actions) = 0 then
    raise exception 'A regra precisa de pelo menos uma ação';
  end if;

  for a in select value from jsonb_array_elements(new.actions) loop
    v_type := a->>'type';
    if v_type not in (
      'set_team', 'set_assignee', 'set_priority', 'set_area', 'set_status', 'set_type'
    ) then
      raise exception 'Ação inválida: %', coalesce(v_type, '(vazio)');
    end if;

    -- Prioridade, status e tipo não têm "vazio": a coluna é not null.
    if v_type in ('set_priority', 'set_status', 'set_type')
       and nullif(a->>'value', '') is null then
      raise exception 'A ação "%" exige um valor', v_type;
    end if;

    -- Apontar para fila ou pessoa de outro cliente seria vazamento entre
    -- tenants, e a FK de tickets sozinha não impede.
    if v_type = 'set_team' then
      v_team := nullif(a->>'value', '')::uuid;
      if v_team is not null and not exists (
        select 1 from public.teams t where t.id = v_team and t.tenant_id = new.tenant_id
      ) then
        raise exception 'A fila escolhida não pertence a este cliente';
      end if;
    end if;

    if v_type = 'set_assignee' then
      v_assignee := nullif(a->>'value', '')::uuid;
      if v_assignee is not null and not exists (
        select 1 from public.profiles p
        where p.id = v_assignee and p.tenant_id = new.tenant_id and p.role = 'analyst'
      ) then
        raise exception 'O responsável escolhido não é analista deste cliente';
      end if;
    end if;
  end loop;

  return new;
end;
$$;

create trigger trg_validate_automation_rule
  before insert or update on public.automation_rules
  for each row execute function public.validate_automation_rule();

alter table public.automation_rules enable row level security;

create policy "Analysts manage automation rules in own tenant"
  on public.automation_rules for all to authenticated
  using (public.is_analyst_of(tenant_id))
  with check (public.is_analyst_of(tenant_id));

-- "text" procura em título e descrição de uma vez: é como a pessoa pensa a
-- regra ("se falar em impressora"), sem obrigar duas condições.
create or replace function public.automation_field_value(p_ticket jsonb, p_field text)
returns text
language sql
immutable
as $$
  select case p_field
    when 'text' then
      coalesce(p_ticket->>'title', '') || ' ' || coalesce(p_ticket->>'description', '')
    else p_ticket->>p_field
  end
$$;

create or replace function public.automation_condition_holds(p_ticket jsonb, p_cond jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  v_value text := public.automation_field_value(p_ticket, p_cond->>'field');
  v_op text := p_cond->>'op';
  v_arg jsonb := p_cond->'value';
begin
  if v_op = 'is_empty' then
    return v_value is null or btrim(v_value) = '';
  end if;
  if v_op = 'is_not_empty' then
    return v_value is not null and btrim(v_value) <> '';
  end if;

  -- Campo vazio só satisfaz as condições negativas.
  if v_value is null then
    return v_op in ('neq', 'not_contains');
  end if;

  case v_op
    when 'eq' then
      return v_value = (v_arg #>> '{}');
    when 'neq' then
      return v_value <> (v_arg #>> '{}');
    when 'in' then
      return exists (select 1 from jsonb_array_elements_text(v_arg) e where e = v_value);
    when 'contains' then
      return position(lower(v_arg #>> '{}') in lower(v_value)) > 0;
    when 'not_contains' then
      return position(lower(v_arg #>> '{}') in lower(v_value)) = 0;
    else
      return false;
  end case;
end;
$$;

create or replace function public.automation_matches(
  p_ticket jsonb,
  p_conditions jsonb,
  p_match text
)
returns boolean
language plpgsql
immutable
as $$
declare
  c jsonb;
begin
  -- Regra sem condição vale para tudo. É explícito na tela.
  if p_conditions is null or jsonb_array_length(p_conditions) = 0 then
    return true;
  end if;

  for c in select value from jsonb_array_elements(p_conditions) loop
    if public.automation_condition_holds(p_ticket, c) then
      if p_match = 'any' then return true; end if;
    else
      if p_match <> 'any' then return false; end if;
    end if;
  end loop;

  return p_match <> 'any';
end;
$$;

-- Recebe o chamado como jsonb e devolve como ficou, mais o nome das regras que
-- rodaram. Todas as regras que casam são aplicadas, em ordem: a seguinte já vê
-- o que a anterior mudou.
create or replace function public.automation_apply(
  p_ticket jsonb,
  p_tenant uuid,
  p_trigger public.automation_trigger,
  out o_ticket jsonb,
  out o_fired text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  a jsonb;
  v_column text;
begin
  o_ticket := p_ticket;
  o_fired := '{}';

  for r in
    select ar.id, ar.name, ar.conditions, ar.actions, ar.match_mode
    from public.automation_rules ar
    where ar.tenant_id = p_tenant
      and ar.is_active
      and ar.trigger_on = p_trigger
    order by ar.position, ar.created_at
  loop
    continue when not public.automation_matches(o_ticket, r.conditions, r.match_mode);

    for a in select value from jsonb_array_elements(r.actions) loop
      v_column := case a->>'type'
        when 'set_team' then 'team_id'
        when 'set_assignee' then 'assignee_id'
        when 'set_priority' then 'priority'
        when 'set_area' then 'area'
        when 'set_status' then 'status'
        when 'set_type' then 'type'
      end;
      continue when v_column is null;

      o_ticket := jsonb_set(o_ticket, array[v_column], coalesce(a->'value', 'null'::jsonb), true);
    end loop;

    o_fired := o_fired || r.name;

    update public.automation_rules
      set run_count = run_count + 1, last_run_at = now()
      where id = r.id;
  end loop;
end;
$$;

revoke all on function public.automation_apply(jsonb, uuid, public.automation_trigger)
  from public, anon, authenticated;

-- O histórico do chamado precisa que o chamado exista, e na criação ele ainda
-- não existe quando a ação roda. As regras que dispararam ficam guardadas por
-- id de chamado numa variável de transação e o gatilho AFTER as grava.
create or replace function public.automation_remember_fired(p_ticket uuid, p_fired text[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_all jsonb := coalesce(
    nullif(current_setting('zatto.automation_fired', true), '')::jsonb,
    '{}'::jsonb
  );
begin
  perform set_config(
    'zatto.automation_fired',
    (jsonb_set(
      v_all,
      array[p_ticket::text],
      coalesce(v_all -> p_ticket::text, '[]'::jsonb) || to_jsonb(p_fired),
      true
    ))::text,
    true
  );
end;
$$;

create or replace function public.apply_automation_to_ticket()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trigger public.automation_trigger;
  v_result record;
begin
  if tg_op = 'INSERT' then
    v_trigger := 'ticket_created';
  else
    -- Comentário e SLA tocam updated_at o tempo todo. Sem este filtro, uma
    -- regra de "chamado atualizado" rodaria a cada mensagem trocada.
    if new.status is not distinct from old.status
       and new.priority is not distinct from old.priority
       and new.type is not distinct from old.type
       and new.area is not distinct from old.area
       and new.assignee_id is not distinct from old.assignee_id
       and new.team_id is not distinct from old.team_id
       and new.catalog_item_id is not distinct from old.catalog_item_id
       and new.title is not distinct from old.title
       and new.description is not distinct from old.description then
      return new;
    end if;
    v_trigger := 'ticket_updated';
  end if;

  select * into v_result
  from public.automation_apply(to_jsonb(new), new.tenant_id, v_trigger);

  if array_length(v_result.o_fired, 1) is null then
    return new;
  end if;

  -- Reconstrói a partir do tipo da tabela: NEW é `record` em plpgsql e não
  -- resolve o tipo polimórfico de jsonb_populate_record.
  new := jsonb_populate_record(null::public.tickets, v_result.o_ticket);
  perform public.automation_remember_fired(new.id, v_result.o_fired);

  return new;
end;
$$;

create or replace function public.log_automation_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_all jsonb := coalesce(
    nullif(current_setting('zatto.automation_fired', true), '')::jsonb,
    '{}'::jsonb
  );
  v_names jsonb := v_all -> new.id::text;
  v_name text;
begin
  if v_names is null then return new; end if;

  for v_name in select value from jsonb_array_elements_text(v_names) loop
    insert into public.ticket_events (ticket_id, actor_id, event_type, metadata)
    values (new.id, null, 'automation', jsonb_build_object('regra', v_name));
  end loop;

  perform set_config('zatto.automation_fired', (v_all - new.id::text)::text, true);
  return new;
end;
$$;

-- O nome importa: gatilhos de mesmo tempo disparam em ordem alfabética, e
-- "automation" tem que vir antes de "select_ticket_sla_policy" para que o SLA
-- seja calculado sobre a prioridade que a regra definiu.
create trigger trg_automation_apply
  before insert or update on public.tickets
  for each row execute function public.apply_automation_to_ticket();

create trigger trg_automation_log
  after insert or update on public.tickets
  for each row execute function public.log_automation_run();

create or replace function public.apply_automation_to_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.tickets%rowtype;
  v_payload jsonb;
  v_result record;
begin
  -- Nota interna é conversa entre analistas; não move o chamado.
  if new.is_internal then return new; end if;

  select * into v_ticket from public.tickets where id = new.ticket_id;
  if v_ticket.id is null then return new; end if;

  v_payload := to_jsonb(v_ticket) || jsonb_build_object(
    'comment_author_role',
    case when new.author_id is not distinct from v_ticket.requester_id
      then 'requester' else 'agent' end
  );

  select * into v_result
  from public.automation_apply(v_payload, v_ticket.tenant_id, 'comment_added');

  if array_length(v_result.o_fired, 1) is null then
    return new;
  end if;

  perform public.automation_remember_fired(v_ticket.id, v_result.o_fired);

  update public.tickets set
    status      = (v_result.o_ticket->>'status')::public.ticket_status,
    priority    = (v_result.o_ticket->>'priority')::public.ticket_priority,
    type        = (v_result.o_ticket->>'type')::public.ticket_type,
    area        = nullif(v_result.o_ticket->>'area', '')::public.ticket_area,
    team_id     = nullif(v_result.o_ticket->>'team_id', '')::uuid,
    assignee_id = nullif(v_result.o_ticket->>'assignee_id', '')::uuid
  where id = v_ticket.id;

  return new;
end;
$$;

create trigger trg_apply_automation_to_comment
  after insert on public.ticket_comments
  for each row execute function public.apply_automation_to_comment();
