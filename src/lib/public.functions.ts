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
    return getFallbackMenu(weekday);
  }
  const { q } = await import("./db.server");
  const [categories, products, daily] = await Promise.all([
    q<CategoryRow>("select * from categories where workspace_id=$1 and active=true order by sort_order, name", [ctx.workspaceId]),
    q<ProductRow>("select * from products where workspace_id=$1 and available=true order by name", [ctx.workspaceId]),
    q<{ product_id: string }>("select product_id from daily_menu where workspace_id=$1 and weekday=$2", [ctx.workspaceId, weekday]),
  ]);
  return { categories, products, dailyIds: daily.map((d) => d.product_id), weekday };
});

export const getOrder = createServerFn({ method: "GET" }).validator((data) => z.object({ id: z.string().uuid() }).parse(data)).handler(async ({ data }) => {
  const ctx = await getTenantContext();
  const { q, q1 } = await import("./db.server");
  const order = await q1<OrderRow>("select * from orders where id=$1 and workspace_id=$2", [data.id, ctx.workspaceId]);
  if (!order) throw new Error("Pedido não encontrado");
  const items = await q<OrderItemRow>("select * from order_items where order_id=$1", [data.id]);
  return { order, items };
});

export const getSettings = createServerFn({ method: "GET" }).handler(async () => {
  const ctx = await getOptionalTenantContext();
  if (!ctx) return { restaurant_name: "VendeFácil", primary_color: "#00d5ff", logo_url: null as string | null };
  const { q } = await import("./db.server");
  const rows = await q<{ key: string; value: unknown }>("select key,value from app_settings where workspace_id=$1", [ctx.workspaceId]);
  const map: Record<string, unknown> = {};
  for (const row of rows) map[row.key] = row.value;
  return { restaurant_name: (map["restaurant_name"] as string) ?? "VendeFácil", primary_color: (map["primary_color"] as string) ?? "#00d5ff", logo_url: (map["logo_url"] as string | null) ?? null };
});
