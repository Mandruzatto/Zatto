-- Fundação multi-cliente (etapa 1 de 2): estrutura, sem mudar comportamento.
--
-- Esta migration só cria o conceito de cliente e carimba as tabelas raiz. O
-- isolamento de fato (reescrita das políticas de acesso) vem na etapa 2 — hoje
-- 30 das 45 políticas liberam acesso por "é analista", sem olhar de qual
-- cliente, o que vazaria dados entre empresas.
--
-- Tabelas raiz recebem tenant_id. As demais herdam pelo pai: comentário herda do
-- chamado, atribuição herda do ativo, feriado herda do calendário, e assim por
-- diante.
--
-- A ordem aqui importa: current_tenant_id() lê profiles.tenant_id, então a
-- coluna precisa existir antes da função.

create table public.tenants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  -- vira o subdomínio no futuro: <slug>.zatto.com
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_tenants_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

insert into public.tenants (name, slug) values ('zaTTo', 'zatto');

-- Usado onde não existe sessão (cadastro de usuário nasce em trigger no signup).
-- Com um único cliente, cai nele. Com mais de um, devolve null de propósito:
-- o NOT NULL barra o cadastro em vez de colocar a pessoa na empresa errada.
create or replace function public.default_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select count(*) from public.tenants) = 1
      then (select id from public.tenants)
    else null
  end;
$$;

revoke all on function public.default_tenant_id() from public, anon, authenticated;

-- Perfis primeiro: é deles que sai o cliente do usuário logado.
alter table public.profiles
  add column tenant_id uuid references public.tenants(id) on delete restrict;
update public.profiles set tenant_id = (select id from public.tenants limit 1);
alter table public.profiles alter column tenant_id set not null;
alter table public.profiles alter column tenant_id set default public.default_tenant_id();
create index profiles_tenant_idx on public.profiles (tenant_id);

-- Cliente do usuário logado. É a âncora: todo o resto deriva daqui.
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

revoke all on function public.current_tenant_id() from public, anon;
grant execute on function public.current_tenant_id() to authenticated;

alter table public.tenants enable row level security;

create policy "Users read own tenant"
  on public.tenants for select
  to authenticated
  using (id = public.current_tenant_id());

-- Demais raízes: herdam o cliente de quem está criando.
alter table public.tickets
  add column tenant_id uuid references public.tenants(id) on delete restrict;
update public.tickets set tenant_id = (select id from public.tenants limit 1);
alter table public.tickets alter column tenant_id set not null;
alter table public.tickets alter column tenant_id
  set default coalesce(public.current_tenant_id(), public.default_tenant_id());
create index tickets_tenant_idx on public.tickets (tenant_id, created_at desc);

alter table public.assets
  add column tenant_id uuid references public.tenants(id) on delete restrict;
update public.assets set tenant_id = (select id from public.tenants limit 1);
alter table public.assets alter column tenant_id set not null;
alter table public.assets alter column tenant_id
  set default coalesce(public.current_tenant_id(), public.default_tenant_id());
create index assets_tenant_idx on public.assets (tenant_id);

alter table public.service_catalog_items
  add column tenant_id uuid references public.tenants(id) on delete restrict;
update public.service_catalog_items set tenant_id = (select id from public.tenants limit 1);
alter table public.service_catalog_items alter column tenant_id set not null;
alter table public.service_catalog_items alter column tenant_id
  set default coalesce(public.current_tenant_id(), public.default_tenant_id());
create index service_catalog_items_tenant_idx on public.service_catalog_items (tenant_id);

alter table public.knowledge_categories
  add column tenant_id uuid references public.tenants(id) on delete restrict;
update public.knowledge_categories set tenant_id = (select id from public.tenants limit 1);
alter table public.knowledge_categories alter column tenant_id set not null;
alter table public.knowledge_categories alter column tenant_id
  set default coalesce(public.current_tenant_id(), public.default_tenant_id());
create index knowledge_categories_tenant_idx on public.knowledge_categories (tenant_id);

alter table public.knowledge_articles
  add column tenant_id uuid references public.tenants(id) on delete restrict;
update public.knowledge_articles set tenant_id = (select id from public.tenants limit 1);
alter table public.knowledge_articles alter column tenant_id set not null;
alter table public.knowledge_articles alter column tenant_id
  set default coalesce(public.current_tenant_id(), public.default_tenant_id());
create index knowledge_articles_tenant_idx on public.knowledge_articles (tenant_id);

alter table public.sla_calendars
  add column tenant_id uuid references public.tenants(id) on delete restrict;
update public.sla_calendars set tenant_id = (select id from public.tenants limit 1);
alter table public.sla_calendars alter column tenant_id set not null;
alter table public.sla_calendars alter column tenant_id
  set default coalesce(public.current_tenant_id(), public.default_tenant_id());
create index sla_calendars_tenant_idx on public.sla_calendars (tenant_id);

alter table public.sla_policies
  add column tenant_id uuid references public.tenants(id) on delete restrict;
update public.sla_policies set tenant_id = (select id from public.tenants limit 1);
alter table public.sla_policies alter column tenant_id set not null;
alter table public.sla_policies alter column tenant_id
  set default coalesce(public.current_tenant_id(), public.default_tenant_id());
create index sla_policies_tenant_idx on public.sla_policies (tenant_id);

-- Cadastro por signup/SAML: tenant vem do app_metadata, senão do cliente único.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id, email, full_name, role, department, job_title, tenant_id
  ) values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      concat_ws(' ', new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name'),
      split_part(new.email, '@', 1)
    ),
    coalesce((new.raw_app_meta_data->>'role')::public.user_role, 'collaborator'),
    coalesce(new.raw_user_meta_data->>'department', new.raw_user_meta_data->'custom_claims'->>'department'),
    coalesce(new.raw_user_meta_data->>'job_title', new.raw_user_meta_data->'custom_claims'->>'job_title'),
    coalesce((new.raw_app_meta_data->>'tenant_id')::uuid, public.default_tenant_id())
  );
  return new;
end;
$$;
