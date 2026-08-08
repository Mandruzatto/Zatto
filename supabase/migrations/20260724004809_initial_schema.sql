-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =====================
-- PROFILES
-- =====================
create type user_role as enum ('analyst', 'collaborator');

create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text not null,
  role user_role not null default 'collaborator',
  department text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can view all profiles"
  on profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Analysts can update any profile"
  on profiles for update
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'analyst'
    )
  );

-- =====================
-- ASSETS
-- =====================
create type asset_status as enum ('active', 'inactive', 'maintenance', 'retired');
create type asset_type as enum ('laptop', 'desktop', 'monitor', 'phone', 'printer', 'tablet', 'other');

create table assets (
  id uuid default uuid_generate_v4() primary key,
  asset_tag text not null unique,
  name text not null,
  type asset_type not null,
  brand text,
  model text,
  serial_number text,
  status asset_status not null default 'active',
  purchase_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table assets enable row level security;

create policy "All authenticated users can view assets"
  on assets for select
  to authenticated
  using (true);

create policy "Only analysts can insert assets"
  on assets for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'analyst'
    )
  );

create policy "Only analysts can update assets"
  on assets for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'analyst'
    )
  );

-- =====================
-- ASSET ASSIGNMENTS
-- =====================
create table asset_assignments (
  id uuid default uuid_generate_v4() primary key,
  asset_id uuid references assets(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  assigned_at timestamptz not null default now(),
  returned_at timestamptz,
  notes text
);

alter table asset_assignments enable row level security;

create policy "All authenticated users can view assignments"
  on asset_assignments for select
  to authenticated
  using (true);

create policy "Only analysts can manage assignments"
  on asset_assignments for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'analyst'
    )
  );

-- View for current asset holders (only active assignments)
create view asset_current_holders with (security_invoker = true) as
  select distinct on (asset_id)
    aa.asset_id,
    aa.user_id,
    aa.assigned_at,
    aa.id as assignment_id,
    p.full_name,
    p.email,
    p.department
  from asset_assignments aa
  join profiles p on p.id = aa.user_id
  where aa.returned_at is null
  order by asset_id, assigned_at desc;

-- =====================
-- TICKETS
-- =====================
create type ticket_status as enum ('open', 'in_progress', 'waiting', 'resolved', 'closed');
create type ticket_priority as enum ('low', 'medium', 'high', 'critical');
create type ticket_category as enum ('hardware', 'software', 'network', 'access', 'other');

create sequence ticket_number_seq start 1000;

create table tickets (
  id uuid default uuid_generate_v4() primary key,
  ticket_number text not null unique default 'TKT-' || nextval('ticket_number_seq'),
  title text not null,
  description text not null,
  status ticket_status not null default 'open',
  priority ticket_priority not null default 'medium',
  category ticket_category not null default 'other',
  requester_id uuid references profiles(id) on delete set null,
  assignee_id uuid references profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tickets enable row level security;

create policy "Collaborators see own tickets; analysts see all"
  on tickets for select
  to authenticated
  using (
    requester_id = auth.uid()
    or exists (
      select 1 from profiles
      where id = auth.uid() and role = 'analyst'
    )
  );

create policy "Authenticated users can create tickets"
  on tickets for insert
  to authenticated
  with check (requester_id = auth.uid());

create policy "Analysts can update any ticket; collaborators their own"
  on tickets for update
  to authenticated
  using (
    requester_id = auth.uid()
    or exists (
      select 1 from profiles
      where id = auth.uid() and role = 'analyst'
    )
  );

-- =====================
-- TICKET <-> ASSETS
-- =====================
create table ticket_assets (
  ticket_id uuid references tickets(id) on delete cascade,
  asset_id uuid references assets(id) on delete cascade,
  primary key (ticket_id, asset_id)
);

alter table ticket_assets enable row level security;

create policy "All authenticated users can view ticket assets"
  on ticket_assets for select
  to authenticated
  using (true);

create policy "Only analysts can manage ticket assets"
  on ticket_assets for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'analyst'
    )
  );

-- =====================
-- TICKET COMMENTS
-- =====================
create table ticket_comments (
  id uuid default uuid_generate_v4() primary key,
  ticket_id uuid references tickets(id) on delete cascade not null,
  author_id uuid references profiles(id) on delete set null,
  content text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

alter table ticket_comments enable row level security;

create policy "Collaborators see non-internal comments on own tickets"
  on ticket_comments for select
  to authenticated
  using (
    (
      not is_internal
      and exists (
        select 1 from tickets t
        where t.id = ticket_id and t.requester_id = auth.uid()
      )
    )
    or exists (
      select 1 from profiles
      where id = auth.uid() and role = 'analyst'
    )
  );

create policy "Authenticated users can comment on accessible tickets"
  on ticket_comments for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and (
      not is_internal
      or exists (
        select 1 from profiles
        where id = auth.uid() and role = 'analyst'
      )
    )
  );

-- =====================
-- TRIGGERS: updated_at
-- =====================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create trigger trg_assets_updated_at
  before update on assets
  for each row execute function set_updated_at();

create trigger trg_tickets_updated_at
  before update on tickets
  for each row execute function set_updated_at();

-- =====================
-- TRIGGER: auto-create profile on signup
-- =====================
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_app_meta_data->>'role')::public.user_role, 'collaborator')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =====================
-- INDEXES
-- =====================
create index idx_tickets_requester on tickets(requester_id);
create index idx_tickets_assignee on tickets(assignee_id);
create index idx_tickets_status on tickets(status);
create index idx_asset_assignments_asset on asset_assignments(asset_id);
create index idx_asset_assignments_user on asset_assignments(user_id);
create index idx_ticket_comments_ticket on ticket_comments(ticket_id);
