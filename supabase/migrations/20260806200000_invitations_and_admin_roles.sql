-- Convites e níveis de administração.
--
-- Papel (analyst/collaborator) é função dentro do helpdesk e continua como está —
-- mexer no enum obrigaria a reescrever as políticas recém-ajustadas. Administração
-- vira permissão separada, em dois níveis:
--
--   is_platform_admin  -> nós, o fornecedor. Cria cliente e convida o ponto focal.
--                         Não dá acesso aos dados do cliente: o isolamento continua.
--   is_tenant_admin    -> a "conta master" do cliente. Convida o time dele.

alter table public.profiles
  add column is_platform_admin boolean not null default false,
  add column is_tenant_admin boolean not null default false;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_platform_admin
  );
$$;

revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

create or replace function public.is_tenant_admin_of(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_tenant is not null and exists (
    select 1 from public.profiles
    where id = auth.uid() and is_tenant_admin and tenant_id = p_tenant
  );
$$;

revoke all on function public.is_tenant_admin_of(uuid) from public, anon;
grant execute on function public.is_tenant_admin_of(uuid) to authenticated;

create table public.invitations (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  role public.user_role not null default 'collaborator',
  -- convite do ponto focal cria a conta master daquele cliente
  grants_tenant_admin boolean not null default false,
  -- guarda o hash, nunca o token: se o banco vazar, os convites não são usáveis
  token_hash text not null unique,
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index invitations_tenant_idx on public.invitations (tenant_id, created_at desc);

-- um convite pendente por pessoa em cada cliente
create unique index invitations_pending_unique_idx
  on public.invitations (tenant_id, lower(email))
  where accepted_at is null;

alter table public.invitations enable row level security;

create policy "Platform admins manage all invitations"
  on public.invitations for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Tenant admins manage own tenant invitations"
  on public.invitations for all to authenticated
  using (public.is_tenant_admin_of(tenant_id))
  with check (public.is_tenant_admin_of(tenant_id));

-- Só quem é platform admin cria cliente novo.
create policy "Platform admins create tenants"
  on public.tenants for insert to authenticated
  with check (public.is_platform_admin());

create policy "Platform admins view all tenants"
  on public.tenants for select to authenticated
  using (public.is_platform_admin());

-- Cadastro passa a olhar o convite pendente: é dele que sai cliente, papel e
-- permissão de administrador. Evita precisar da chave de serviço para
-- carimbar app_metadata — o próprio signup normal resolve.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.invitations;
begin
  select * into v_invite
  from public.invitations
  where lower(email) = lower(new.email)
    and accepted_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  insert into public.profiles (
    id, email, full_name, role, department, job_title, tenant_id, is_tenant_admin
  ) values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      concat_ws(' ', new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name'),
      split_part(new.email, '@', 1)
    ),
    coalesce(v_invite.role, (new.raw_app_meta_data->>'role')::public.user_role, 'collaborator'),
    coalesce(new.raw_user_meta_data->>'department', new.raw_user_meta_data->'custom_claims'->>'department'),
    coalesce(new.raw_user_meta_data->>'job_title', new.raw_user_meta_data->'custom_claims'->>'job_title'),
    coalesce(v_invite.tenant_id, (new.raw_app_meta_data->>'tenant_id')::uuid, public.default_tenant_id()),
    coalesce(v_invite.grants_tenant_admin, false)
  );

  if v_invite.id is not null then
    update public.invitations
      set accepted_at = now(), accepted_by = new.id
      where id = v_invite.id;
  end if;

  return new;
end;
$$;

-- Primeiro administrador da plataforma. Troque para a conta que for a sua.
update public.profiles set is_platform_admin = true, is_tenant_admin = true
where email = 'suporte@zatto.com';
