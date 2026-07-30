-- Status change history + phone on profiles for quick contact.

alter table public.profiles
  add column if not exists phone text;

create table if not exists public.ticket_events (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null default 'status_change',
  from_status ticket_status,
  to_status ticket_status,
  created_at timestamptz not null default now()
);

create index if not exists ticket_events_ticket_idx
  on public.ticket_events (ticket_id, created_at desc);

alter table public.ticket_events enable row level security;

create policy "Analysts see ticket events; requesters see own"
  on public.ticket_events for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'analyst'
    )
    or exists (
      select 1 from public.tickets t
      where t.id = ticket_id and t.requester_id = auth.uid()
    )
  );

create policy "Authenticated users can insert ticket events they author"
  on public.ticket_events for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and (
          t.requester_id = auth.uid()
          or exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'analyst'
          )
        )
    )
  );

create or replace function public.log_ticket_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.ticket_events (ticket_id, actor_id, event_type, from_status, to_status)
    values (new.id, auth.uid(), 'status_change', old.status, new.status);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_ticket_status_change on public.tickets;
create trigger trg_log_ticket_status_change
  after update of status on public.tickets
  for each row
  execute function public.log_ticket_status_change();
