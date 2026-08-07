-- Gestão de clientes e convites.
--
-- Suspender em vez de excluir é o caminho normal: excluir cliente levaria junto
-- chamados, pessoas e histórico. As chaves estrangeiras já usam "on delete
-- restrict", então o banco recusa apagar cliente que tenha gente dentro — a
-- exclusão só passa para cliente vazio, tipo cadastro feito errado.

alter table public.tenants
  add column is_active boolean not null default true;

create policy "Platform admins update tenants"
  on public.tenants for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Platform admins delete tenants"
  on public.tenants for delete
  to authenticated
  using (public.is_platform_admin());
