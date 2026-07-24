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
