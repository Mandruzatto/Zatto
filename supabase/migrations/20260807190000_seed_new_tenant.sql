-- Duas correções que andam juntas.
--
-- 1. Restrições de unicidade que ficaram globais quando o sistema virou
--    multi-cliente. Na prática, um cliente cadastrando o patrimônio "NB-001",
--    a categoria "Acessos" ou o calendário "Comercial padrão" impediria todos os
--    outros de usar o mesmo nome. Passam a ser únicas por cliente.
--
-- 2. Cliente novo nascia vazio: sem catálogo, sem SLA e sem calendário. O
--    ambiente chegava quebrado — o portal não oferecia nada para abrir chamado e
--    o chamado criado ficava sem prazo, inclusive os críticos.
--
-- A semeadura é gatilho para valer independente de como o cliente for criado,
-- e a lógica fica numa função comum para servir também a quem já existe.
--
-- O catálogo padrão é enxuto de propósito: só incidente e solicitação. Encher de
-- item que não corresponde à realidade do cliente é pior que começar simples.

alter table public.assets drop constraint assets_asset_tag_key;
create unique index assets_tenant_tag_idx on public.assets (tenant_id, asset_tag);

alter table public.service_catalog_items drop constraint service_catalog_items_slug_key;
create unique index service_catalog_items_tenant_slug_idx
  on public.service_catalog_items (tenant_id, slug);

alter table public.knowledge_articles drop constraint knowledge_articles_slug_key;
create unique index knowledge_articles_tenant_slug_idx
  on public.knowledge_articles (tenant_id, slug);

alter table public.knowledge_categories drop constraint knowledge_categories_name_key;
alter table public.knowledge_categories drop constraint knowledge_categories_slug_key;
create unique index knowledge_categories_tenant_name_idx
  on public.knowledge_categories (tenant_id, name);
create unique index knowledge_categories_tenant_slug_idx
  on public.knowledge_categories (tenant_id, slug);

alter table public.sla_calendars drop constraint sla_calendars_name_key;
create unique index sla_calendars_tenant_name_idx on public.sla_calendars (tenant_id, name);

create or replace function public.seed_tenant(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_calendar uuid;
begin
  select id into v_calendar
  from public.sla_calendars where tenant_id = p_tenant limit 1;

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

  if not exists (select 1 from public.service_catalog_items where tenant_id = p_tenant) then
    insert into public.service_catalog_items
      (tenant_id, slug, title, description, category, default_priority, default_type,
       requires_approval, keywords, form_schema, area, is_published)
    values
      (p_tenant, 'incidente-padrao', 'Incidente padrão',
       'Reporte um problema ou falha que está atrapalhando o seu trabalho.',
       'Outros', 'high', 'incident', false,
       array['incidente','problema','erro','falha','padrão'],
       '[{"key":"subject","type":"text","label":"O que está acontecendo?","required":true,"placeholder":"Ex: não consigo acessar o e-mail"},
         {"key":"impact","type":"select","label":"Impacto","options":["Baixo","Médio","Alto","Crítico"],"required":true},
         {"key":"details","type":"textarea","label":"Detalhes","required":true,"placeholder":"Quando começou, mensagem de erro, o que já tentou"}]'::jsonb,
       'infrastructure', true),
      (p_tenant, 'solicitacao-padrao', 'Solicitação padrão',
       'Abra uma solicitação de serviço para a equipe de TI.',
       'Outros', 'medium', 'request', false,
       array['solicitação','pedido','serviço','ajuda','padrão'],
       '[{"key":"subject","type":"text","label":"Assunto","required":true,"placeholder":"Resumo da solicitação"},
         {"key":"details","type":"textarea","label":"Detalhes","required":true,"placeholder":"Explique o que precisa e o contexto"}]'::jsonb,
       'systems', true);
  end if;
end;
$$;

revoke all on function public.seed_tenant(uuid) from public, anon, authenticated;

create or replace function public.seed_tenant_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_tenant(new.id);
  return new;
end;
$$;

revoke all on function public.seed_tenant_defaults() from public, anon, authenticated;

drop trigger if exists trg_seed_tenant_defaults on public.tenants;
create trigger trg_seed_tenant_defaults
  after insert on public.tenants
  for each row execute function public.seed_tenant_defaults();

-- Corrige quem nasceu antes desta migration.
do $$
declare r record;
begin
  for r in select id from public.tenants loop
    perform public.seed_tenant(r.id);
  end loop;
end $$;
