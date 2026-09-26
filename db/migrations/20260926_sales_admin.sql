alter table cash_entries add column if not exists voided boolean not null default false;
create index if not exists orders_cancelled_idx on orders(status, created_at desc);
