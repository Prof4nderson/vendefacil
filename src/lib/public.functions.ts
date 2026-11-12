import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CategoryRow, OrderItemRow, OrderRow, ProductRow } from "./rows";
import { getOptionalTenantContext, getTenantContext } from "./tenant.server";

function todayWeekday() {
  const sp = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return sp.getDay();
}

export const getMenuData = createServerFn({ method: "GET" }).handler(async () => {
  const ctx = await getOptionalTenantContext();
  const weekday = todayWeekday();
  if (!ctx) {
    const { getFallbackMenu } = await import("./fallback-store.server");
    return { ...(await getFallbackMenu(weekday)), setupRequired: false };
  }
  const { q } = await import("./db.server");
  const [categories, products, daily, setupCounts] = await Promise.all([
    q<CategoryRow>(
      "select * from categories where workspace_id=$1 and active=true order by sort_order, name",
      [ctx.workspaceId],
    ),
    q<ProductRow>("select * from products where workspace_id=$1 and available=true order by name", [
      ctx.workspaceId,
    ]),
    q<{ product_id: string }>(
      "select product_id from daily_menu where workspace_id=$1 and weekday=$2",
      [ctx.workspaceId, weekday],
    ),
    q<{ categories: number | string; products: number | string }>(
      "select (select count(*) from categories where workspace_id=$1) as categories, (select count(*) from products where workspace_id=$1) as products",
      [ctx.workspaceId],
    ),
  ]);
  const counts = setupCounts[0];
  const setupRequired = !counts || Number(counts.categories) === 0 || Number(counts.products) === 0;
  return { categories, products, dailyIds: daily.map((d) => d.product_id), weekday, setupRequired };
});

export const getOrder = createServerFn({ method: "GET" })
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();
    const { q, q1 } = await import("./db.server");
    const order = await q1<OrderRow>("select * from orders where id=$1 and workspace_id=$2", [
      data.id,
      ctx.workspaceId,
    ]);
    if (!order) throw new Error("Pedido não encontrado");
    const items = await q<OrderItemRow>("select * from order_items where order_id=$1", [data.id]);
    return { order, items };
  });

export const getSettings = createServerFn({ method: "GET" }).handler(async () => {
  const ctx = await getOptionalTenantContext();
  if (!ctx)
    return {
      restaurant_name: "VendeFácil",
      primary_color: "#00d5ff",
      logo_url: null as string | null,
    };
  const { q } = await import("./db.server");
  const rows = await q<{ key: string; value: unknown }>(
    "select key,value from app_settings where workspace_id=$1",
    [ctx.workspaceId],
  );
  const map: Record<string, unknown> = {};
  for (const row of rows) map[row.key] = row.value;
  return {
    restaurant_name: (map["restaurant_name"] as string) ?? "VendeFácil",
    primary_color: (map["primary_color"] as string) ?? "#00d5ff",
    logo_url: (map["logo_url"] as string | null) ?? null,
  };
});

const publicWorkspaceId = z.string().uuid();

/** Lista os estabelecimentos que possuem catálogo público disponível. */
export const getPublicVendors = createServerFn({ method: "GET" }).handler(async () => {
  const { q } = await import("./db.server");
  return q<{
    id: string;
    workspace_id: string;
    name: string;
    restaurant_name: string;
    primary_color: string;
    logo_url: string | null;
  }>(
    `select w.id,w.id as workspace_id,w.name,
      coalesce((select s.value #>> '{}' from app_settings s where s.workspace_id=w.id and s.key='restaurant_name'),'VendeFácil') as restaurant_name,
      coalesce((select s.value #>> '{}' from app_settings s where s.workspace_id=w.id and s.key='primary_color'),'#00d5ff') as primary_color,
      (select s.value #>> '{}' from app_settings s where s.workspace_id=w.id and s.key='logo_url') as logo_url
     from workspaces w
     where exists (select 1 from products p where p.workspace_id=w.id and p.available=true)
     order by lower(w.name)`,
  );
});

const publicMenuInput = z.object({ workspaceId: publicWorkspaceId });

/** Retorna o catálogo e a identidade visual de um estabelecimento sem autenticação. */
export const getPublicVendorMenu = createServerFn({ method: "GET" })
  .validator((data) => publicMenuInput.parse(data))
  .handler(async ({ data }) => {
    const { q, q1 } = await import("./db.server");
    const workspace = await q1<{ id: string; name: string }>(
      "select id,name from workspaces where id=$1",
      [data.workspaceId],
    );
    if (!workspace) throw new Error("Estabelecimento não encontrado");
    const [categories, products, settings] = await Promise.all([
      q<CategoryRow>(
        "select id,name,sort_order,active,created_at from categories where workspace_id=$1 and active=true order by sort_order,name",
        [data.workspaceId],
      ),
      q<ProductRow>(
        "select id,category_id,name,description,price,image_url,stock,available,needs_kitchen,created_at from products where workspace_id=$1 and available=true and stock>0 order by name",
        [data.workspaceId],
      ),
      q<{ key: string; value: unknown }>(
        "select key,value from app_settings where workspace_id=$1",
        [data.workspaceId],
      ),
    ]);
    const settingMap: Record<string, unknown> = {};
    for (const setting of settings) settingMap[setting.key] = setting.value;
    return {
      workspace,
      categories,
      products,
      settings: {
        restaurant_name: (settingMap["restaurant_name"] as string) ?? workspace.name,
        primary_color: (settingMap["primary_color"] as string) ?? "#00d5ff",
        logo_url: (settingMap["logo_url"] as string | null) ?? null,
      },
    };
  });

const publicOrderInput = z.object({
  workspaceId: publicWorkspaceId,
  customerName: z.string().min(2).optional(),
  customer_name: z.string().min(2).optional(),
  customerPhone: z.string().min(8).optional(),
  customer_phone: z.string().min(8).optional(),
  orderType: z.enum(["delivery", "dine_in"]).optional(),
  order_type: z.enum(["delivery", "dine_in"]).optional(),
  address: z.string().max(500).optional(),
  paymentMethod: z.string().min(2).optional(),
  payment_method: z.string().min(2).optional(),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid().optional(),
        product_id: z.string().uuid().optional(),
        qty: z.number().int().min(1),
        notes: z.string().max(300).optional(),
      }),
    )
    .min(1),
});

/** Cria um pedido pelo cardápio público, validando estoque dentro de uma transação. */
export const createPublicOrder = createServerFn({ method: "POST" })
  .validator((data) => publicOrderInput.parse(data))
  .handler(async ({ data }) => {
    const customerName = (data.customerName ?? data.customer_name ?? "").trim();
    const customerPhone = (data.customerPhone ?? data.customer_phone ?? "").trim();
    const orderType = data.orderType ?? data.order_type ?? "delivery";
    const paymentMethod = data.paymentMethod ?? data.payment_method ?? "Pendente";
    if (customerName.length < 2) throw new Error("Informe o nome do cliente");
    if (customerPhone.length < 8) throw new Error("Informe um telefone válido");
    if (orderType === "delivery" && !data.address?.trim())
      throw new Error("Informe o endereço de entrega");

    const items = data.items.map((item) => ({
      productId: item.productId ?? item.product_id,
      qty: item.qty,
      notes: item.notes,
    }));
    if (items.some((item) => !item.productId)) throw new Error("Produto inválido");
    const { tx } = await import("./db.server");
    return tx(async (client) => {
      const ids = [...new Set(items.map((item) => item.productId!))];
      const products = (
        await client.query<{
          id: string;
          name: string;
          price: number;
          stock: number;
          needs_kitchen: boolean;
        }>(
          "select id,name,price,stock,needs_kitchen from products where workspace_id=$1 and id=any($2::uuid[]) and available=true for update",
          [data.workspaceId, ids],
        )
      ).rows;
      if (products.length !== ids.length) throw new Error("Algum produto não está disponível");
      for (const item of items) {
        const product = products.find((row) => row.id === item.productId)!;
        if (product.stock < item.qty) throw new Error(`Estoque insuficiente: ${product.name}`);
      }
      const total = items.reduce(
        (sum, item) =>
          sum + Number(products.find((row) => row.id === item.productId)!.price) * item.qty,
        0,
      );
      const status = products.some((product) => product.needs_kitchen)
        ? "confirmed"
        : orderType === "delivery"
          ? "ready"
          : "served";
      const order = (
        await client.query<{ id: string; order_number: number }>(
          `insert into orders (workspace_id,customer_name,customer_phone,order_type,address,payment_method,notes,total,amount_paid,credit_amount,payment_status,status)
         values ($1,$2,$3,$4,$5,$6,$7,$8,0,$8,'credit',$9) returning id,order_number`,
          [
            data.workspaceId,
            customerName,
            customerPhone,
            orderType,
            orderType === "delivery" ? data.address?.trim() : null,
            paymentMethod,
            data.notes?.trim() || null,
            total,
            status,
          ],
        )
      ).rows[0];
      if (!order) throw new Error("Não foi possível criar o pedido");
      for (const item of items) {
        const product = products.find((row) => row.id === item.productId)!;
        await client.query(
          "insert into order_items (order_id,product_id,name,price,qty,needs_kitchen,notes) values ($1,$2,$3,$4,$5,$6,$7)",
          [
            order.id,
            product.id,
            product.name,
            product.price,
            item.qty,
            product.needs_kitchen,
            item.notes?.trim() || null,
          ],
        );
        await client.query("update products set stock=stock-$1 where id=$2 and workspace_id=$3", [
          item.qty,
          product.id,
          data.workspaceId,
        ]);
      }
      return { ok: true as const, orderId: order.id, orderNumber: order.order_number, total };
    });
  });
