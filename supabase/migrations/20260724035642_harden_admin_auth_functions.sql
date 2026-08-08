create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.create_collaborator(
  p_email text, p_password text, p_full_name text,
  p_job_title text default null, p_department text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_caller_role public.user_role;
  v_user_id uuid := gen_random_uuid();
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is distinct from 'analyst' then raise exception 'Apenas analistas podem criar colaboradores'; end if;
  if exists (select 1 from auth.users where email = lower(p_email)) then raise exception 'Já existe um usuário com este e-mail'; end if;
  if length(p_password) < 6 then raise exception 'A senha deve ter pelo menos 6 caracteres'; end if;

  insert into auth.users (
    instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
    confirmation_token,recovery_token,email_change,email_change_token_new,
    email_change_token_current,phone_change,phone_change_token,reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000',v_user_id,'authenticated','authenticated',
    lower(p_email),extensions.crypt(p_password,extensions.gen_salt('bf',10)),now(),
    '{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name',p_full_name),
    now(),now(),'','','','','','','',''
  );
  insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
  values(gen_random_uuid(),v_user_id,v_user_id::text,jsonb_build_object('sub',v_user_id::text,'email',lower(p_email),'email_verified',true),'email',now(),now(),now());
  update public.profiles set job_title=p_job_title,department=p_department where id=v_user_id;
  return v_user_id;
end; $$;

create or replace function private.reset_user_password(p_user_id uuid,p_password text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_caller_role public.user_role;
begin
  select role into v_caller_role from public.profiles where id=auth.uid();
  if v_caller_role is distinct from 'analyst' then raise exception 'Apenas analistas podem redefinir senhas'; end if;
  if length(p_password)<6 then raise exception 'A senha deve ter pelo menos 6 caracteres'; end if;
  update auth.users set encrypted_password=extensions.crypt(p_password,extensions.gen_salt('bf',10)),updated_at=now() where id=p_user_id;
  if not found then raise exception 'Usuário não encontrado'; end if;
end; $$;

create or replace function public.create_collaborator(
  p_email text,p_password text,p_full_name text,p_job_title text default null,p_department text default null
)
returns uuid language sql security invoker set search_path = '' as $$
  select private.create_collaborator(p_email,p_password,p_full_name,p_job_title,p_department);
$$;

create or replace function public.reset_user_password(p_user_id uuid,p_password text)
returns void language sql security invoker set search_path = '' as $$
  select private.reset_user_password(p_user_id,p_password);
$$;

revoke all on function private.create_collaborator(text,text,text,text,text) from public,anon;
revoke all on function private.reset_user_password(uuid,text) from public,anon;
grant execute on function private.create_collaborator(text,text,text,text,text) to authenticated;
grant execute on function private.reset_user_password(uuid,text) to authenticated;
