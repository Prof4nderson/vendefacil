import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { q, tx } from "./db.server";
import { getTenantContext } from "./tenant.server";

const TABLES = ["workspaces", "app_users", "categories", "products", "customers", "orders", "order_items", "shifts", "cash_entries", "daily_menu", "couriers", "app_settings", "route_passwords", "system_messages"] as const;
export const createWorkspaceBackup = createServerFn({ method: "GET" }).handler(async () => {
  const { workspaceId } = await getTenantContext();
  const data: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    if (table === "workspaces") data[table] = await q(`select * from ${table} where id=$1`, [workspaceId]);
    else if (table === "app_users") data[table] = await q(`select * from ${table} where workspace_id=$1`, [workspaceId]);
    else if (["system_messages"].includes(table)) data[table] = await q(`select m.* from ${table} m join app_users u on u.id=m.user_id where u.workspace_id=$1`, [workspaceId]);
    else data[table] = await q(`select * from ${table} where workspace_id=$1`, [workspaceId]);
  }
  return { version: 1, created_at: new Date().toISOString(), workspace_id: workspaceId, data };
});
export const restoreWorkspaceBackup = createServerFn({ method: "POST" }).validator((payload) => z.object({ backup: z.object({ version: z.number(), workspace_id: z.string().uuid(), data: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))) }) }).parse(payload)).handler(async ({ data }) => {
  const { workspaceId } = await getTenantContext();
  if (data.backup.workspace_id !== workspaceId) throw new Error("Esta cópia pertence a outro estabelecimento");
  await tx(async (client) => {
    for (const table of [...TABLES].reverse()) {
      if (table === "workspaces") continue;
      if (table === "system_messages") await client.query("delete from system_messages where user_id in (select id from app_users where workspace_id=$1)", [workspaceId]);
      else if (table === "app_users") await client.query("delete from app_users where workspace_id=$1", [workspaceId]);
      else await client.query(`delete from ${table} where workspace_id=$1`, [workspaceId]);
    }
    for (const table of TABLES) {
      const rows = data.backup.data[table] ?? [];
      for (const row of rows) {
        const keys = Object.keys(row).filter((key) => row[key] !== undefined);
        if (!keys.length) continue;
        const values = keys.map((key) => row[key] === null ? null : row[key]);
        const placeholders = keys.map((_, index) => `$${index + 1}`).join(",");
        await client.query(`insert into ${table} (${keys.join(",")}) values (${placeholders}) on conflict do nothing`, values);
      }
    }
  });
  return { ok: true as const };
});
