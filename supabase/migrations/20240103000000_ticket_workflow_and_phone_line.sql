-- New ticket statuses (Freshservice-style)
alter table tickets alter column status drop default;
alter table tickets alter column status type text;
drop type ticket_status;
create type ticket_status as enum ('open','in_progress','pending_response','scheduled','resolved','closed');
update tickets set status = 'pending_response' where status = 'waiting';
alter table tickets alter column status type ticket_status using status::ticket_status;
alter table tickets alter column status set default 'open';

-- Ticket type (incident/request) and area (systems/infrastructure), replacing category
create type ticket_type as enum ('incident','request');
create type ticket_area as enum ('systems','infrastructure');
alter table tickets add column type ticket_type not null default 'incident';
alter table tickets add column area ticket_area;
alter table tickets drop column category;
drop type ticket_category;

-- Phone line / chip number on assets (searchable)
alter table assets add column phone_line text;
