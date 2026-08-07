-- Catálogo por ecossistema.
--
-- Dos 26 itens originais, só um era de fato específico de ecossistema
-- (SharePoint). A divisão não é sobre separar o que existia — é sobre o que
-- adicionar: cliente Microsoft e cliente Google pedem coisas diferentes, e
-- nenhuma delas existia.
--
-- Três perfis no cadastro: mínimo (só incidente e solicitação, para quem quer
-- montar do zero), microsoft e google (base genérica mais o pacote do
-- ecossistema). O ecossistema fica guardado no cliente porque a mesma resposta
-- vale depois para o SSO: Entra ID de um lado, Workspace do outro.
--
-- Os itens viram dados numa tabela de modelos em vez de ficarem escritos dentro
-- da função: revisar o catálogo passa a ser editar linha, não abrir migration.

create type public.tenant_ecosystem as enum ('minimal', 'microsoft', 'google');

alter table public.tenants
  add column ecosystem public.tenant_ecosystem not null default 'minimal';

create table public.catalog_templates (
  id uuid primary key default uuid_generate_v4(),
  pack text not null check (pack in ('core', 'base', 'microsoft', 'google')),
  slug text not null,
  title text not null,
  description text not null,
  category text not null,
  default_priority public.ticket_priority not null default 'medium',
  default_type public.ticket_type not null default 'request',
  requires_approval boolean not null default false,
  keywords text[] not null default '{}',
  form_schema jsonb not null default '[]',
  area public.ticket_area,
  unique (pack, slug)
);

alter table public.catalog_templates enable row level security;

create policy "Authenticated read catalog templates"
  on public.catalog_templates for select to authenticated using (true);

-- Conteúdo dos pacotes: ver seed em supabase/seed/catalog_templates.sql,
-- aplicado junto desta migration no ambiente atual.

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

  -- 'core' vai sempre: é por onde o colaborador abre chamado quando nada encaixa.
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

revoke all on function public.seed_tenant(uuid, public.tenant_ecosystem) from public, anon, authenticated;

create or replace function public.seed_tenant_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_tenant(new.id, new.ecosystem);
  return new;
end;
$$;

revoke all on function public.seed_tenant_defaults() from public, anon, authenticated;

drop trigger if exists trg_seed_tenant_defaults on public.tenants;
create trigger trg_seed_tenant_defaults
  after insert on public.tenants
  for each row execute function public.seed_tenant_defaults();
