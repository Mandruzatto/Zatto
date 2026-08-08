-- Automações por tempo.
--
-- Fechar chamado parado e escalonar SLA são as duas automações que mais valem
-- num helpdesk, e são justamente as que não saem de trigger: dependem do tempo
-- passar, não de alguém agir. Precisam de alguém batendo na porta — pg_cron,
-- que já vem no Postgres do Supabase e não custa nada a mais.
--
-- O que o cliente define e o que vem pronto: o tempo vem preenchido com um
-- padrão razoável, o "para onde escalonar" nasce em branco, e as duas rotinas
-- nascem desligadas. Ligar é decisão de implantação, não default — fechar
-- chamado de gente é irreversível o suficiente para exigir um "sim".
--
-- Sobre e-mail: nenhum tipo novo. O fechamento automático usa a mesma
-- notificação de chamado finalizado que já existe, e a resolução explica que
-- foi por falta de resposta e que responder reabre. Um aviso "vou fechar em
-- dois dias" seria mais um e-mail para a caixa de todo mundo ignorar.

create extension if not exists pg_cron;

alter table public.tickets
  add column sla_escalated_at timestamptz;

create table public.tenant_automation_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,

  -- Fechamento por inatividade
  auto_close_enabled boolean not null default false,
  auto_close_days integer not null default 5 check (auto_close_days between 1 and 365),
  auto_close_statuses public.ticket_status[] not null default array['pending']::public.ticket_status[],
  auto_close_message text not null default
    'Encerrado automaticamente por falta de retorno. Se ainda precisar, é só responder que o chamado reabre.',

  -- Escalonamento de SLA
  sla_escalation_enabled boolean not null default false,
  sla_escalation_at_percent integer not null default 80
    check (sla_escalation_at_percent between 10 and 100),
  sla_escalation_team_id uuid references public.teams(id) on delete set null,
  sla_escalation_assignee_id uuid references public.profiles(id) on delete set null,
  sla_escalation_bump_priority boolean not null default true,

  updated_at timestamptz not null default now()
);

create trigger trg_tenant_automation_settings_updated_at
  before update on public.tenant_automation_settings
  for each row execute function public.set_updated_at();

alter table public.tenant_automation_settings enable row level security;

create policy "Analysts manage automation settings in own tenant"
  on public.tenant_automation_settings for all to authenticated
  using (public.is_analyst_of(tenant_id))
  with check (public.is_analyst_of(tenant_id));

-- Mesma guarda de tenant das regras: destino de escalonamento tem que ser do
-- próprio cliente.
create or replace function public.validate_automation_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sla_escalation_team_id is not null and not exists (
    select 1 from public.teams t
    where t.id = new.sla_escalation_team_id and t.tenant_id = new.tenant_id
  ) then
    raise exception 'A fila de escalonamento não pertence a este cliente';
  end if;

  if new.sla_escalation_assignee_id is not null and not exists (
    select 1 from public.profiles p
    where p.id = new.sla_escalation_assignee_id
      and p.tenant_id = new.tenant_id
      and p.role = 'analyst'
  ) then
    raise exception 'O responsável pelo escalonamento não é analista deste cliente';
  end if;

  return new;
end;
$$;

create trigger trg_validate_automation_settings
  before insert or update on public.tenant_automation_settings
  for each row execute function public.validate_automation_settings();

-- Mudança de fila também é histórico: o analista precisa saber quem tirou o
-- chamado da fila dele.
create or replace function public.log_ticket_field_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_de text;
  v_para text;
begin
  if new.priority is distinct from old.priority then
    insert into public.ticket_events (ticket_id, actor_id, event_type, metadata)
    values (new.id, auth.uid(), 'priority_change',
            jsonb_build_object('de', old.priority::text, 'para', new.priority::text));
  end if;

  if new.type is distinct from old.type then
    insert into public.ticket_events (ticket_id, actor_id, event_type, metadata)
    values (new.id, auth.uid(), 'type_change',
            jsonb_build_object('de', old.type::text, 'para', new.type::text));
  end if;

  if new.area is distinct from old.area then
    insert into public.ticket_events (ticket_id, actor_id, event_type, metadata)
    values (new.id, auth.uid(), 'area_change',
            jsonb_build_object('de', old.area::text, 'para', new.area::text));
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    select full_name into v_de from public.profiles where id = old.assignee_id;
    select full_name into v_para from public.profiles where id = new.assignee_id;
    insert into public.ticket_events (ticket_id, actor_id, event_type, metadata)
    values (new.id, auth.uid(), 'assignee_change',
            jsonb_build_object('de', v_de, 'para', v_para));
  end if;

  if new.team_id is distinct from old.team_id then
    select name into v_de from public.teams where id = old.team_id;
    select name into v_para from public.teams where id = new.team_id;
    insert into public.ticket_events (ticket_id, actor_id, event_type, metadata)
    values (new.id, auth.uid(), 'team_change',
            jsonb_build_object('de', v_de, 'para', v_para));
  end if;

  return new;
end;
$$;

drop trigger trg_log_ticket_field_changes on public.tickets;
create trigger trg_log_ticket_field_changes
  after update of priority, type, area, assignee_id, team_id on public.tickets
  for each row execute function public.log_ticket_field_changes();

-- p_tenant nulo = todos os clientes (é como o cron chama).
create or replace function public.run_time_automations(p_tenant uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  v_touched integer := 0;
  v_rows integer;
begin
  for s in
    select st.*
    from public.tenant_automation_settings st
    join public.tenants t on t.id = st.tenant_id
    where t.is_active
      and (p_tenant is null or st.tenant_id = p_tenant)
  loop
    if s.auto_close_enabled then
      with fechados as (
        update public.tickets t
          set status = 'finalized',
              resolved_at = now(),
              resolution = coalesce(nullif(btrim(t.resolution), ''), s.auto_close_message)
        where t.tenant_id = s.tenant_id
          and t.status = any (s.auto_close_statuses)
          and t.updated_at < now() - make_interval(days => s.auto_close_days)
        returning t.id
      )
      insert into public.ticket_events (ticket_id, actor_id, event_type, metadata)
      select f.id, null, 'automation',
             jsonb_build_object('regra',
               'Fechamento automático após ' || s.auto_close_days || ' dias sem retorno')
      from fechados f;

      get diagnostics v_rows = row_count;
      v_touched := v_touched + v_rows;
    end if;

    if s.sla_escalation_enabled then
      with escalados as (
        update public.tickets t
          set sla_escalated_at = now(),
              team_id = coalesce(s.sla_escalation_team_id, t.team_id),
              assignee_id = coalesce(s.sla_escalation_assignee_id, t.assignee_id),
              priority = case
                when not s.sla_escalation_bump_priority then t.priority
                when t.priority = 'low' then 'medium'::public.ticket_priority
                when t.priority = 'medium' then 'high'::public.ticket_priority
                else 'critical'::public.ticket_priority
              end
        where t.tenant_id = s.tenant_id
          and t.sla_escalated_at is null
          and t.resolution_due_at is not null
          -- Pausado é pausado: não escalona quem está esperando o usuário ou
          -- uma aprovação, senão o relógio pune o time pela espera dos outros.
          and t.status not in ('finalized', 'pending', 'awaiting_approval')
          and now() >= t.created_at
                     + (t.resolution_due_at - t.created_at)
                       * (s.sla_escalation_at_percent / 100.0)
        returning t.id
      )
      insert into public.ticket_events (ticket_id, actor_id, event_type, metadata)
      select e.id, null, 'sla_escalation',
             jsonb_build_object('percentual', s.sla_escalation_at_percent)
      from escalados e;

      get diagnostics v_rows = row_count;
      v_touched := v_touched + v_rows;
    end if;
  end loop;

  return v_touched;
end;
$$;

revoke all on function public.run_time_automations(uuid) from public, anon, authenticated;

-- Botão "rodar agora" na tela: sem isso ninguém consegue conferir uma
-- automação que só se manifesta daqui a cinco dias.
create or replace function public.run_my_time_automations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := public.current_tenant_id();
begin
  if v_tenant is null or not public.is_analyst_of(v_tenant) then
    raise exception 'Apenas analistas do cliente podem rodar as automações';
  end if;
  return public.run_time_automations(v_tenant);
end;
$$;

revoke all on function public.run_my_time_automations() from public, anon;
grant execute on function public.run_my_time_automations() to authenticated;

-- Cliente novo já nasce com a linha de configuração (desligada).
create or replace function public.seed_tenant(
  p_tenant uuid,
  p_ecosystem public.tenant_ecosystem default 'minimal'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_calendar uuid;
begin
  select id into v_calendar from public.sla_calendars where tenant_id = p_tenant limit 1;

  if v_calendar is null then
    insert into public.sla_calendars (tenant_id, name, timezone, weekly_schedule, is_default)
    values (
      p_tenant, 'Comercial padrão', 'America/Sao_Paulo',
      '{"1":[["09:00","18:00"]],"2":[["09:00","18:00"]],"3":[["09:00","18:00"]],"4":[["09:00","18:00"]],"5":[["09:00","18:00"]]}'::jsonb,
      true
    )
    returning id into v_calendar;
  end if;

  if not exists (select 1 from public.sla_policies where tenant_id = p_tenant) then
    insert into public.sla_policies
      (tenant_id, calendar_id, name, priority, first_response_minutes, resolution_minutes,
       warning_percent, pause_statuses, precedence, is_active)
    values
      (p_tenant, v_calendar, 'Crítica', 'critical', 30, 240, 80,
       array['pending','awaiting_approval']::public.ticket_status[], 10, true),
      (p_tenant, v_calendar, 'Alta', 'high', 60, 480, 80,
       array['pending','awaiting_approval']::public.ticket_status[], 20, true),
      (p_tenant, v_calendar, 'Média', 'medium', 240, 1440, 80,
       array['pending','awaiting_approval']::public.ticket_status[], 30, true),
      (p_tenant, v_calendar, 'Baixa', 'low', 480, 2880, 80,
       array['pending','awaiting_approval']::public.ticket_status[], 40, true);
  end if;

  insert into public.teams (tenant_id, name, description, position)
  values
    (p_tenant, 'Atendimento', 'Primeira linha: recebe, triagem e resolve o simples.', 10),
    (p_tenant, 'Infraestrutura', 'Rede, servidores, equipamentos e acessos.', 20),
    (p_tenant, 'Sistemas', 'Aplicações, integrações e dados.', 30)
  on conflict do nothing;

  insert into public.tenant_automation_settings (tenant_id)
  values (p_tenant)
  on conflict (tenant_id) do nothing;

  insert into public.service_catalog_items
    (tenant_id, slug, title, description, category, default_priority, default_type,
     requires_approval, keywords, form_schema, area, is_published)
  select p_tenant, t.slug, t.title, t.description, t.category, t.default_priority,
         t.default_type, t.requires_approval, t.keywords, t.form_schema, t.area, true
  from public.catalog_templates t
  where t.pack = 'core'
     or (p_ecosystem <> 'minimal' and t.pack = 'base')
     or t.pack = p_ecosystem::text
  on conflict (tenant_id, slug) do nothing;
end;
$$;

insert into public.tenant_automation_settings (tenant_id)
select id from public.tenants
on conflict (tenant_id) do nothing;

-- De quinze em quinze minutos: granularidade suficiente para prazos medidos em
-- horas e barata o bastante para não pesar.
select cron.schedule(
  'zatto-time-automations',
  '*/15 * * * *',
  $cron$select public.run_time_automations()$cron$
);
