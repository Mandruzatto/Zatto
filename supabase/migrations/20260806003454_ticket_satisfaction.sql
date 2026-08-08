-- Pesquisa de satisfação (CSAT) respondida pelo solicitante ao final do chamado.

create table public.ticket_satisfaction (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  respondent_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ticket_id)
);

create index ticket_satisfaction_rating_idx
  on public.ticket_satisfaction (rating, created_at desc);

create trigger trg_ticket_satisfaction_updated_at
  before update on public.ticket_satisfaction
  for each row execute function public.set_updated_at();

alter table public.ticket_satisfaction enable row level security;

create policy "Requester and analysts view satisfaction"
  on public.ticket_satisfaction for select
  to authenticated
  using (
    public.is_ticket_requester(ticket_id)
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'analyst'
    )
  );

-- Só o solicitante avalia, e só depois do chamado finalizado.
create policy "Requester rates own finalized ticket"
  on public.ticket_satisfaction for insert
  to authenticated
  with check (
    respondent_id = auth.uid()
    and public.is_ticket_requester(ticket_id)
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id and t.status = 'finalized'
    )
  );

-- Permite corrigir a nota (inclusive após reabrir e finalizar de novo).
create policy "Requester updates own rating"
  on public.ticket_satisfaction for update
  to authenticated
  using (respondent_id = auth.uid())
  with check (respondent_id = auth.uid());
