import { createServerFn } from "@tanstack/react-start";
import { q, tx } from "./db.server";

const requiredTables = [
  "orders",
  "order_items",
  "products",
  "customers",
  "cash_entries",
  "shifts",
  "catalog_suggestions",
];
const requiredColumns: Record<string, string[]> = {
  orders: ["customer_id", "amount_paid", "credit_amount", "payment_status"],
  products: ["purchase_price", "min_stock", "stock_control"],
  cash_entries: ["voided"],
  shifts: ["workspace_id"],
  categories: ["workspace_id"],
  daily_menu: ["workspace_id"],
  couriers: ["workspace_id"],
  app_settings: ["workspace_id"],
  route_passwords: ["workspace_id"],
};

export type SalesSchemaStatus = {
  connected: boolean;
  ok: boolean;
  missingTables: string[];
  missingColumns: string[];
  message?: string;
};

async function inspectSalesSchema(): Promise<SalesSchemaStatus> {
  try {
    const tables = await q<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema='public' and table_name = any($1::text[])",
      [requiredTables],
    );
    const existingTables = new Set(tables.map((row) => row.table_name));
    const missingTables = requiredTables.filter((name) => !existingTables.has(name));
    const pairs = Object.entries(requiredColumns).flatMap(([table, columns]) =>
      columns.map((column) => ({ table, column })),
    );
    const columns = await q<{ table_name: string; column_name: string }>(
      "select table_name,column_name from information_schema.columns where table_schema='public' and (table_name,column_name) in (select * from unnest($1::text[], $2::text[]))",
      [pairs.map((x) => x.table), pairs.map((x) => x.column)],
    );
    const existingColumns = new Set(columns.map((row) => `${row.table_name}.${row.column_name}`));
    const missingColumns = pairs
      .filter((pair) => !existingColumns.has(`${pair.table}.${pair.column}`))
      .map((pair) => `${pair.table}.${pair.column}`);
    return {
      connected: true,
      ok: missingTables.length === 0 && missingColumns.length === 0,
      missingTables,
      missingColumns,
    };
  } catch (error) {
    return {
      connected: false,
      ok: false,
      missingTables: [],
      missingColumns: [],
      message: error instanceof Error ? error.message : "Não foi possível conectar ao banco",
    };
  }
}

export const verifySalesSchema = createServerFn({ method: "GET" }).handler(() =>
  inspectSalesSchema(),
);

export const migrateSalesSchema = createServerFn({ method: "POST" }).handler(async () => {
  await tx(async (client) => {
    await client.query("create extension if not exists pgcrypto");
    await client.query("alter table app_users add column if not exists address text");
    await client.query("alter table app_users add column if not exists cpf_cnpj text");
    await client.query("alter table app_users add column if not exists cep text");
    await client.query("alter table app_users add column if not exists city text");
    await client.query("alter table app_users add column if not exists state text");
    await client.query("alter table orders add column if not exists cancellation_note text");
    await client.query(
      "create table if not exists workspaces (id uuid primary key default gen_random_uuid(), name text not null, owner_user_id uuid, created_at timestamptz not null default now())",
    );
    await client.query(
      "create table if not exists customers (id uuid primary key default gen_random_uuid(), workspace_id uuid references workspaces(id) on delete cascade, name text not null, phone text, email text, credit_balance numeric(10,2) not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,name))",
    );
    await client.query(
      "create table if not exists catalog_suggestions (id uuid primary key default gen_random_uuid(), category_name text not null, name text not null, description text, suggested_purchase_price numeric(10,2) not null default 0, suggested_price numeric(10,2) not null default 0, icon text not null default 'Package', active boolean not null default true, created_at timestamptz not null default now(), unique(category_name,name))",
    );
    await client.query(`insert into catalog_suggestions
      (category_name,name,description,suggested_purchase_price,suggested_price,icon) values
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
      on conflict (category_name,name) do nothing`);
    await client.query(
      "alter table products add column if not exists purchase_price numeric(10,2) not null default 0",
    );
    await client.query(
      "alter table products add column if not exists min_stock int not null default 5",
    );
    await client.query(
      "alter table products add column if not exists stock_control boolean not null default true",
    );
    await client.query(
      "alter table orders add column if not exists workspace_id uuid references workspaces(id)",
    );
    await client.query(
      "alter table orders add column if not exists customer_id uuid references customers(id) on delete set null",
    );
    await client.query(
      "alter table orders add column if not exists amount_paid numeric(10,2) not null default 0",
    );
    await client.query(
      "alter table orders add column if not exists credit_amount numeric(10,2) not null default 0",
    );
    await client.query(
      "alter table orders add column if not exists payment_status text not null default 'paid'",
    );
    await client.query(
      "alter table shifts add column if not exists workspace_id uuid references workspaces(id)",
    );
    await client.query(
      "alter table cash_entries add column if not exists voided boolean not null default false",
    );
    await client.query("alter table categories add column if not exists workspace_id uuid references workspaces(id) on delete cascade");
    await client.query("alter table daily_menu add column if not exists workspace_id uuid references workspaces(id) on delete cascade");
    await client.query("alter table couriers add column if not exists workspace_id uuid references workspaces(id) on delete cascade");
    await client.query("alter table cash_entries add column if not exists workspace_id uuid references workspaces(id) on delete cascade");
    await client.query("alter table app_settings add column if not exists workspace_id uuid references workspaces(id) on delete cascade");
    await client.query("alter table route_passwords add column if not exists workspace_id uuid references workspaces(id) on delete cascade");
    await client.query("insert into workspaces(name) select 'Operação migrada' where not exists (select 1 from workspaces)");
    await client.query(`do $$ declare w uuid; begin select id into w from workspaces order by created_at limit 1;
      update categories set workspace_id=w where workspace_id is null; update products set workspace_id=w where workspace_id is null;
      update daily_menu set workspace_id=w where workspace_id is null; update couriers set workspace_id=w where workspace_id is null;
      update orders set workspace_id=w where workspace_id is null; update shifts set workspace_id=w where workspace_id is null;
      update customers set workspace_id=w where workspace_id is null; update cash_entries set workspace_id=w where workspace_id is null;
      update app_settings set workspace_id=w where workspace_id is null; update route_passwords set workspace_id=w where workspace_id is null;
    end $$`);
    await client.query(
      "update app_users set password_hash='240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9' where lower(name)='davi' or lower(login)='davi'",
    );
    await client.query("create index if not exists categories_workspace_idx on categories(workspace_id)");
    await client.query("create index if not exists daily_menu_workspace_idx on daily_menu(workspace_id)");
    await client.query("create index if not exists app_settings_workspace_idx on app_settings(workspace_id)");
    await client.query("create index if not exists route_passwords_workspace_idx on route_passwords(workspace_id)");
    await client.query("alter table categories drop constraint if exists categories_name_key");
    await client.query("alter table categories add constraint categories_workspace_name_key unique(workspace_id,name)");
    await client.query("alter table daily_menu drop constraint if exists daily_menu_weekday_product_id_key");
    await client.query("alter table daily_menu add constraint daily_menu_workspace_weekday_product_key unique(workspace_id,weekday,product_id)");
    await client.query("alter table app_settings drop constraint if exists app_settings_pkey");
    await client.query("alter table app_settings add primary key(workspace_id,key)");
    await client.query("alter table route_passwords drop constraint if exists route_passwords_pkey");
    await client.query("alter table route_passwords add primary key(workspace_id,route)");
    await client.query(
      `insert into route_passwords(workspace_id,route,password_hash)
       select workspace_id,'admin','240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'
       from app_users where lower(name)='davi' or lower(login)='davi'
       on conflict(workspace_id,route) do update set password_hash=excluded.password_hash`,
    );
    await client.query(
      "alter table cash_entries alter column amount type numeric(10,2) using amount::numeric",
    );
    await client.query(
      "create index if not exists orders_customer_idx on orders(customer_id,created_at desc)",
    );
    await client.query(
      "create index if not exists customers_credit_idx on customers(credit_balance desc)",
    );
  });
  return inspectSalesSchema();
});
