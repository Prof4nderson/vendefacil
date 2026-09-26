import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireRole, hashPassword } from "./gate.server";
import { getTenantContext } from "./tenant.server";
import type {
  CashEntryRow,
  CategoryRow,
  CourierRow,
  DailyMenuRow,
  ProductRow,
  ShiftRow,
} from "./rows";

async function adminDb() {
  await requireRole("admin");
  const { workspaceId } = await getTenantContext();
  return { ...(await import("./db.server")), workspaceId };
}

// ---------- Visão geral ----------

export const getAdminData = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { q, workspaceId } = await adminDb();
    const [categories, products, daily, couriers, shifts, recentOrders] = await Promise.all([
      q<CategoryRow>("select * from categories where workspace_id=$1 order by sort_order, name", [workspaceId]),
      q<ProductRow>("select * from products where workspace_id=$1 order by name", [workspaceId]),
      q<DailyMenuRow>("select * from daily_menu where workspace_id=$1", [workspaceId]),
      q<CourierRow>(
        "select id, name, phone, email, vehicle_plate, active, created_at from couriers where workspace_id=$1 order by name", [workspaceId],
      ),
      q<ShiftRow>("select * from shifts where workspace_id=$1 order by opened_at desc limit 20", [workspaceId]),
      q<{
        id: string;
        order_number: number;
        customer_name: string;
        total: string | number;
        status: string;
        order_type: string;
        payment_method: string;
        courier_name: string | null;
        created_at: string;
      }>(
        `select id, order_number, customer_name, total, status, order_type, payment_method, courier_name, created_at
         from orders where workspace_id=$1 order by created_at desc limit 50` , [workspaceId],
      ),
    ]);
    return { categories, products, daily, couriers, shifts, recentOrders };
  } catch (error) {
    const { canUsePreviewFallback } = await import("./preview-fallback.server");
    if (!canUsePreviewFallback(error)) throw error;
    const { getFallbackAdminData } = await import("./fallback-store.server");
    return getFallbackAdminData() as unknown as {
      categories: CategoryRow[];
      products: ProductRow[];
      daily: DailyMenuRow[];
      couriers: CourierRow[];
      shifts: ShiftRow[];
      recentOrders: {
        id: string;
        order_number: number;
        customer_name: string;
        total: string | number;
        status: string;
        order_type: string;
        payment_method: string;
        courier_name: string | null;
        created_at: string;
      }[];
    };
  }
});

// ---------- Categorias ----------

export const saveCategory = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(2),
        sort_order: z.number().int().min(0),
        active: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { q, workspaceId } = await adminDb();
    if (data.id) {
      await q("update categories set name = $1, sort_order = $2, active = $3 where id = $4 and workspace_id = $5", [
        data.name,
        data.sort_order,
        data.active,
        data.id,
        workspaceId,
      ]);
    } else {
      await q("insert into categories (workspace_id,name, sort_order, active) values ($1,$2,$3,$4)", [workspaceId,
        data.name,
        data.sort_order,
        data.active,
      ]);
    }
    return { ok: true as const };
  });

// ---------- Produtos ----------

const productInput = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid(),
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.number().min(0),
  image_url: z.string().optional().nullable(),
  stock: z.number().int().min(0),
  available: z.boolean(),
  needs_kitchen: z.boolean(),
});

export const saveProduct = createServerFn({ method: "POST" })
  .validator((data) => productInput.parse(data))
  .handler(async ({ data }) => {
    const { q, workspaceId } = await adminDb();
    const values = [
      data.category_id,
      data.name,
      data.description || null,
      data.price,
      data.image_url || null,
      data.stock,
      data.available,
      data.needs_kitchen,
    ];
    if (data.id) {
      await q(
        `update products set category_id=$1, name=$2, description=$3, price=$4,
           image_url=$5, stock=$6, available=$7, needs_kitchen=$8
         where id=$9 and workspace_id=$10`,
        [...values, data.id, workspaceId],
      );
    } else {
      await q(
        `insert into products (workspace_id,category_id, name, description, price, image_url, stock, available, needs_kitchen)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [workspaceId, ...values],
      );
    }
    return { ok: true as const };
  });

export const toggleProductAvailable = createServerFn({ method: "POST" })
  .validator((data) => z.object({ id: z.string().uuid(), available: z.boolean() }).parse(data))
  .handler(async ({ data }) => {
    const { q, workspaceId } = await adminDb();
    await q("update products set available = $1 where id = $2 and workspace_id=$3", [data.available, data.id, workspaceId]);
    return { ok: true as const };
  });

export const updateStock = createServerFn({ method: "POST" })
  .validator((data) =>
    z.object({ id: z.string().uuid(), stock: z.number().int().min(0) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { q, workspaceId } = await adminDb();
    await q("update products set stock = $1 where id = $2 and workspace_id=$3", [data.stock, data.id, workspaceId]);
    return { ok: true as const };
  });

// ---------- Cardápio semanal ----------

export const setDailyMenuItem = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        weekday: z.number().int().min(0).max(6),
        product_id: z.string().uuid(),
        include: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { q, workspaceId } = await adminDb();
    if (data.include) {
      await q(
        `insert into daily_menu (workspace_id, weekday, product_id) values ($1,$2,$3)
         on conflict (weekday, product_id) do nothing`,
        [workspaceId, data.weekday, data.product_id],
      );
    } else {
      await q("delete from daily_menu where workspace_id=$1 and weekday = $2 and product_id = $3", [
        workspaceId,
        data.weekday,
        data.product_id,
      ]);
    }
    return { ok: true as const };
  });

// ---------- Entregadores ----------

const courierInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional().or(z.literal("")),
  vehicle_plate: z.string().optional(),
  password: z.string().min(4).optional(),
  active: z.boolean(),
});

export const saveCourier = createServerFn({ method: "POST" })
  .validator((data) => courierInput.parse(data))
  .handler(async ({ data }) => {
    const { q, workspaceId } = await adminDb();
    const base = [
      data.name,
      data.phone,
      data.email || null,
      data.vehicle_plate || null,
      data.active,
    ];
    if (data.id) {
      if (data.password) {
        await q(
          `update couriers set name=$1, phone=$2, email=$3, vehicle_plate=$4, active=$5, password_hash=$6
           where id=$7 and workspace_id=$8`,
          [...base, hashPassword(data.password), data.id, workspaceId],
        );
      } else {
        await q(
          "update couriers set name=$1, phone=$2, email=$3, vehicle_plate=$4, active=$5 where id=$6 and workspace_id=$7",
          [...base, data.id, workspaceId],
        );
      }
    } else {
      if (!data.password) throw new Error("Informe uma senha para o entregador");
      await q(
        `insert into couriers (workspace_id,name, phone, email, vehicle_plate, active, password_hash)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [workspaceId, ...base, hashPassword(data.password)],
      );
    }
    return { ok: true as const };
  });

// ---------- Aparência / configurações ----------

export const saveSettings = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        restaurant_name: z.string().min(2),
        primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        logo_url: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { q, workspaceId } = await adminDb();
    const pairs: [string, string][] = [
      ["restaurant_name", JSON.stringify(data.restaurant_name)],
      ["primary_color", JSON.stringify(data.primary_color)],
      ["logo_url", data.logo_url ? JSON.stringify(data.logo_url) : "null"],
    ];
    for (const [key, value] of pairs) {
      await q(
        `insert into app_settings (workspace_id,key, value) values ($1, $2, $3::jsonb)
         on conflict (workspace_id,key) do update set value = excluded.value`,
        [workspaceId, key, value],
      );
    }
    return { ok: true as const };
  });

// ---------- Financeiro ----------

export const getFinanceData = createServerFn({ method: "GET" })
  .validator((data) => z.object({ days: z.number().int().min(1).max(90).default(30) }).parse(data))
  .handler(async ({ data }) => {
    const { q, workspaceId } = await adminDb();
    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    const [entries, orders, shifts] = await Promise.all([
      q<CashEntryRow>(
        "select * from cash_entries where workspace_id=$1 and created_at >= $2 order by created_at desc",
        [workspaceId, since],
      ),
      q<{
        id: string;
        order_number: number;
        total: string | number;
        status: string;
        order_type: string;
        payment_method: string;
        created_at: string;
      }>(
        `select id, order_number, total, status, order_type, payment_method, created_at
         from orders where workspace_id=$1 and created_at >= $2 and status <> 'cancelled'
         order by created_at desc`,
        [workspaceId, since],
      ),
      q<ShiftRow>(
        "select * from shifts where workspace_id=$1 and closed_at is not null order by opened_at desc limit 30",
        [workspaceId],
      ),
    ]);
    return { entries, orders, shifts };
  });
