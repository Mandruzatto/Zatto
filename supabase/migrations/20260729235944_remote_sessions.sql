-- Scheduled remote support sessions on tickets (AnyDesk bridge MVP).

create type public.remote_session_status as enum (
  'proposed',
  'confirmed',
  'ready',
  'in_progress',
  'done',
  'cancelled'
);

create type public.remote_access_method as enum (
  'anydesk',
  'link',
  'other'
);

create table public.remote_sessions (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  proposed_by uuid not null references public.profiles(id) on delete restrict,
  analyst_id uuid references public.profiles(id) on delete set null,
  scheduled_for timestamptz not null,
  duration_minutes integer not null default 30
    check (duration_minutes between 15 and 240),
  status public.remote_session_status not null default 'proposed',
  access_method public.remote_access_method not null default 'anydesk',
  access_payload text,
  consent_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index remote_sessions_ticket_idx
  on public.remote_sessions (ticket_id, scheduled_for desc);

create index remote_sessions_schedule_idx
  on public.remote_sessions (scheduled_for)
  where status in ('proposed', 'confirmed', 'ready', 'in_progress');

create trigger trg_remote_sessions_updated_at
  before update on public.remote_sessions
  for each row execute function public.set_updated_at();

alter table public.remote_sessions enable row level security;

create policy "Ticket parties can view remote sessions"
  on public.remote_sessions for select
  to authenticated
  using (
    public.is_ticket_requester(ticket_id)
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'analyst'
    )
  );

create policy "Ticket parties can propose remote sessions"
  on public.remote_sessions for insert
  to authenticated
  with check (
    proposed_by = auth.uid()
    and (
      public.is_ticket_requester(ticket_id)
      or exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'analyst'
      )
    )
  );

create policy "Ticket parties can update remote sessions"
  on public.remote_sessions for update
  to authenticated
  using (
    public.is_ticket_requester(ticket_id)
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'analyst'
    )
  )
  with check (
    public.is_ticket_requester(ticket_id)
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'analyst'
    )
  );
