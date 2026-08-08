-- zaTTo evolution foundation: catalog, approvals, knowledge base and SLA

-- ---------------------
-- Profiles / managers
-- ---------------------
alter table public.profiles
  add column manager_id uuid references public.profiles(id) on delete set null,
  add column can_approve boolean not null default false;

create index idx_profiles_manager on public.profiles(manager_id);

create or replace function public.protect_profile_management_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() = old.id and old.role <> 'analyst' then
    if new.manager_id is distinct from old.manager_id
      or new.can_approve is distinct from old.can_approve
      or new.role is distinct from old.role then
      raise exception 'Somente analistas podem alterar gestor e permissões';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_protect_profile_management_fields
  before update on public.profiles
  for each row execute function public.protect_profile_management_fields();

-- ---------------------
-- Service catalog
-- ---------------------
create table public.service_catalog_items (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  instructions text,
  keywords text[] not null default '{}',
  area ticket_area,
  default_priority ticket_priority not null default 'medium',
  requires_approval boolean not null default false,
  form_schema jsonb not null default '[]'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_catalog_form_schema_array
    check (jsonb_typeof(form_schema) = 'array')
);

alter table public.service_catalog_items enable row level security;

create policy "Authenticated users view published catalog"
  on public.service_catalog_items for select to authenticated
  using (
    is_published
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'analyst'
    )
  );

create policy "Analysts manage catalog"
  on public.service_catalog_items for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'analyst'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'analyst'
    )
  );

-- ---------------------
-- Knowledge base
-- ---------------------
create type knowledge_article_status as enum ('draft', 'published', 'archived');

create table public.knowledge_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table public.knowledge_articles (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid references public.knowledge_categories(id) on delete set null,
  author_id uuid references public.profiles(id) on delete set null,
  title text not null,
  slug text not null unique,
  summary text not null default '',
  content text not null,
  keywords text[] not null default '{}',
  status knowledge_article_status not null default 'draft',
  published_at timestamptz,
  view_count integer not null default 0 check (view_count >= 0),
  helpful_count integer not null default 0 check (helpful_count >= 0),
  not_helpful_count integer not null default 0 check (not_helpful_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.knowledge_article_feedback (
  article_id uuid references public.knowledge_articles(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  helpful boolean not null,
  created_at timestamptz not null default now(),
  primary key (article_id, user_id)
);

alter table public.knowledge_categories enable row level security;
alter table public.knowledge_articles enable row level security;
alter table public.knowledge_article_feedback enable row level security;

create policy "Authenticated users view knowledge categories"
  on public.knowledge_categories for select to authenticated using (true);
create policy "Analysts manage knowledge categories"
  on public.knowledge_categories for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'analyst'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'analyst'));

create policy "Authenticated users view published knowledge"
  on public.knowledge_articles for select to authenticated
  using (
    status = 'published'
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'analyst')
  );
create policy "Analysts manage knowledge"
  on public.knowledge_articles for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'analyst'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'analyst'));

create policy "Users manage own knowledge feedback"
  on public.knowledge_article_feedback for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "Analysts view all knowledge feedback"
  on public.knowledge_article_feedback for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'analyst'));

-- ---------------------
-- Ticket approvals
-- ---------------------
alter table public.tickets alter column status drop default;
alter table public.tickets alter column status type text;
drop type ticket_status;
create type ticket_status as enum (
  'open', 'awaiting_approval', 'in_progress', 'pending', 'scheduled', 'resolved', 'closed'
);
alter table public.tickets alter column status type ticket_status using status::ticket_status;
alter table public.tickets alter column status set default 'open';
create type ticket_approval_status as enum (
  'not_required',
  'pending_assignment',
  'pending',
  'approved',
  'rejected',
  'cancelled'
);
create type approval_decision as enum ('pending', 'approved', 'rejected', 'cancelled');

alter table public.tickets
  add column catalog_item_id uuid references public.service_catalog_items(id) on delete set null,
  add column form_responses jsonb not null default '{}'::jsonb,
  add column approval_status ticket_approval_status not null default 'not_required';

create table public.ticket_approvals (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  approver_id uuid references public.profiles(id) on delete set null,
  assigned_by uuid references public.profiles(id) on delete set null,
  decision approval_decision not null default 'pending',
  comment text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (ticket_id)
);

alter table public.ticket_approvals enable row level security;

create policy "Relevant users view approvals"
  on public.ticket_approvals for select to authenticated
  using (
    approver_id = auth.uid()
    or exists (
      select 1 from public.tickets t
      where t.id = ticket_id and t.requester_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'analyst'
    )
  );

create policy "Designated approver decides"
  on public.ticket_approvals for update to authenticated
  using (approver_id = auth.uid() and decision = 'pending')
  with check (
    approver_id = auth.uid()
    and decision in ('approved', 'rejected')
    and decided_at is not null
  );

create policy "Analysts manage approvals"
  on public.ticket_approvals for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'analyst'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'analyst'));

create or replace function public.protect_approval_decision_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() = old.approver_id
    and not exists (
      select 1 from public.profiles where id = auth.uid() and role = 'analyst'
    ) then
    if new.ticket_id is distinct from old.ticket_id
      or new.approver_id is distinct from old.approver_id
      or new.assigned_by is distinct from old.assigned_by
      or new.requested_at is distinct from old.requested_at
      or new.created_at is distinct from old.created_at then
      raise exception 'O aprovador só pode registrar sua decisão';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_protect_approval_decision_fields
  before update on public.ticket_approvals
  for each row execute function public.protect_approval_decision_fields();

create or replace function public.initialize_ticket_approval()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_requires boolean;
  v_manager uuid;
begin
  if new.catalog_item_id is null then
    return new;
  end if;

  select requires_approval into v_requires
  from public.service_catalog_items
  where id = new.catalog_item_id;

  if not coalesce(v_requires, false) then
    return new;
  end if;

  select manager_id into v_manager
  from public.profiles
  where id = new.requester_id;

  new.status := 'awaiting_approval';
  new.approval_status := case when v_manager is null then 'pending_assignment' else 'pending' end;
  return new;
end;
$$;

create trigger trg_initialize_ticket_approval
  before insert on public.tickets
  for each row execute function public.initialize_ticket_approval();

create or replace function public.create_initial_ticket_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_manager uuid;
begin
  if new.approval_status not in ('pending', 'pending_assignment') then
    return new;
  end if;

  select manager_id into v_manager from public.profiles where id = new.requester_id;
  insert into public.ticket_approvals(ticket_id, approver_id)
  values (new.id, v_manager);
  return new;
end;
$$;

revoke all on function public.create_initial_ticket_approval() from public, anon, authenticated;

create trigger trg_create_initial_ticket_approval
  after insert on public.tickets
  for each row execute function public.create_initial_ticket_approval();

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
      set approval_status = 'rejected', status = 'closed',
          resolution = coalesce(new.comment, 'Solicitação rejeitada pelo aprovador'),
          resolved_at = now()
      where id = new.ticket_id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_approval_decision() from public, anon, authenticated;

create trigger trg_sync_approval_decision
  after update of decision, approver_id on public.ticket_approvals
  for each row execute function public.sync_approval_decision();

-- ---------------------
-- SLA configuration
-- ---------------------
create table public.sla_calendars (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  timezone text not null default 'America/Sao_Paulo',
  weekly_schedule jsonb not null default
    '{"1":[["09:00","18:00"]],"2":[["09:00","18:00"]],"3":[["09:00","18:00"]],"4":[["09:00","18:00"]],"5":[["09:00","18:00"]]}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.sla_holidays (
  id uuid primary key default uuid_generate_v4(),
  calendar_id uuid not null references public.sla_calendars(id) on delete cascade,
  holiday_date date not null,
  name text not null,
  unique (calendar_id, holiday_date)
);

create table public.sla_policies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  calendar_id uuid not null references public.sla_calendars(id),
  priority ticket_priority,
  ticket_type ticket_type,
  area ticket_area,
  catalog_item_id uuid references public.service_catalog_items(id) on delete cascade,
  first_response_minutes integer not null check (first_response_minutes > 0),
  resolution_minutes integer not null check (resolution_minutes > 0),
  warning_percent integer not null default 80 check (warning_percent between 1 and 100),
  pause_statuses ticket_status[] not null default array['pending', 'awaiting_approval']::ticket_status[],
  precedence integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sla_calendars enable row level security;
alter table public.sla_holidays enable row level security;
alter table public.sla_policies enable row level security;

create policy "Authenticated users view SLA calendars"
  on public.sla_calendars for select to authenticated using (true);
create policy "Authenticated users view SLA holidays"
  on public.sla_holidays for select to authenticated using (true);
create policy "Authenticated users view active SLA policies"
  on public.sla_policies for select to authenticated
  using (is_active or exists (select 1 from public.profiles where id = auth.uid() and role = 'analyst'));

create policy "Analysts manage SLA calendars"
  on public.sla_calendars for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'analyst'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'analyst'));
create policy "Analysts manage SLA holidays"
  on public.sla_holidays for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'analyst'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'analyst'));
create policy "Analysts manage SLA policies"
  on public.sla_policies for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'analyst'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'analyst'));

alter table public.tickets
  add column sla_policy_id uuid references public.sla_policies(id) on delete set null,
  add column first_response_due_at timestamptz,
  add column resolution_due_at timestamptz,
  add column first_responded_at timestamptz,
  add column sla_paused_at timestamptz,
  add column sla_total_paused_seconds integer not null default 0;

create or replace function public.add_business_minutes(
  p_start timestamptz,
  p_minutes integer,
  p_calendar_id uuid
)
returns timestamptz
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_timezone text;
  v_schedule jsonb;
  v_cursor timestamp;
  v_day date;
  v_slots jsonb;
  v_slot jsonb;
  v_slot_start timestamp;
  v_slot_end timestamp;
  v_effective_start timestamp;
  v_available integer;
  v_remaining integer := p_minutes;
begin
  select timezone, weekly_schedule into v_timezone, v_schedule
  from public.sla_calendars where id = p_calendar_id;

  if v_timezone is null then
    return p_start + make_interval(mins => p_minutes);
  end if;

  v_cursor := p_start at time zone v_timezone;

  while v_remaining > 0 loop
    v_day := v_cursor::date;

    if not exists (
      select 1 from public.sla_holidays
      where calendar_id = p_calendar_id and holiday_date = v_day
    ) then
      v_slots := v_schedule -> extract(isodow from v_day)::int::text;
      if v_slots is not null then
        for v_slot in select value from jsonb_array_elements(v_slots)
        loop
          v_slot_start := v_day + (v_slot ->> 0)::time;
          v_slot_end := v_day + (v_slot ->> 1)::time;
          v_effective_start := greatest(v_cursor, v_slot_start);

          if v_effective_start < v_slot_end then
            v_available := floor(extract(epoch from (v_slot_end - v_effective_start)) / 60);
            if v_remaining <= v_available then
              return (v_effective_start + make_interval(mins => v_remaining))
                at time zone v_timezone;
            end if;
            v_remaining := v_remaining - v_available;
          end if;
        end loop;
      end if;
    end if;

    v_cursor := (v_day + 1)::timestamp;
  end loop;

  return v_cursor at time zone v_timezone;
end;
$$;

create or replace function public.select_ticket_sla_policy()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_policy public.sla_policies%rowtype;
begin
  if new.sla_policy_id is not null then
    return new;
  end if;

  select * into v_policy
  from public.sla_policies p
  where p.is_active
    and (p.priority is null or p.priority = new.priority)
    and (p.ticket_type is null or p.ticket_type = new.type)
    and (p.area is null or p.area = new.area)
    and (p.catalog_item_id is null or p.catalog_item_id = new.catalog_item_id)
  order by
    ((p.catalog_item_id is not null)::int +
     (p.area is not null)::int +
     (p.ticket_type is not null)::int +
     (p.priority is not null)::int) desc,
    p.precedence asc
  limit 1;

  if v_policy.id is not null then
    new.sla_policy_id := v_policy.id;
    new.first_response_due_at := public.add_business_minutes(
      new.created_at, v_policy.first_response_minutes, v_policy.calendar_id
    );
    new.resolution_due_at := public.add_business_minutes(
      new.created_at, v_policy.resolution_minutes, v_policy.calendar_id
    );
  end if;
  return new;
end;
$$;

create trigger trg_select_ticket_sla_policy
  before insert on public.tickets
  for each row execute function public.select_ticket_sla_policy();

create or replace function public.mark_first_response()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.is_internal then return new; end if;
  if exists (
    select 1 from public.profiles
    where id = new.author_id and role = 'analyst'
  ) then
    update public.tickets
      set first_responded_at = coalesce(first_responded_at, new.created_at)
      where id = new.ticket_id;
  end if;
  return new;
end;
$$;

create trigger trg_mark_first_response
  after insert on public.ticket_comments
  for each row execute function public.mark_first_response();

-- updated_at triggers
create trigger trg_catalog_updated_at before update on public.service_catalog_items
  for each row execute function public.set_updated_at();
create trigger trg_knowledge_articles_updated_at before update on public.knowledge_articles
  for each row execute function public.set_updated_at();
create trigger trg_sla_policies_updated_at before update on public.sla_policies
  for each row execute function public.set_updated_at();

-- Useful indexes
create index idx_catalog_published on public.service_catalog_items(is_published);
create index idx_knowledge_status on public.knowledge_articles(status);
create index idx_ticket_approvals_approver on public.ticket_approvals(approver_id, decision);
create index idx_tickets_catalog on public.tickets(catalog_item_id);
create index idx_tickets_sla_due on public.tickets(resolution_due_at);

-- Seed defaults
insert into public.sla_calendars(name, is_default)
values ('Comercial padrão', true);

insert into public.sla_policies(
  name, calendar_id, priority, first_response_minutes, resolution_minutes, precedence
)
select 'Crítica', id, 'critical'::ticket_priority, 30, 240, 10 from public.sla_calendars where is_default
union all
select 'Alta', id, 'high'::ticket_priority, 60, 480, 20 from public.sla_calendars where is_default
union all
select 'Média', id, 'medium'::ticket_priority, 240, 1440, 30 from public.sla_calendars where is_default
union all
select 'Baixa', id, 'low'::ticket_priority, 480, 2880, 40 from public.sla_calendars where is_default;

insert into public.service_catalog_items(
  slug, title, description, instructions, keywords, area, default_priority,
  requires_approval, form_schema, is_published
) values (
  'acesso-sharepoint',
  'Acesso a pasta do SharePoint',
  'Solicite acesso de leitura ou edição a um site ou pasta do SharePoint.',
  'Informe o endereço do site ou pasta e justifique a necessidade de acesso.',
  array['sharepoint','pasta','acesso','permissão','onedrive'],
  'systems',
  'medium',
  true,
  '[
    {"key":"resource_url","label":"Site ou pasta","type":"text","required":true,"placeholder":"https://empresa.sharepoint.com/sites/..."},
    {"key":"access_level","label":"Nível de acesso","type":"select","required":true,"options":["Leitura","Edição"]},
    {"key":"justification","label":"Justificativa","type":"textarea","required":true}
  ]'::jsonb,
  true
);

insert into public.knowledge_categories(name, slug, description)
values ('Acessos e permissões', 'acessos-permissoes', 'Orientações sobre acessos corporativos.');

insert into public.knowledge_articles(
  category_id, title, slug, summary, content, keywords, status, published_at
)
select
  id,
  'Como solicitar acesso ao SharePoint',
  'como-solicitar-acesso-sharepoint',
  'Saiba quais informações são necessárias para pedir acesso a uma pasta ou site.',
  E'Antes de solicitar, copie o endereço completo do site ou pasta e confirme o nível de acesso necessário.\\n\\nA solicitação será enviada ao seu gestor para aprovação. Após aprovada, a equipe de TI realizará a concessão.',
  array['sharepoint','acesso','permissão'],
  'published',
  now()
from public.knowledge_categories where slug = 'acessos-permissoes';
