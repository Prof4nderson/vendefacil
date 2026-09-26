-- Schema completo do app de delivery para PostgreSQL (container Docker).
-- Aplicado automaticamente na primeira subida do container (docker compose up -d)
-- ou manualmente:  psql "$DATABASE_URL" -f db/schema.sql

create extension if not exists pgcrypto;

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  image_url text,
  stock int not null default 0,
  available boolean not null default true,
  needs_kitchen boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists daily_menu (
  id uuid primary key default gen_random_uuid(),
  weekday int not null check (weekday between 0 and 6),
  product_id uuid not null references products(id) on delete cascade,
  unique (weekday, product_id)
);

create table if not exists couriers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  vehicle_plate text,
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity,
  customer_name text not null,
  customer_phone text,
  order_type text not null check (order_type in ('delivery','dine_in')),
  address text,
  payment_method text not null,
  status text not null default 'confirmed'
    check (status in ('confirmed','preparing','ready','out_for_delivery','delivered','served','cancelled')),
  total numeric(10,2) not null default 0,
  notes text,
  courier_id uuid references couriers(id),
  courier_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name text not null,
  price numeric(10,2) not null,
  qty int not null default 1,
  needs_kitchen boolean not null default true,
  checked boolean not null default false,
  notes text
);

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_amount numeric(10,2) not null default 0,
  closing_notes text,
  report jsonb
);

create table if not exists cash_entries (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references shifts(id) on delete set null,
  type text not null check (type in ('income','expense')),
  amount numeric(10,2) not null,
  method text,
  description text,
  order_id uuid references orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists route_passwords (
  route text primary key,
  password_hash text not null
);

create table if not exists app_settings (
  key text primary key,
  value jsonb not null
);

create index if not exists orders_status_idx on orders(status);
create index if not exists orders_created_at_idx on orders(created_at desc);
create index if not exists order_items_order_idx on order_items(order_id);
create index if not exists cash_entries_shift_idx on cash_entries(shift_id);

-- ============ dados iniciais ============

insert into categories (name, sort_order) values
  ('Pratos quentes', 1),
  ('Lanches', 2),
  ('Sobremesas', 3),
  ('Bebidas', 4),
  ('Outros', 5)
on conflict (name) do nothing;

insert into products (category_id, name, description, price, image_url, stock, available, needs_kitchen)
select c.id, p.name, p.description, p.price, p.image_url, p.stock, true, p.needs_kitchen
from categories c
join (values
  ('Pratos quentes','Feijoada completa','Feijoada tradicional com arroz, couve e farofa',32.90,'/images/feijoada.jpg',20,true),
  ('Pratos quentes','Strogonoff de frango','Com arroz branco e batata palha',28.90,'/images/strogonoff.jpg',20,true),
  ('Pratos quentes','Escondidinho de carne','Purê de mandioca com carne seca gratinada',29.90,'/images/escondidinho.jpg',15,true),
  ('Pratos quentes','Frango grelhado com legumes','Peito de frango, arroz integral e legumes',26.90,'/images/frango.jpg',15,true),
  ('Pratos quentes','Lasanha à bolonhesa','Lasanha caseira com queijo gratinado',30.90,'/images/lasanha.jpg',12,true),
  ('Lanches','X-Burguer','Pão, hambúrguer, queijo, alface e tomate',18.90,'/images/xburguer.jpg',30,true),
  ('Lanches','Misto quente','Pão de forma com presunto e queijo',9.90,'/images/misto.jpg',25,true),
  ('Sobremesas','Pudim de leite','Pudim caseiro com calda de caramelo',8.90,'/images/pudim.jpg',10,true),
  ('Sobremesas','Brownie com sorvete','Brownie de chocolate com bola de sorvete',14.90,'/images/brownie.jpg',10,true),
  ('Bebidas','Refrigerante lata','Coca, Guaraná ou Fanta',6.00,null,50,false),
  ('Bebidas','Suco natural 500ml','Laranja, maracujá ou manga',9.00,null,20,false),
  ('Bebidas','Água mineral 500ml','Com ou sem gás',4.00,null,60,false),
  ('Outros','Molho extra da casa','Molho especial 50ml',2.50,null,40,false),
  ('Outros','Embalagem para viagem','Marmita térmica descartável',3.00,null,50,false)
) as p(cat,name,description,price,image_url,stock,needs_kitchen) on c.name = p.cat
where not exists (select 1 from products x where x.name = p.name);

insert into daily_menu (weekday, product_id)
select v.weekday, d.pid
from (
  select p.id as pid, p.name
  from products p join categories c on c.id = p.category_id
  where c.name = 'Pratos quentes'
) d
join (values
  ('Feijoada completa', 6), ('Feijoada completa', 0),
  ('Strogonoff de frango', 2), ('Strogonoff de frango', 5),
  ('Escondidinho de carne', 3),
  ('Frango grelhado com legumes', 1), ('Frango grelhado com legumes', 4),
  ('Lasanha à bolonhesa', 3), ('Lasanha à bolonhesa', 5)
) as v(nm, weekday) on v.nm = d.name
on conflict (weekday, product_id) do nothing;

-- senhas iniciais (sha256): admin123 / cozinha123 / entrega123 / caixa123
insert into route_passwords (route, password_hash) values
  ('admin','240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'),
  ('cozinha','50263d56d9e862db1767204ed2fc5c264cfe2abfbd39b0bb3a7bd25ee78dbbe9'),
  ('entrega','0dc492621a834e51988b6840f9e1b0f095847deaf93b7543c16429e11644dcfd'),
  ('caixa','59c7c57e6516f4a4ae85214acbd322b724cb755806c4183587a5007c9ca3af23')
on conflict (route) do nothing;

-- entregador de exemplo (senha: 1234)
insert into couriers (name, phone, email, vehicle_plate, password_hash)
select 'Carlos Entregador','11999990000','carlos@exemplo.com','ABC1D23',
       '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'
where not exists (select 1 from couriers);

insert into app_settings (key, value) values
  ('restaurant_name', '"Sabor da Casa"'),
  ('primary_color', '"#00d5ff"'),
  ('logo_url', 'null')
on conflict (key) do nothing;

-- ============ VendeFácil SaaS: contas, multiusuário e estoque ============
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  login text not null unique,
  password_hash text not null,
  whatsapp text not null,
  email text not null unique,
  role text not null default 'operator' check (role in ('owner','manager','operator')),
  verification_pin text,
  pin_expires_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table products add column if not exists purchase_price numeric(10,2) not null default 0;
alter table products add column if not exists min_stock int not null default 5;
alter table products add column if not exists stock_control boolean not null default true;
alter table shifts add column if not exists workspace_id uuid references workspaces(id);
alter table orders add column if not exists workspace_id uuid references workspaces(id);
alter table products add column if not exists workspace_id uuid references workspaces(id);
create index if not exists app_users_email_idx on app_users(lower(email));
create index if not exists products_workspace_idx on products(workspace_id);
create index if not exists orders_workspace_idx on orders(workspace_id);

update products set purchase_price = round((price * 0.45)::numeric, 2) where purchase_price = 0;
update products set min_stock = 5 where min_stock is null;


-- ============ Catálogo geral, clientes e fiado ============
create table if not exists catalog_suggestions (
  id uuid primary key default gen_random_uuid(),
  category_name text not null,
  name text not null,
  description text,
  suggested_purchase_price numeric(10,2) not null default 0,
  suggested_price numeric(10,2) not null default 0,
  icon text not null default 'Package',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (category_name, name)
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  credit_balance numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

alter table orders add column if not exists customer_id uuid references customers(id) on delete set null;
alter table orders add column if not exists amount_paid numeric(10,2) not null default 0;
alter table orders add column if not exists credit_amount numeric(10,2) not null default 0;
alter table orders add column if not exists payment_status text not null default 'paid' check (payment_status in ('paid','partial','credit'));
create index if not exists customers_credit_idx on customers(credit_balance desc);
create index if not exists orders_customer_idx on orders(customer_id, created_at desc);

insert into catalog_suggestions (category_name, name, description, suggested_purchase_price, suggested_price, icon) values
  ('Salgados','Coxinha cremosa','Frango com catupiry',3.20,7.50,'🍗'),
  ('Salgados','Pastel de carne','Pastel frito na hora',3.00,7.00,'🥟'),
  ('Bebidas','Água mineral 500ml','Com ou sem gás',1.50,4.00,'💧'),
  ('Bebidas','Refrigerante lata','Coca, Guaraná ou Fanta',3.00,6.00,'🥤'),
  ('Doces','Brigadeiro','Unidade',1.20,3.50,'🍫'),
  ('Doces','Brownie da casa','Chocolate intenso',4.00,9.90,'🍪'),
  ('Lanches','Misto quente','Presunto e queijo na chapa',4.50,9.90,'🥪'),
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
on conflict (category_name, name) do nothing;

insert into catalog_suggestions (category_name, name, description, suggested_price, icon) values
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
on conflict (category_name, name) do nothing;


-- ============ Vendas administráveis ============
alter table cash_entries add column if not exists voided boolean not null default false;
create index if not exists orders_cancelled_idx on orders(status, created_at desc);
