import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CategoryRow, OrderItemRow, OrderRow, ProductRow } from "./rows";

function todayWeekday() {
  const sp = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return sp.getDay();
}

export const getMenuData = createServerFn({ method: "GET" }).handler(async () => {
  const { q } = await import("./db.server");
  const weekday = todayWeekday();
  try {
    const [categories, products, daily] = await Promise.all([
      q<CategoryRow>("select * from categories where active = true order by sort_order, name"),
      q<ProductRow>("select * from products where available = true order by name"),
      q<{ product_id: string }>("select product_id from daily_menu where weekday = $1", [weekday]),
    ]);
    return {
      categories,
      products,
      dailyIds: daily.map((d) => d.product_id),
      weekday,
    };
  } catch {
    const { getFallbackMenu } = await import("./fallback-store.server");
    return getFallbackMenu(weekday);
  }
});

export const getOrder = createServerFn({ method: "GET" })
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { q, q1 } = await import("./db.server");
    try {
      const order = await q1<OrderRow>("select * from orders where id = $1", [data.id]);
      if (!order) throw new Error("Pedido não encontrado");
      const items = await q<OrderItemRow>(
        "select * from order_items where order_id = $1 order by name",
        [data.id],
      );
      return { order, items };
    } catch (error) {
      if (error instanceof Error && error.message === "Pedido não encontrado") throw error;
      const { getFallbackOrder } = await import("./fallback-store.server");
      return getFallbackOrder(data.id);
    }
  });

export const getSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { q } = await import("./db.server");
  let rows: { key: string; value: unknown }[] = [];
  try {
    rows = await q<{ key: string; value: unknown }>("select key, value from app_settings");
  } catch {
    rows = [];
  }
  const map: Record<string, unknown> = {};
  for (const row of rows) map[row.key] = row.value;
  return {
    restaurant_name: (map["restaurant_name"] as string) ?? "Sabor da Casa",
    primary_color:
      ((map["primary_color"] as string) === "#c2410c"
        ? "#00d5ff"
        : (map["primary_color"] as string)) ?? "#00d5ff",
    logo_url: (map["logo_url"] as string | null) ?? null,
  };
});
