-- Reposição: aplicada direto no banco e nunca versionada. A migration de
-- automações depende do gatilho criado aqui, então sem este arquivo um
-- ambiente novo quebra ao chegar lá.
--
-- O histórico só registrava mudança de status. Quem trocou a prioridade,
-- reatribuiu o chamado ou mudou o aprovador não ficava em lugar nenhum — e
-- histórico não dá para reconstruir depois, então o custo de não ter é
-- permanente.
--
-- metadata guarda o "de/para" já com nome de pessoa resolvido, para a linha do
-- tempo não precisar de junção nem lidar com quem foi excluído depois.

alter table public.ticket_events add column if not exists metadata jsonb;

create or replace function public.log_ticket_field_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_de text;
  v_para text;
begin
  if new.priority is distinct from old.priority then
    insert into public.ticket_events (ticket_id, actor_id, event_type, metadata)
    values (new.id, auth.uid(), 'priority_change',
            jsonb_build_object('de', old.priority::text, 'para', new.priority::text));
  end if;

  if new.type is distinct from old.type then
    insert into public.ticket_events (ticket_id, actor_id, event_type, metadata)
    values (new.id, auth.uid(), 'type_change',
            jsonb_build_object('de', old.type::text, 'para', new.type::text));
  end if;

  if new.area is distinct from old.area then
    insert into public.ticket_events (ticket_id, actor_id, event_type, metadata)
    values (new.id, auth.uid(), 'area_change',
            jsonb_build_object('de', old.area::text, 'para', new.area::text));
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    select full_name into v_de from public.profiles where id = old.assignee_id;
    select full_name into v_para from public.profiles where id = new.assignee_id;
    insert into public.ticket_events (ticket_id, actor_id, event_type, metadata)
    values (new.id, auth.uid(), 'assignee_change',
            jsonb_build_object('de', v_de, 'para', v_para));
  end if;

  return new;
end;
$$;

revoke all on function public.log_ticket_field_changes() from public, anon, authenticated;

drop trigger if exists trg_log_ticket_field_changes on public.tickets;
create trigger trg_log_ticket_field_changes
  after update of priority, type, area, assignee_id on public.tickets
  for each row execute function public.log_ticket_field_changes();

create or replace function public.log_approval_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_de text;
  v_para text;
begin
  if tg_op = 'UPDATE' and new.approver_id is distinct from old.approver_id then
    select full_name into v_de from public.profiles where id = old.approver_id;
    select full_name into v_para from public.profiles where id = new.approver_id;
    insert into public.ticket_events (ticket_id, actor_id, event_type, metadata)
    values (new.ticket_id, auth.uid(), 'approver_change',
            jsonb_build_object('de', v_de, 'para', v_para));
  end if;

  if tg_op = 'UPDATE'
     and new.decision is distinct from old.decision
     and new.decision in ('approved', 'rejected') then
    select full_name into v_para from public.profiles where id = new.approver_id;
    insert into public.ticket_events (ticket_id, actor_id, event_type, metadata)
    values (new.ticket_id, new.approver_id, 'approval_decision',
            jsonb_build_object('decisao', new.decision::text, 'por', v_para,
                               'comentario', new.comment));
  end if;

  return new;
end;
$$;

revoke all on function public.log_approval_changes() from public, anon, authenticated;

drop trigger if exists trg_log_approval_changes on public.ticket_approvals;
create trigger trg_log_approval_changes
  after update on public.ticket_approvals
  for each row execute function public.log_approval_changes();
