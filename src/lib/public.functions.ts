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

export const getPublicVendors = createServerFn({ method: "GET" }).handler(async () => {
  const { q } = await import("./db.server");
  return q<{
    id: string;
    name: string;
    product_count: number;
    min_price: string | number | null;
  }>(
    `select w.id,w.name,count(distinct p.id)::int as product_count,min(p.price) as min_price
     from workspaces w
     join app_users owner on owner.workspace_id=w.id and owner.role='owner'
       and owner.verified_at is not null and owner.status='active'
     join products p on p.workspace_id=w.id and p.available=true
     join categories c on c.id=p.category_id and c.workspace_id=w.id and c.active=true
     group by w.id,w.name
     having count(distinct p.id)>0
     order by lower(w.name),w.id`,
  );
});

export const getPublicVendorMenu = createServerFn({ method: "GET" })
  .validator((data) => z.object({ workspaceId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { q, q1 } = await import("./db.server");
    const vendor = await q1<{ id: string; name: string }>(
      `select w.id,w.name from workspaces w
       where w.id=$1 and exists (
         select 1 from app_users owner where owner.workspace_id=w.id and owner.role='owner'
           and owner.verified_at is not null and owner.status='active'
       )`,
      [data.workspaceId],
    );
    if (!vendor) return null;

    const [categories, products, daily] = await Promise.all([
      q<{ id: string; name: string; sort_order: number }>(
        `select distinct c.id,c.name,c.sort_order from categories c
         join products p on p.category_id=c.id and p.workspace_id=c.workspace_id
         where c.workspace_id=$1 and c.active=true and p.available=true
         order by c.sort_order,c.name`,
        [vendor.id],
      ),
      q<{
        id: string;
        category_id: string;
        category_name: string;
        name: string;
        description: string | null;
        price: string | number;
        image_url: string | null;
        in_stock: boolean;
        needs_kitchen: boolean;
      }>(
        `select p.id,p.category_id,c.name as category_name,p.name,p.description,p.price,p.image_url,
           (p.stock>0) as in_stock,p.needs_kitchen
         from products p join categories c on c.id=p.category_id and c.workspace_id=p.workspace_id
         where p.workspace_id=$1 and p.available=true and c.active=true
         order by c.sort_order,c.name,p.name`,
        [vendor.id],
      ),
      q<{ product_id: string }>(
        `select dm.product_id from daily_menu dm
         join products p on p.id=dm.product_id and p.workspace_id=$1 and p.available=true
         where dm.workspace_id=$1 and dm.weekday=$2`,
        [vendor.id, todayWeekday()],
      ),
    ]);
    return { vendor, categories, products, dailyIds: daily.map((item) => item.product_id) };
  });

const publicOrderInput = z.object({
  workspaceId: z.string().uuid(),
  customerName: z.string().trim().min(2).max(80),
  customerPhone: z.string().trim().min(8).max(24),
  orderType: z.enum(["delivery", "dine_in"]),
  address: z.string().trim().max(250).optional(),
  notes: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        qty: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(30),
});

type PublicProductRow = {
  id: string;
  name: string;
  price: string | number;
  stock: number;
  needs_kitchen: boolean;
};

export const createPublicOrder = createServerFn({ method: "POST" })
  .validator((data) => publicOrderInput.parse(data))
  .handler(async ({ data }) => {
    if (data.orderType === "delivery" && (!data.address || data.address.length < 5)) {
      throw new Error("Informe um endereço de entrega válido");
    }
    if (data.customerPhone.replace(/\D/g, "").length < 8) {
      throw new Error("Informe um telefone válido com DDD");
    }

    const quantities = new Map<string, number>();
    for (const item of data.items) {
      quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.qty);
    }
    if ([...quantities.values()].some((qty) => qty > 20)) {
      throw new Error("A quantidade máxima por produto é 20 unidades");
    }

    const [{ randomBytes, createHash }, { tx }, { getRequestIp }] = await Promise.all([
      import("node:crypto"),
      import("./db.server"),
      import("./activity-support.server"),
    ]);
    const accessToken = randomBytes(32).toString("base64url");
    const accessTokenHash = createHash("sha256").update(accessToken).digest("hex");
    const sourceIp = getRequestIp();
    const ids = [...quantities.keys()];

    const result = await tx(async (client) => {
      const vendor = (
        await client.query<{ id: string; name: string }>(
          `select w.id,w.name from workspaces w
           where w.id=$1 and exists (
             select 1 from app_users owner where owner.workspace_id=w.id and owner.role='owner'
               and owner.verified_at is not null and owner.status='active'
           )`,
          [data.workspaceId],
        )
      ).rows[0];
      if (!vendor) throw new Error("Este estabelecimento não está aceitando pedidos públicos");

      if (sourceIp) {
        await client.query("select pg_advisory_xact_lock(hashtext($1),hashtext($2))", [
          data.workspaceId,
          sourceIp,
        ]);
        const recent = (
          await client.query<{ count: number | string }>(
            `select count(*)::int as count from orders
             where workspace_id=$1 and source_ip=$2 and public_access_token_hash is not null
               and created_at > now() - interval '1 minute'`,
            [data.workspaceId, sourceIp],
          )
        ).rows[0];
        if (Number(recent?.count ?? 0) >= 8) {
          throw new Error(
            "Muitos pedidos enviados deste acesso. Aguarde um minuto e tente novamente.",
          );
        }
      }

      const products = (
        await client.query<PublicProductRow>(
          `select p.id,p.name,p.price,p.stock,p.needs_kitchen
           from products p
           join categories c on c.id=p.category_id and c.workspace_id=p.workspace_id and c.active=true
           where p.workspace_id=$1 and p.id=any($2::uuid[]) and p.available=true
           for update of p`,
          [vendor.id, ids],
        )
      ).rows;
      if (products.length !== ids.length) {
        throw new Error(
          "Um ou mais itens não estão mais disponíveis. Atualize o cardápio e tente novamente.",
        );
      }
      for (const [productId, qty] of quantities) {
        const product = products.find((item) => item.id === productId);
        if (!product) throw new Error("Produto não encontrado neste estabelecimento");
        if (product.stock < qty) throw new Error(`Estoque insuficiente: ${product.name}`);
      }

      const totalCents = data.items.reduce((sum, item) => {
        const product = products.find((entry) => entry.id === item.productId)!;
        return sum + Math.round(Number(product.price) * 100) * item.qty;
      }, 0);
      const total = totalCents / 100;
      const order = (
        await client.query<{ id: string; order_number: number }>(
          `insert into orders
             (workspace_id,customer_name,customer_phone,order_type,address,payment_method,notes,total,
              amount_paid,credit_amount,payment_status,status,source_ip,public_access_token_hash)
           values ($1,$2,$3,$4,$5,'Pendente',$6,$7,0,$7,'credit','confirmed',$8,$9)
           returning id,order_number`,
          [
            vendor.id,
            data.customerName,
            data.customerPhone,
            data.orderType,
            data.orderType === "delivery" ? data.address : null,
            data.notes || null,
            total,
            sourceIp,
            accessTokenHash,
          ],
        )
      ).rows[0];
      if (!order) throw new Error("Não foi possível registrar seu pedido");

      for (const item of data.items) {
        const product = products.find((entry) => entry.id === item.productId)!;
        await client.query(
          `insert into order_items (order_id,product_id,name,price,qty,needs_kitchen)
           values ($1,$2,$3,$4,$5,$6)`,
          [order.id, product.id, product.name, product.price, item.qty, product.needs_kitchen],
        );
      }
      for (const [productId, qty] of quantities) {
        const updated = await client.query(
          "update products set stock=stock-$1 where id=$2 and workspace_id=$3 and stock >= $1",
          [qty, productId, vendor.id],
        );
        if (updated.rowCount !== 1)
          throw new Error("Estoque alterado durante o pedido. Tente novamente.");
      }

      return { id: order.id, orderNumber: order.order_number, vendorName: vendor.name, total };
    });

    return { ...result, accessToken };
  });

export const getOrder = createServerFn({ method: "GET" })
  .validator((data) =>
    z
      .object({ id: z.string().uuid(), accessToken: z.string().min(32).max(80).optional() })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { q, q1 } = await import("./db.server");
    let order: OrderRow | null;
    if (data.accessToken) {
      const { createHash } = await import("node:crypto");
      const tokenHash = createHash("sha256").update(data.accessToken).digest("hex");
      order = await q1<OrderRow>(
        `select id,order_number,customer_name,customer_phone,order_type,address,payment_method,status,
           total,notes,courier_id,courier_name,created_at,updated_at
         from orders where id=$1 and public_access_token_hash=$2
         and created_at > now() - interval '30 days'`,
        [data.id, tokenHash],
      );
    } else {
      const ctx = await getTenantContext();
      order = await q1<OrderRow>(
        `select id,order_number,customer_name,customer_phone,order_type,address,payment_method,status,
           total,notes,courier_id,courier_name,created_at,updated_at
         from orders where id=$1 and workspace_id=$2`,
        [data.id, ctx.workspaceId],
      );
    }
    if (!order) throw new Error("Pedido não encontrado ou link de acompanhamento expirado");
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
