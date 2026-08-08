-- RPC: analista redefine a senha de um usuário
create or replace function public.reset_user_password(
  p_user_id uuid,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_role public.user_role;
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is distinct from 'analyst' then
    raise exception 'Apenas analistas podem redefinir senhas';
  end if;

  if length(p_password) < 6 then
    raise exception 'A senha deve ter pelo menos 6 caracteres';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
      updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'Usuário não encontrado';
  end if;
end;
$$;

revoke all on function public.reset_user_password(uuid, text) from public, anon;
grant execute on function public.reset_user_password(uuid, text) to authenticated;
