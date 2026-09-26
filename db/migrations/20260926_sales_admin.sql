-- Migração consolidada para bancos existentes do VendeFácil.
create extension if not exists pgcrypto;
alter table app_users add column if not exists address text;
alter table app_users add column if not exists cpf_cnpj text;
alter table app_users add column if not exists cep text;
alter table app_users add column if not exists city text;
alter table app_users add column if not exists state text;
alter table orders add column if not exists cancellation_note text;

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(), name text not null,
  owner_user_id uuid, created_at timestamptz not null default now()
);
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null, phone text, email text,
  credit_balance numeric(10,2) not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);
create table if not exists catalog_suggestions (
  id uuid primary key default gen_random_uuid(), category_name text not null, name text not null,
  description text, suggested_purchase_price numeric(10,2) not null default 0,
  suggested_price numeric(10,2) not null default 0, icon text not null default 'Package',
  active boolean not null default true, created_at timestamptz not null default now(),
  unique (category_name, name)
);
alter table products add column if not exists purchase_price numeric(10,2) not null default 0;
alter table products add column if not exists min_stock int not null default 5;
alter table products add column if not exists stock_control boolean not null default true;
alter table orders add column if not exists workspace_id uuid references workspaces(id);
alter table orders add column if not exists customer_id uuid references customers(id) on delete set null;
alter table orders add column if not exists amount_paid numeric(10,2) not null default 0;
alter table orders add column if not exists credit_amount numeric(10,2) not null default 0;
alter table orders add column if not exists payment_status text not null default 'paid';
alter table shifts add column if not exists workspace_id uuid references workspaces(id);
alter table cash_entries add column if not exists voided boolean not null default false;
alter table cash_entries alter column amount type numeric(10,2) using amount::numeric;
create index if not exists orders_cancelled_idx on orders(status, created_at desc);
create index if not exists orders_customer_idx on orders(customer_id, created_at desc);
create index if not exists customers_credit_idx on customers(credit_balance desc);

insert into catalog_suggestions (category_name,name,description,suggested_purchase_price,suggested_price,icon) values
('Salgados','Coxinha cremosa','Frango com catupiry',3.20,7.50,'🍗'),
('Salgados','Pastel de carne','Pastel frito na hora',3.00,7.00,'🥟'),
('Bebidas','Água mineral 500ml','Com ou sem gás',1.50,4.00,'💧'),
('Bebidas','Refrigerante lata','Coca, Guaraná ou Fanta',3.00,6.00,'🥤'),
('Doces','Brigadeiro','Unidade',1.20,3.50,'🍫'),
('Doces','Brownie da casa','Chocolate intenso',4.00,9.90,'🍪'),
('Lanches','Misto quente','Presunto e queijo na chapa',4.50,9.90,'🥪')
on conflict (category_name,name) do nothing;
