-- Notificações persistidas. O sino era derivado no cliente com localStorage:
-- não sobrevivia a trocar de navegador e não existia para o colaborador.
--
-- Princípio: notificar só quem precisa agir, e nunca a própria ação. Repetição
-- do mesmo evento no mesmo chamado atualiza a notificação em vez de empilhar.

create type public.notification_kind as enum (
  'ticket_assigned',
  'ticket_replied',
  'ticket_finalized',
  'approval_requested',
  'approval_decided'
);

create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ticket_id uuid references public.tickets(id) on delete cascade,
  kind public.notification_kind not null,
  actor_id uuid references public.profiles(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_inbox_idx
  on public.notifications (user_id, created_at desc);

-- Colapsa repetição: só uma notificação não lida por (usuário, chamado, tipo).
create unique index notifications_unread_unique_idx
  on public.notifications (user_id, ticket_id, kind)
  where read_at is null;

alter table public.notifications enable row level security;

create policy "Users read own notifications"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users update own notifications"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Inserção acontece só via triggers (security definer), nunca direto pelo cliente.

create or replace function public.notify_user(
  p_user_id uuid,
  p_ticket_id uuid,
  p_kind public.notification_kind,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then return; end if;
  -- ninguém é notificado da própria ação
  if p_user_id = p_actor_id then return; end if;

  insert into public.notifications (user_id, ticket_id, kind, actor_id)
  values (p_user_id, p_ticket_id, p_kind, p_actor_id)
  on conflict (user_id, ticket_id, kind) where read_at is null
  do update set created_at = now(), actor_id = excluded.actor_id;
end;
$$;

revoke all on function public.notify_user(uuid, uuid, public.notification_kind, uuid)
  from public, anon, authenticated;

-- Chamado atribuído a um agente
create or replace function public.notify_ticket_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assignee_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then
    return new;
  end if;
  perform public.notify_user(new.assignee_id, new.id, 'ticket_assigned', auth.uid());
  return new;
end;
$$;

revoke all on function public.notify_ticket_assigned() from public, anon, authenticated;

create trigger trg_notify_ticket_assigned
  after insert or update of assignee_id on public.tickets
  for each row execute function public.notify_ticket_assigned();

-- Chamado finalizado: avisa o solicitante (é ele quem avalia)
create or replace function public.notify_ticket_finalized()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'finalized' and old.status is distinct from 'finalized' then
    perform public.notify_user(new.requester_id, new.id, 'ticket_finalized', auth.uid());
  end if;
  return new;
end;
$$;

revoke all on function public.notify_ticket_finalized() from public, anon, authenticated;

create trigger trg_notify_ticket_finalized
  after update of status on public.tickets
  for each row execute function public.notify_ticket_finalized();

-- Aprovação pendente: o caso mais crítico, o aprovador quase nunca abre o sistema
create or replace function public.notify_approval_requested()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.approver_id is null or new.decision <> 'pending' then return new; end if;
  if tg_op = 'UPDATE' and new.approver_id is not distinct from old.approver_id then
    return new;
  end if;
  perform public.notify_user(new.approver_id, new.ticket_id, 'approval_requested', auth.uid());
  return new;
end;
$$;

revoke all on function public.notify_approval_requested() from public, anon, authenticated;

create trigger trg_notify_approval_requested
  after insert or update of approver_id on public.ticket_approvals
  for each row execute function public.notify_approval_requested();

-- Decisão do aprovador: destrava (ou encerra) o atendimento
create or replace function public.notify_approval_decided()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requester uuid;
  v_assignee uuid;
begin
  if new.decision is not distinct from old.decision then return new; end if;
  if new.decision not in ('approved', 'rejected') then return new; end if;

  select requester_id, assignee_id into v_requester, v_assignee
  from public.tickets where id = new.ticket_id;

  perform public.notify_user(v_assignee, new.ticket_id, 'approval_decided', new.approver_id);
  perform public.notify_user(v_requester, new.ticket_id, 'approval_decided', new.approver_id);
  return new;
end;
$$;

revoke all on function public.notify_approval_decided() from public, anon, authenticated;

create trigger trg_notify_approval_decided
  after update of decision on public.ticket_approvals
  for each row execute function public.notify_approval_decided();

-- Resposta no chamado: avisa o outro lado da conversa
create or replace function public.notify_ticket_replied()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requester uuid;
  v_assignee uuid;
begin
  select requester_id, assignee_id into v_requester, v_assignee
  from public.tickets where id = new.ticket_id;

  if new.is_internal then
    -- nota interna fica entre analistas
    perform public.notify_user(v_assignee, new.ticket_id, 'ticket_replied', new.author_id);
  elsif new.author_id = v_requester then
    perform public.notify_user(v_assignee, new.ticket_id, 'ticket_replied', new.author_id);
  else
    perform public.notify_user(v_requester, new.ticket_id, 'ticket_replied', new.author_id);
  end if;
  return new;
end;
$$;

revoke all on function public.notify_ticket_replied() from public, anon, authenticated;

create trigger trg_notify_ticket_replied
  after insert on public.ticket_comments
  for each row execute function public.notify_ticket_replied();

-- Realtime para o sino atualizar sem recarregar
alter publication supabase_realtime add table public.notifications;
