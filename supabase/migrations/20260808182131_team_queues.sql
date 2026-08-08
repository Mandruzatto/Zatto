-- Filas por equipe.
--
-- Hoje um chamado só pode ser atribuído a uma pessoa. Isso obriga a triagem a
-- escolher um nome antes de saber quem está livre, e quando esse alguém sai de
-- férias o chamado some do radar. Fila resolve os dois: o chamado cai no grupo
-- certo e alguém do grupo puxa.
--
-- Fila é rótulo de roteamento, não fronteira de permissão: analista continua
-- enxergando todos os chamados do cliente dele. Quem restringe é o tenant.
--
-- Os times nascem com nomes que refletem a divisão que o produto já usa (o enum
-- de área) mais uma linha de frente. São só um ponto de partida — nome,
-- descrição e composição são editáveis, que é o que o cliente vai querer fazer
-- na implantação.

create table public.teams (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null default public.current_tenant_id()
    references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  position integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nome único por cliente e sem depender de caixa: "Infra" e "infra" seriam duas
-- filas distintas na lista e ninguém saberia qual escolher.
create unique index teams_tenant_name_key on public.teams (tenant_id, lower(name));
create index teams_tenant_idx on public.teams (tenant_id);

create trigger trg_teams_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, profile_id)
);

create index team_members_profile_idx on public.team_members (profile_id);

alter table public.tickets
  add column team_id uuid references public.teams(id) on delete set null;

create index tickets_team_idx on public.tickets (team_id) where team_id is not null;

-- O tenant da fila sai por função definer: a policy de team_members precisa
-- saber a que cliente o time pertence sem depender da RLS de teams.
create or replace function public.team_tenant_id(p_team uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select tenant_id from public.teams where id = p_team
$$;

revoke all on function public.team_tenant_id(uuid) from public, anon;
grant execute on function public.team_tenant_id(uuid) to authenticated;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

-- Colaborador enxerga o nome da fila porque ele aparece no chamado dele.
create policy "Users view teams in own tenant"
  on public.teams for select to authenticated
  using (tenant_id = public.current_tenant_id());

create policy "Analysts manage teams in own tenant"
  on public.teams for all to authenticated
  using (public.is_analyst_of(tenant_id))
  with check (public.is_analyst_of(tenant_id));

create policy "Users view team members in own tenant"
  on public.team_members for select to authenticated
  using (public.team_tenant_id(team_id) = public.current_tenant_id());

create policy "Analysts manage team members in own tenant"
  on public.team_members for all to authenticated
  using (public.is_analyst_of(public.team_tenant_id(team_id)))
  with check (public.is_analyst_of(public.team_tenant_id(team_id)));

-- Cliente novo já nasce com as filas; sem isso a primeira automação de
-- roteamento não teria para onde apontar.
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

-- Clientes que já existem também ganham as filas padrão.
insert into public.teams (tenant_id, name, description, position)
select t.id, v.name, v.description, v.position
from public.tenants t
cross join (values
  ('Atendimento', 'Primeira linha: recebe, triagem e resolve o simples.', 10),
  ('Infraestrutura', 'Rede, servidores, equipamentos e acessos.', 20),
  ('Sistemas', 'Aplicações, integrações e dados.', 30)
) as v(name, description, position)
on conflict do nothing;
