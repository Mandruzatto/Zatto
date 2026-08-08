alter type ticket_status rename value 'pending_response' to 'pending';
alter table tickets add column pending_reason text;
