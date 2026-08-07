-- O default de tenant_id chamava default_tenant_id(), cuja execução é revogada
-- para authenticated — qualquer insert vindo do app falhava com
-- "permission denied for function default_tenant_id", quebrando a criação de
-- chamados. Para quem está logado, current_tenant_id() já é a fonte correta.
--
-- profiles não entra: nasce no trigger de signup, que é security definer e
-- portanto executa como dono, sem esbarrar no revoke.

alter table public.tickets alter column tenant_id set default public.current_tenant_id();
alter table public.assets alter column tenant_id set default public.current_tenant_id();
alter table public.service_catalog_items alter column tenant_id set default public.current_tenant_id();
alter table public.knowledge_categories alter column tenant_id set default public.current_tenant_id();
alter table public.knowledge_articles alter column tenant_id set default public.current_tenant_id();
alter table public.sla_calendars alter column tenant_id set default public.current_tenant_id();
alter table public.sla_policies alter column tenant_id set default public.current_tenant_id();
