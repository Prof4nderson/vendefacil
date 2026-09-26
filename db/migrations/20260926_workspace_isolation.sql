-- Isolamento completo por workspace. Execute uma vez em banco existente.
begin;
create table if not exists workspaces (id uuid primary key default gen_random_uuid(), name text not null, owner_user_id uuid, created_at timestamptz not null default now());
insert into workspaces (name) select 'Operação migrada' where not exists (select 1 from workspaces);
create table if not exists catalog_suggestions (
  id uuid primary key default gen_random_uuid(), category_name text not null, name text not null,
  description text, suggested_purchase_price numeric(10,2) not null default 0,
  suggested_price numeric(10,2) not null default 0, icon text not null default 'Package',
  active boolean not null default true, created_at timestamptz not null default now(),
  unique(category_name,name)
);
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

insert into catalog_suggestions (category_name,name,description,suggested_price,icon) values
  ('Bebidas','Refrigerante Coca-Cola 350ml','Lata de Coca-Cola sabor original 350ml',5.50,'🥤'),
  ('Bebidas','Refrigerante Guaraná Antarctica 350ml','Lata de Guaraná Antarctica 350ml',4.80,'🥤'),
  ('Bebidas','Refrigerante Coca-Cola Zero 350ml','Lata de Coca-Cola Zero Açúcar 350ml',5.50,'🥤'),
  ('Bebidas','Suco Del Valle Laranja 1L','Suco pronto para beber sabor laranja 1 Litro',8.90,'🧃'),
  ('Bebidas','Água Mineral Sem Gás 500ml','Garrafa de água mineral sem gás 500ml',2.50,'💧'),
  ('Bebidas','Água Mineral Com Gás 500ml','Garrafa de água mineral com gás 500ml',3.00,'💧'),
  ('Bebidas','Isotônico Red Bull 250ml','Energético Red Bull Energy Drink 250ml',11.90,'🥤'),
  ('Cervejas','Cerveja Heineken Long Neck 330ml','Garrafa Heineken Premium Pilsen 330ml',8.50,'🍺'),
  ('Cervejas','Cerveja Amstel Lata 350ml','Cerveja Lager Amstel lata 350ml',4.20,'🍺'),
  ('Cervejas','Cerveja Brahma Duplo Malte 350ml','Cerveja Brahma Duplo Malte lata 350ml',4.50,'🍺'),
  ('Cervejas','Cerveja Budweiser 330ml Long Neck','Cerveja Budweiser American Lager 330ml',7.90,'🍺'),
  ('Cervejas','Cerveja Stella Artois 330ml','Cerveja Premium Lager Stella Artois 330ml',8.20,'🍺'),
  ('Salgadinhos','Salgadinho Doritos Queijo Nacho 84g','Salgadinho de milho sabor queijo nacho 84g',8.90,'🍿'),
  ('Salgadinhos','Salgadinho Cheetos Lua Queijo 57g','Salgadinho Cheetos sabor queijo 57g',4.90,'🍿'),
  ('Salgadinhos','Batata Ruffles Original 76g','Batata frita ondulada Ruffles sabor sal 76g',8.50,'🍿'),
  ('Salgadinhos','Amendoim Japones Pettiz 120g','Amendoim tipo japonês crocante 120g',5.90,'🥜'),
  ('Biscoitos','Biscoito Oreo Recheado 90g','Biscoito de chocolate com recheio de baunilha 90g',4.50,'🍪'),
  ('Biscoitos','Biscoito Club Social Original 141g','Biscoito salgado pacote com 6 unidades',6.20,'🍪'),
  ('Biscoitos','Biscoito Passatempo Recheado Chocolate 130g','Biscoito recheado sabor chocolate 130g',3.90,'🍪'),
  ('Biscoitos','Chocolate Bis Ao Leite 126g','Wafer coberto com chocolate ao leite Bis',7.50,'🍫'),
  ('Biscoitos','Chocolate KitKat Milk 41,5g','Chocolate ao leite com wafer KitKat',4.20,'🍫'),
  ('Alimentos','Pão de Forma Tradicional Wickbold 500g','Pão de forma fatiado tradicional 500g',9.50,'🍞'),
  ('Alimentos','Leite Integral Piracanjuba 1L','Leite UHT integral caixa de 1 Litro',5.80,'🥛'),
  ('Alimentos','Café Torrado e Moído Pilão 500g','Café tradicional torrado e moído a vácuo 500g',18.90,'☕'),
  ('Alimentos','Açúcar Refinado União 1kg','Açúcar refinado especial pacote de 1kg',4.90,'🧂')
on conflict (category_name,name) do nothing;

do $$ declare w uuid; begin select id into w from workspaces order by created_at limit 1;
  alter table categories add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
  alter table products add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
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

update app_users set password_hash='240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9' where lower(name)='davi' or lower(login)='davi';

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
insert into route_passwords(workspace_id,route,password_hash)
select workspace_id,'admin','240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'
from app_users where lower(name)='davi' or lower(login)='davi'
on conflict(workspace_id,route) do update set password_hash=excluded.password_hash;
create index if not exists categories_workspace_idx on categories(workspace_id);
create index if not exists daily_menu_workspace_idx on daily_menu(workspace_id);
create index if not exists couriers_workspace_idx on couriers(workspace_id);
create index if not exists cash_entries_workspace_idx on cash_entries(workspace_id);
create index if not exists app_settings_workspace_idx on app_settings(workspace_id);
create index if not exists route_passwords_workspace_idx on route_passwords(workspace_id);
commit;
