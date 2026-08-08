-- Fundação multi-cliente (etapa 2a): isolamento nas tabelas raiz.
--
-- Antes desta migration, 30 das 45 políticas liberavam acesso só por "é analista",
-- sem olhar de qual cliente — um analista da empresa A veria os dados da B. Pior:
-- profiles, assets, ticket_assets, asset_assignments, sla_* e knowledge_categories
-- tinham política de leitura `true`, liberando tudo para qualquer autenticado.

create or replace function public.is_analyst_of(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_tenant is not null and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'analyst' and tenant_id = p_tenant
  );
$$;

revoke all on function public.is_analyst_of(uuid) from public, anon;
grant execute on function public.is_analyst_of(uuid) to authenticated;

drop policy if exists "Users can view all profiles" on public.profiles;
create policy "Users view profiles in own tenant"
  on public.profiles for select to authenticated
  using (tenant_id = public.current_tenant_id());

drop policy if exists "Analysts can update any profile" on public.profiles;
create policy "Analysts update profiles in own tenant"
  on public.profiles for update to authenticated
  using (public.is_analyst_of(tenant_id))
  with check (public.is_analyst_of(tenant_id));

drop policy if exists "All authenticated users can view assets" on public.assets;
create policy "Users view assets in own tenant"
  on public.assets for select to authenticated
  using (tenant_id = public.current_tenant_id());

drop policy if exists "Only analysts can insert assets" on public.assets;
create policy "Analysts insert assets in own tenant"
  on public.assets for insert to authenticated
  with check (public.is_analyst_of(tenant_id));

drop policy if exists "Only analysts can update assets" on public.assets;
create policy "Analysts update assets in own tenant"
  on public.assets for update to authenticated
  using (public.is_analyst_of(tenant_id))
  with check (public.is_analyst_of(tenant_id));

drop policy if exists "Collaborators see own tickets; analysts see all; approvers see " on public.tickets;
create policy "Ticket visibility scoped by tenant"
  on public.tickets for select to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (
      requester_id = auth.uid()
      or public.is_analyst_of(tenant_id)
      or public.is_ticket_approver(id)
    )
  );

drop policy if exists "Analysts can update any ticket; collaborators their own" on public.tickets;
create policy "Ticket update scoped by tenant"
  on public.tickets for update to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (requester_id = auth.uid() or public.is_analyst_of(tenant_id))
  )
  with check (
    tenant_id = public.current_tenant_id()
    and (requester_id = auth.uid() or public.is_analyst_of(tenant_id))
  );

drop policy if exists "Only analysts can delete tickets" on public.tickets;
create policy "Analysts delete tickets in own tenant"
  on public.tickets for delete to authenticated
  using (public.is_analyst_of(tenant_id));

drop policy if exists "Users and analysts can create tickets" on public.tickets;
create policy "Ticket creation scoped by tenant"
  on public.tickets for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and (requester_id = auth.uid() or public.is_analyst_of(tenant_id))
  );

drop policy if exists "Authenticated users view published catalog" on public.service_catalog_items;
create policy "Users view catalog in own tenant"
  on public.service_catalog_items for select to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (is_published or public.is_analyst_of(tenant_id))
  );

drop policy if exists "Analysts manage catalog" on public.service_catalog_items;
create policy "Analysts manage catalog in own tenant"
  on public.service_catalog_items for all to authenticated
  using (public.is_analyst_of(tenant_id))
  with check (public.is_analyst_of(tenant_id));

drop policy if exists "Authenticated users view knowledge categories" on public.knowledge_categories;
create policy "Users view knowledge categories in own tenant"
  on public.knowledge_categories for select to authenticated
  using (tenant_id = public.current_tenant_id());

drop policy if exists "Analysts manage knowledge categories" on public.knowledge_categories;
create policy "Analysts manage knowledge categories in own tenant"
  on public.knowledge_categories for all to authenticated
  using (public.is_analyst_of(tenant_id))
  with check (public.is_analyst_of(tenant_id));

drop policy if exists "Authenticated users view published knowledge" on public.knowledge_articles;
create policy "Users view knowledge in own tenant"
  on public.knowledge_articles for select to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (status = 'published'::public.knowledge_article_status or public.is_analyst_of(tenant_id))
  );

drop policy if exists "Analysts manage knowledge" on public.knowledge_articles;
create policy "Analysts manage knowledge in own tenant"
  on public.knowledge_articles for all to authenticated
  using (public.is_analyst_of(tenant_id))
  with check (public.is_analyst_of(tenant_id));

drop policy if exists "Authenticated users view SLA calendars" on public.sla_calendars;
create policy "Users view SLA calendars in own tenant"
  on public.sla_calendars for select to authenticated
  using (tenant_id = public.current_tenant_id());

drop policy if exists "Analysts manage SLA calendars" on public.sla_calendars;
create policy "Analysts manage SLA calendars in own tenant"
  on public.sla_calendars for all to authenticated
  using (public.is_analyst_of(tenant_id))
  with check (public.is_analyst_of(tenant_id));

drop policy if exists "Authenticated users view active SLA policies" on public.sla_policies;
create policy "Users view SLA policies in own tenant"
  on public.sla_policies for select to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (is_active or public.is_analyst_of(tenant_id))
  );

drop policy if exists "Analysts manage SLA policies" on public.sla_policies;
create policy "Analysts manage SLA policies in own tenant"
  on public.sla_policies for all to authenticated
  using (public.is_analyst_of(tenant_id))
  with check (public.is_analyst_of(tenant_id));

drop policy if exists "Authenticated users view SLA holidays" on public.sla_holidays;
create policy "Users view SLA holidays in own tenant"
  on public.sla_holidays for select to authenticated
  using (exists (
    select 1 from public.sla_calendars c
    where c.id = calendar_id and c.tenant_id = public.current_tenant_id()
  ));

drop policy if exists "Analysts manage SLA holidays" on public.sla_holidays;
create policy "Analysts manage SLA holidays in own tenant"
  on public.sla_holidays for all to authenticated
  using (exists (
    select 1 from public.sla_calendars c
    where c.id = calendar_id and public.is_analyst_of(c.tenant_id)
  ))
  with check (exists (
    select 1 from public.sla_calendars c
    where c.id = calendar_id and public.is_analyst_of(c.tenant_id)
  ));
