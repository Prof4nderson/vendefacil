create table if not exists sysadm_credentials (
  id smallint primary key check (id=1),
  password_hash text not null,
  updated_at timestamptz not null default now()
);
insert into sysadm_credentials(id,password_hash) values (1,'0756cbd33bb23eb3c467b8564057c9f693d5fc4b6854de0b8365efdf25c25eb0') on conflict (id) do nothing;
alter table app_users add column if not exists status text not null default 'active';
alter table app_users add column if not exists status_note text;
alter table app_users add column if not exists last_login_at timestamptz;
alter table app_users drop constraint if exists app_users_status_check;
alter table app_users add constraint app_users_status_check check (status in ('active','disabled','suspended'));
create table if not exists system_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists system_messages_user_idx on system_messages(user_id,read_at,created_at);
alter table catalog_suggestions add column if not exists image_url text;
alter table products add column if not exists catalog_suggestion_id uuid references catalog_suggestions(id) on delete set null;
create index if not exists products_catalog_suggestion_idx on products(catalog_suggestion_id);
