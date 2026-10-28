import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { q, tx } from "./db.server";
import { requireTenantRole } from "./gate.server";

const TABLES = [
  "workspaces",
  "categories",
  "products",
  "customers",
  "orders",
  "order_items",
  "shifts",
  "cash_entries",
  "daily_menu",
  "app_settings",
  "system_messages",
] as const;
const RESTORE_COLUMNS: Record<(typeof TABLES)[number], ReadonlySet<string>> = {
  workspaces: new Set(["id", "name", "owner_user_id", "created_at"]),
  categories: new Set(["id", "workspace_id", "name", "sort_order", "active", "created_at"]),
  products: new Set([
    "id",
    "workspace_id",
    "category_id",
    "catalog_suggestion_id",
    "name",
    "description",
    "price",
    "image_url",
    "stock",
    "available",
    "needs_kitchen",
    "created_at",
    "purchase_price",
    "min_stock",
    "stock_control",
  ]),
  customers: new Set([
    "id",
    "workspace_id",
    "name",
    "phone",
    "email",
    "credit_balance",
    "created_at",
    "updated_at",
  ]),
  orders: new Set([
    "id",
    "workspace_id",
    "order_number",
    "customer_id",
    "customer_name",
    "customer_phone",
    "order_type",
    "address",
    "payment_method",
    "status",
    "total",
    "notes",
    "courier_id",
    "courier_name",
    "created_at",
    "updated_at",
    "amount_paid",
    "credit_amount",
    "payment_status",
    "cancellation_note",
  ]),
  order_items: new Set([
    "id",
    "order_id",
    "product_id",
    "name",
    "price",
    "qty",
    "needs_kitchen",
    "checked",
    "notes",
  ]),
  shifts: new Set([
    "id",
    "workspace_id",
    "opened_at",
    "closed_at",
    "opening_amount",
    "closing_notes",
    "report",
  ]),
  cash_entries: new Set([
    "id",
    "workspace_id",
    "shift_id",
    "type",
    "amount",
    "method",
    "description",
    "order_id",
    "created_at",
    "voided",
  ]),
  daily_menu: new Set(["id", "workspace_id", "weekday", "product_id"]),
  app_settings: new Set(["workspace_id", "key", "value"]),
  system_messages: new Set(["id", "user_id", "message", "created_at", "read_at"]),
};
export const createWorkspaceBackup = createServerFn({ method: "GET" }).handler(async () => {
  const { workspaceId } = await requireTenantRole("admin");
  const data: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    if (table === "workspaces")
      data[table] = await q(`select * from ${table} where id=$1`, [workspaceId]);
    else if (["system_messages"].includes(table))
      data[table] = await q(
        `select m.* from ${table} m join app_users u on u.id=m.user_id where u.workspace_id=$1`,
        [workspaceId],
      );
    else data[table] = await q(`select * from ${table} where workspace_id=$1`, [workspaceId]);
  }
  return { version: 1, created_at: new Date().toISOString(), workspace_id: workspaceId, data };
});
export const restoreWorkspaceBackup = createServerFn({ method: "POST" })
  .validator((payload) =>
    z
      .object({
        backup: z.object({
          version: z.number(),
          workspace_id: z.string().uuid(),
          data: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
        }),
      })
      .parse(payload),
  )
  .handler(async ({ data }) => {
    const { workspaceId } = await requireTenantRole("admin");
    if (data.backup.version !== 1) throw new Error("Versão de backup não suportada");
    if (data.backup.workspace_id !== workspaceId)
      throw new Error("Esta cópia pertence a outro estabelecimento");
    await tx(async (client) => {
      for (const table of [...TABLES].reverse()) {
        if (table === "workspaces") continue;
        if (table === "system_messages")
          await client.query(
            "delete from system_messages where user_id in (select id from app_users where workspace_id=$1)",
            [workspaceId],
          );
        else await client.query(`delete from ${table} where workspace_id=$1`, [workspaceId]);
      }
      for (const table of TABLES) {
        const rows = data.backup.data[table] ?? [];
        for (const row of rows) {
          const keys = Object.keys(row).filter((key) => row[key] !== undefined);
          if (!keys.length) continue;
          if (keys.some((key) => !RESTORE_COLUMNS[table].has(key)))
            throw new Error(`Coluna não permitida no backup: ${table}`);
          const values = keys.map((key) => (row[key] === null ? null : row[key]));
          const placeholders = keys.map((_, index) => `$${index + 1}`).join(",");
          await client.query(
            `insert into ${table} (${keys.join(",")}) values (${placeholders}) on conflict do nothing`,
            values,
          );
        }
      }
    });
    return { ok: true as const };
  });
