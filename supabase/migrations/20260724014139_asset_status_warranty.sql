-- New asset statuses: in_use, stock, returned, maintenance, disposed
alter table assets alter column status drop default;
alter table assets alter column status type text;
drop type asset_status;
create type asset_status as enum ('in_use', 'stock', 'returned', 'maintenance', 'disposed');
update assets set status = 'in_use' where status = 'active';
update assets set status = 'stock' where status = 'inactive';
update assets set status = 'disposed' where status = 'retired';
alter table assets alter column status type asset_status using status::asset_status;
alter table assets alter column status set default 'stock';

-- Warranty tracking
alter table assets add column warranty_end_date date;
