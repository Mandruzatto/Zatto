-- Reposição: esta migration foi aplicada direto no banco e nunca chegou ao
-- repositório. Sem ela, um ambiente novo montado a partir daqui não teria os
-- índices por cliente nem o gatilho de seed — e o segundo cliente cadastrado
-- morreria em "nome já existe".
--
-- Conversão para multi-tenant deixou seis unicidades globais para trás. Duas
-- empresas não podem ser impedidas de ter, cada uma, uma agenda "Comercial
-- padrão" ou um patrimônio "NB-001". A unicidade é dentro do cliente.

alter table public.assets drop constraint if exists assets_asset_tag_key;
create unique index if not exists assets_tenant_tag_idx
  on public.assets (tenant_id, asset_tag);

alter table public.service_catalog_items drop constraint if exists service_catalog_items_slug_key;
create unique index if not exists service_catalog_items_tenant_slug_idx
  on public.service_catalog_items (tenant_id, slug);

alter table public.knowledge_articles drop constraint if exists knowledge_articles_slug_key;
create unique index if not exists knowledge_articles_tenant_slug_idx
  on public.knowledge_articles (tenant_id, slug);

alter table public.knowledge_categories drop constraint if exists knowledge_categories_name_key;
alter table public.knowledge_categories drop constraint if exists knowledge_categories_slug_key;
create unique index if not exists knowledge_categories_tenant_name_idx
  on public.knowledge_categories (tenant_id, name);
create unique index if not exists knowledge_categories_tenant_slug_idx
  on public.knowledge_categories (tenant_id, slug);

alter table public.sla_calendars drop constraint if exists sla_calendars_name_key;
create unique index if not exists sla_calendars_tenant_name_idx
  on public.sla_calendars (tenant_id, name);

-- Cliente novo nasce com calendário, SLAs e catálogo. O corpo de seed_tenant
-- vive nas migrations de catálogo e de automação; aqui só fica o gatilho.
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
