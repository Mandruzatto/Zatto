-- Fundação multi-cliente (etapa 2b): isolamento nas tabelas que herdam o cliente.
--
-- Comentário herda do chamado, atribuição herda do ativo, feedback herda do artigo.
-- Em vez de repetir a regra em cada política, duas funções centralizam o acesso.
-- notifications não entra aqui: a política já é `user_id = auth.uid()`, e um usuário
-- pertence a um único cliente.

create or replace function public.can_access_ticket(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tickets t
    where t.id = p_ticket_id
      and t.tenant_id = public.current_tenant_id()
      and (
        t.requester_id = auth.uid()
        or public.is_analyst_of(t.tenant_id)
        or public.is_ticket_approver(t.id)
      )
  );
$$;

revoke all on function public.can_access_ticket(uuid) from public, anon;
grant execute on function public.can_access_ticket(uuid) to authenticated;

create or replace function public.is_analyst_of_ticket(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tickets t
    where t.id = p_ticket_id and public.is_analyst_of(t.tenant_id)
  );
$$;

revoke all on function public.is_analyst_of_ticket(uuid) from public, anon;
grant execute on function public.is_analyst_of_ticket(uuid) to authenticated;

drop policy if exists "Collaborators see non-internal comments on own tickets" on public.ticket_comments;
create policy "Comment visibility scoped by ticket"
  on public.ticket_comments for select to authenticated
  using (
    public.can_access_ticket(ticket_id)
    and ((not is_internal) or public.is_analyst_of_ticket(ticket_id))
  );

drop policy if exists "Authenticated users can comment on accessible tickets" on public.ticket_comments;
create policy "Comment creation scoped by ticket"
  on public.ticket_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.can_access_ticket(ticket_id)
    and ((not is_internal) or public.is_analyst_of_ticket(ticket_id))
  );

drop policy if exists "Analysts see ticket events; requesters see own" on public.ticket_events;
create policy "Event visibility scoped by ticket"
  on public.ticket_events for select to authenticated
  using (public.can_access_ticket(ticket_id));

drop policy if exists "Authenticated users can insert ticket events they author" on public.ticket_events;
create policy "Event creation scoped by ticket"
  on public.ticket_events for insert to authenticated
  with check (actor_id = auth.uid() and public.can_access_ticket(ticket_id));

drop policy if exists "All authenticated users can view ticket assets" on public.ticket_assets;
create policy "Ticket asset visibility scoped by ticket"
  on public.ticket_assets for select to authenticated
  using (public.can_access_ticket(ticket_id));

drop policy if exists "Only analysts can manage ticket assets" on public.ticket_assets;
create policy "Analysts manage ticket assets in own tenant"
  on public.ticket_assets for all to authenticated
  using (public.is_analyst_of_ticket(ticket_id))
  with check (public.is_analyst_of_ticket(ticket_id));

drop policy if exists "All authenticated users can view assignments" on public.asset_assignments;
create policy "Assignment visibility scoped by tenant"
  on public.asset_assignments for select to authenticated
  using (exists (
    select 1 from public.assets a
    where a.id = asset_id and a.tenant_id = public.current_tenant_id()
  ));

drop policy if exists "Only analysts can manage assignments" on public.asset_assignments;
create policy "Analysts manage assignments in own tenant"
  on public.asset_assignments for all to authenticated
  using (exists (
    select 1 from public.assets a
    where a.id = asset_id and public.is_analyst_of(a.tenant_id)
  ))
  with check (exists (
    select 1 from public.assets a
    where a.id = asset_id and public.is_analyst_of(a.tenant_id)
  ));

drop policy if exists "Relevant users view approvals" on public.ticket_approvals;
create policy "Approval visibility scoped by ticket"
  on public.ticket_approvals for select to authenticated
  using (approver_id = auth.uid() or public.can_access_ticket(ticket_id));

drop policy if exists "Analysts manage approvals" on public.ticket_approvals;
create policy "Analysts manage approvals in own tenant"
  on public.ticket_approvals for all to authenticated
  using (public.is_analyst_of_ticket(ticket_id))
  with check (public.is_analyst_of_ticket(ticket_id));

drop policy if exists "Requester and analysts view satisfaction" on public.ticket_satisfaction;
create policy "Satisfaction visibility scoped by ticket"
  on public.ticket_satisfaction for select to authenticated
  using (public.can_access_ticket(ticket_id));

drop policy if exists "Ticket parties can view remote sessions" on public.remote_sessions;
create policy "Remote session visibility scoped by ticket"
  on public.remote_sessions for select to authenticated
  using (public.can_access_ticket(ticket_id));

drop policy if exists "Ticket parties can propose remote sessions" on public.remote_sessions;
create policy "Remote session creation scoped by ticket"
  on public.remote_sessions for insert to authenticated
  with check (proposed_by = auth.uid() and public.can_access_ticket(ticket_id));

drop policy if exists "Ticket parties can update remote sessions" on public.remote_sessions;
create policy "Remote session update scoped by ticket"
  on public.remote_sessions for update to authenticated
  using (public.can_access_ticket(ticket_id))
  with check (public.can_access_ticket(ticket_id));

drop policy if exists "Ticket participants can view attachments" on public.ticket_comment_attachments;
create policy "Attachment visibility scoped by ticket"
  on public.ticket_comment_attachments for select to authenticated
  using (public.can_access_ticket(ticket_id));

drop policy if exists "Analysts view all knowledge feedback" on public.knowledge_article_feedback;
create policy "Analysts view knowledge feedback in own tenant"
  on public.knowledge_article_feedback for select to authenticated
  using (exists (
    select 1 from public.knowledge_articles a
    where a.id = article_id and public.is_analyst_of(a.tenant_id)
  ));
