-- Isolamento completo por workspace. Execute uma vez em banco existente.
begin;
create table if not exists workspaces (id uuid primary key default gen_random_uuid(), name text not null, owner_user_id uuid, created_at timestamptz not null default now());
insert into workspaces (name) select 'Operação migrada' where not exists (select 1 from workspaces);
insert into catalog_suggestions (category_name,name,description,suggested_purchase_price,suggested_price,icon) values
  ('Pratos quentes','Feijoada completa','Feijoada tradicional com arroz, couve e farofa',14.80,32.90,'🍲'),
  ('Pratos quentes','Strogonoff de frango','Com arroz branco e batata palha',13.00,28.90,'🍛'),
  ('Pratos quentes','Escondidinho de carne','Purê de mandioca com carne seca gratinada',13.50,29.90,'🍽️'),
  ('Pratos quentes','Frango grelhado com legumes','Peito de frango, arroz integral e legumes',12.10,26.90,'🍗'),
  ('Pratos quentes','Lasanha à bolonhesa','Lasanha caseira com queijo gratinado',13.90,30.90,'🍝'),
  ('Lanches','X-Burguer','Pão, hambúrguer, queijo, alface e tomate',8.50,18.90,'🍔'),
  ('Sobremesas','Pudim de leite','Pudim caseiro com calda de caramelo',4.00,8.90,'🍮'),
  ('Sobremesas','Brownie com sorvete','Brownie de chocolate com bola de sorvete',6.70,14.90,'🍨'),
  ('Bebidas','Suco natural 500ml','Laranja, maracujá ou manga',4.05,9.00,'🧃'),
  ('Bebidas','Água mineral 500ml','Com ou sem gás',1.80,4.00,'💧'),
  ('Outros','Molho extra da casa','Molho especial 50ml',1.10,2.50,'🥣'),
  ('Outros','Embalagem para viagem','Marmita térmica descartável',1.35,3.00,'📦')
on conflict (category_name,name) do nothing;

do $$ declare w uuid; begin select id into w from workspaces order by created_at limit 1;
  alter table categories add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
  alter table daily_menu add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
  alter table couriers add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
  alter table cash_entries add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
  alter table app_settings add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
  alter table route_passwords add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
  update categories set workspace_id=w where workspace_id is null;
  update products set workspace_id=w where workspace_id is null;
  update daily_menu set workspace_id=w where workspace_id is null;
  update couriers set workspace_id=w where workspace_id is null;
  update orders set workspace_id=w where workspace_id is null;
  update shifts set workspace_id=w where workspace_id is null;
  update customers set workspace_id=w where workspace_id is null;
  update cash_entries set workspace_id=w where workspace_id is null;
  update app_settings set workspace_id=w where workspace_id is null;
  update route_passwords set workspace_id=w where workspace_id is null;
end $$;

alter table categories alter column workspace_id set not null;
alter table products alter column workspace_id set not null;
alter table daily_menu alter column workspace_id set not null;
alter table couriers alter column workspace_id set not null;
alter table orders alter column workspace_id set not null;
alter table shifts alter column workspace_id set not null;
alter table customers alter column workspace_id set not null;
alter table cash_entries alter column workspace_id set not null;
alter table app_settings alter column workspace_id set not null;
alter table route_passwords alter column workspace_id set not null;
alter table categories drop constraint if exists categories_name_key;
alter table categories add constraint categories_workspace_name_key unique (workspace_id,name);
alter table daily_menu drop constraint if exists daily_menu_weekday_product_id_key;
alter table daily_menu add constraint daily_menu_workspace_weekday_product_key unique (workspace_id,weekday,product_id);
alter table app_settings drop constraint if exists app_settings_pkey;
alter table app_settings add primary key (workspace_id,key);
alter table route_passwords drop constraint if exists route_passwords_pkey;
alter table route_passwords add primary key (workspace_id,route);
create index if not exists categories_workspace_idx on categories(workspace_id);
create index if not exists daily_menu_workspace_idx on daily_menu(workspace_id);
create index if not exists couriers_workspace_idx on couriers(workspace_id);
create index if not exists cash_entries_workspace_idx on cash_entries(workspace_id);
create index if not exists app_settings_workspace_idx on app_settings(workspace_id);
create index if not exists route_passwords_workspace_idx on route_passwords(workspace_id);
commit;
