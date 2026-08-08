-- Allow designated approvers to read tickets they are approving (without RLS recursion)
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

revoke all on function public.is_ticket_approver(uuid) from public;
grant execute on function public.is_ticket_approver(uuid) to authenticated;

drop policy if exists "Collaborators see own tickets; analysts see all" on public.tickets;
drop policy if exists "Collaborators see own tickets; analysts see all; approvers see assigned" on public.tickets;

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
