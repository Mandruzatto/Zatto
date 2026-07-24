create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id, email, full_name, role, department, job_title
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
    coalesce(new.raw_user_meta_data->>'job_title', new.raw_user_meta_data->'custom_claims'->>'job_title')
  );
  return new;
end;
$$;
