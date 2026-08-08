-- Quem clica no link do convite ainda não tem conta, então precisa de uma porta
-- aberta para validar o token. Devolve só o mínimo para montar a tela de ativação:
-- e-mail convidado e nome da empresa. Nada é exposto sem o token na mão, e o token
-- é aleatório de 32 bytes — não dá para adivinhar.

create or replace function public.invitation_preview(p_token text)
returns table (email text, tenant_name text, grants_tenant_admin boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select i.email, t.name, i.grants_tenant_admin
  from public.invitations i
  join public.tenants t on t.id = i.tenant_id
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and i.accepted_at is null
    and i.expires_at > now();
$$;

revoke all on function public.invitation_preview(text) from public;
grant execute on function public.invitation_preview(text) to anon, authenticated;
