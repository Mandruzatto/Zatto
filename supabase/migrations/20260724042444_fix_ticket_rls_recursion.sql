-- Break tickets <-> ticket_approvals RLS recursion and allow analysts to open tickets

create or replace function public.is_ticket_approver(p_ticket_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.ticket_approvals ta
    where ta.ticket_id = p_ticket_id
      and ta.approver_id = auth.uid()
  );
$$;

create or replace function public.is_ticket_requester(p_ticket_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.tickets t
    where t.id = p_ticket_id
      and t.requester_id = auth.uid()
  );
$$;

revoke all on function public.is_ticket_approver(uuid) from public;
revoke all on function public.is_ticket_requester(uuid) from public;
grant execute on function public.is_ticket_approver(uuid) to authenticated;
grant execute on function public.is_ticket_requester(uuid) to authenticated;

drop policy if exists "Collaborators see own tickets; analysts see all; approvers see assigned" on public.tickets;
drop policy if exists "Collaborators see own tickets; analysts see all; approvers see " on public.tickets;

create policy "Collaborators see own tickets; analysts see all; approvers see assigned"
  on public.tickets for select
  to authenticated
  using (
    requester_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'analyst'
    )
    or public.is_ticket_approver(id)
  );

drop policy if exists "Relevant users view approvals" on public.ticket_approvals;

create policy "Relevant users view approvals"
  on public.ticket_approvals for select
  to authenticated
  using (
    approver_id = auth.uid()
    or public.is_ticket_requester(ticket_id)
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'analyst'
    )
  );

drop policy if exists "Authenticated users can create tickets" on public.tickets;

create policy "Users and analysts can create tickets"
  on public.tickets for insert
  to authenticated
  with check (
    requester_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'analyst'
    )
  );
