-- Catalog items carry their own ticket type and a grouping category so the
-- portal can organise them instead of guessing the type from the slug.

alter table public.service_catalog_items
  add column if not exists default_type ticket_type not null default 'request',
  add column if not exists category text not null default 'Outros';

update public.service_catalog_items
set default_type = 'incident'
where slug like '%incidente%';

update public.service_catalog_items
set category = 'Outros'
where category is null or category = '';

create index if not exists service_catalog_items_category_idx
  on public.service_catalog_items (category);
