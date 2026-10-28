-- Reset one-time autorizado: app_users recebe a credencial temporária 123456;
-- sysadmin passa para SysAdm2026. Armazenamos apenas hashes SHA-256, compatíveis
-- com a implementação atual. O registro de versão impede reaplicação acidental.
begin;

create table if not exists app_schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists sysadm_credentials (
  id smallint primary key check (id=1),
  password_hash text not null,
  updated_at timestamptz not null default now()
);

with applied as (
  insert into app_schema_migrations(version)
  values ('20261028_password_reset')
  on conflict do nothing
  returning version
),
users_reset as (
  update app_users
  set password_hash='8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'
  where exists (select 1 from applied)
  returning id
),
sysadmin_reset as (
  insert into sysadm_credentials(id,password_hash,updated_at)
  select 1,'0756cbd33bb23eb3c467b8564057c9f693d5fc4b6854de0b8365efdf25c25eb0',now()
  where exists (select 1 from applied)
  on conflict (id) do update
    set password_hash=excluded.password_hash, updated_at=now()
  returning id
)
select
  (select count(*) from users_reset) as reset_user_count,
  (select count(*) from sysadmin_reset) as reset_sysadmin_count;

commit;
