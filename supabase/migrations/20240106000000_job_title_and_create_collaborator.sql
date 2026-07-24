-- Cargo do colaborador
alter table profiles add column job_title text;

-- RPC: analista cria colaborador (usuário auth + perfil via trigger)
create or replace function public.create_collaborator(
  p_email text,
  p_password text,
  p_full_name text,
  p_job_title text default null,
  p_department text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_role public.user_role;
  v_user_id uuid := gen_random_uuid();
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is distinct from 'analyst' then
    raise exception 'Apenas analistas podem criar colaboradores';
  end if;

  if exists (select 1 from auth.users where email = lower(p_email)) then
    raise exception 'Já existe um usuário com este e-mail';
  end if;

  if length(p_password) < 6 then
    raise exception 'A senha deve ter pelo menos 6 caracteres';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change,
    email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    lower(p_email), extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name),
    now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_user_id, v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', lower(p_email), 'email_verified', true),
    'email', now(), now(), now()
  );

  -- perfil é criado pelo trigger on_auth_user_created; complementa cargo/departamento
  update public.profiles
  set job_title = p_job_title, department = p_department
  where id = v_user_id;

  return v_user_id;
end;
$$;

revoke all on function public.create_collaborator(text, text, text, text, text) from public, anon;
grant execute on function public.create_collaborator(text, text, text, text, text) to authenticated;
