-- Unify resolved + closed into a single terminal status: finalized ("Finalizado").

drop trigger if exists trg_track_sla_pause on public.tickets;
drop trigger if exists trg_clear_schedule_on_status_change on public.tickets;
drop trigger if exists trg_log_ticket_status_change on public.tickets;

alter table public.tickets alter column status drop default;

alter table public.tickets
  alter column status type text using status::text;

alter table public.ticket_events
  alter column from_status type text using from_status::text;

alter table public.ticket_events
  alter column to_status type text using to_status::text;

alter table public.sla_policies
  alter column pause_statuses drop default;

alter table public.sla_policies
  alter column pause_statuses type text[] using pause_statuses::text[];

update public.tickets
  set status = 'finalized'
  where status in ('resolved', 'closed');

update public.ticket_events
  set from_status = 'finalized'
  where from_status in ('resolved', 'closed');

update public.ticket_events
  set to_status = 'finalized'
  where to_status in ('resolved', 'closed');

drop function if exists public.track_sla_pause() cascade;

drop type public.ticket_status;

create type public.ticket_status as enum (
  'open',
  'awaiting_approval',
  'in_progress',
  'pending',
  'scheduled',
  'finalized'
);

alter table public.tickets
  alter column status type public.ticket_status using status::public.ticket_status;

alter table public.tickets
  alter column status set default 'open'::public.ticket_status;

alter table public.ticket_events
  alter column from_status type public.ticket_status using from_status::public.ticket_status;

alter table public.ticket_events
  alter column to_status type public.ticket_status using to_status::public.ticket_status;

alter table public.sla_policies
  alter column pause_statuses type public.ticket_status[]
  using pause_statuses::public.ticket_status[];

alter table public.sla_policies
  alter column pause_statuses
  set default array['pending', 'awaiting_approval']::public.ticket_status[];

create or replace function public.track_sla_pause()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pause_statuses public.ticket_status[];
  v_elapsed integer;
begin
  if new.sla_policy_id is null or old.status = new.status then
    return new;
  end if;

  select pause_statuses into v_pause_statuses
  from public.sla_policies where id = new.sla_policy_id;

  if new.status = any(v_pause_statuses) and not (old.status = any(v_pause_statuses)) then
    new.sla_paused_at := now();
  elsif old.status = any(v_pause_statuses) and not (new.status = any(v_pause_statuses))
    and old.sla_paused_at is not null then
    v_elapsed := extract(epoch from (now() - old.sla_paused_at))::integer;
    new.sla_total_paused_seconds := old.sla_total_paused_seconds + v_elapsed;
    new.first_response_due_at := case
      when old.first_responded_at is null and old.first_response_due_at is not null
        then old.first_response_due_at + make_interval(secs => v_elapsed)
      else old.first_response_due_at
    end;
    new.resolution_due_at := case
      when old.resolution_due_at is not null
        then old.resolution_due_at + make_interval(secs => v_elapsed)
      else null
    end;
    new.sla_paused_at := null;
  end if;
  return new;
end;
$$;

create trigger trg_track_sla_pause
  before update of status on public.tickets
  for each row execute function public.track_sla_pause();

create trigger trg_clear_schedule_on_status_change
  before insert or update of status on public.tickets
  for each row execute function public.clear_schedule_on_status_change();

create trigger trg_log_ticket_status_change
  after update of status on public.tickets
  for each row execute function public.log_ticket_status_change();

create or replace function public.sync_approval_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.approver_id is distinct from new.approver_id
    and new.approver_id is not null
    and new.decision = 'pending' then
    update public.tickets
      set approval_status = 'pending', status = 'awaiting_approval'
      where id = new.ticket_id;
  end if;

  if old.decision = new.decision then
    return new;
  end if;

  if new.decision = 'approved' then
    update public.tickets
      set approval_status = 'approved', status = 'open'
      where id = new.ticket_id;
  elsif new.decision = 'rejected' then
    update public.tickets
      set approval_status = 'rejected',
          status = 'finalized',
          resolution = coalesce(new.comment, 'Solicitação rejeitada pelo aprovador'),
          resolved_at = now()
      where id = new.ticket_id;
  end if;
  return new;
end;
$$;
