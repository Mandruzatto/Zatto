-- Ticket chat attachments: private bucket + metadata table.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ticket-attachments',
  'ticket-attachments',
  false,
  10485760, -- 10 MB
  array[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.ticket_comment_attachments (
  id uuid primary key default uuid_generate_v4(),
  comment_id uuid not null references public.ticket_comments(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  file_name text not null,
  file_path text not null unique,
  file_size integer not null default 0,
  mime_type text not null default 'application/octet-stream',
  created_at timestamptz not null default now()
);

create index if not exists ticket_comment_attachments_comment_idx
  on public.ticket_comment_attachments (comment_id);

create index if not exists ticket_comment_attachments_ticket_idx
  on public.ticket_comment_attachments (ticket_id);

alter table public.ticket_comment_attachments enable row level security;

-- Allow empty body when the message is attachments-only.
alter table public.ticket_comments
  alter column content set default '';

-- Collaborators may only comment on their own tickets; analysts on any.
drop policy if exists "Authenticated users can comment on accessible tickets" on public.ticket_comments;
create policy "Authenticated users can comment on accessible tickets"
  on public.ticket_comments for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and (
      not is_internal
      or exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'analyst'
      )
    )
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and (
          t.requester_id = auth.uid()
          or exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'analyst'
          )
        )
    )
  );

create policy "Ticket participants can view attachments"
  on public.ticket_comment_attachments for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'analyst'
    )
    or exists (
      select 1 from public.tickets t
      where t.id = ticket_id and t.requester_id = auth.uid()
    )
  );

create policy "Ticket participants can add attachments"
  on public.ticket_comment_attachments for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.ticket_comments c
      where c.id = comment_id
        and c.author_id = auth.uid()
        and c.ticket_id = ticket_id
    )
  );

-- Storage path layout: {ticket_id}/{comment_id}/{filename}
create policy "Ticket participants can upload attachments"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'ticket-attachments'
    and exists (
      select 1 from public.tickets t
      where t.id::text = (storage.foldername(name))[1]
        and (
          t.requester_id = auth.uid()
          or exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'analyst'
          )
        )
    )
  );

create policy "Ticket participants can read attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and exists (
      select 1 from public.tickets t
      where t.id::text = (storage.foldername(name))[1]
        and (
          t.requester_id = auth.uid()
          or exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'analyst'
          )
        )
    )
  );
