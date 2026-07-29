-- Scheduled tickets carry the date they are planned for

alter table public.tickets
  add column if not exists scheduled_for timestamptz;

create index if not exists idx_tickets_scheduled_for
  on public.tickets(scheduled_for)
  where scheduled_for is not null;

-- Leaving the scheduled status clears the plan date
create or replace function public.clear_schedule_on_status_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status <> 'scheduled' then
    new.scheduled_for := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_clear_schedule_on_status_change on public.tickets;
create trigger trg_clear_schedule_on_status_change
  before insert or update of status on public.tickets
  for each row execute function public.clear_schedule_on_status_change();
