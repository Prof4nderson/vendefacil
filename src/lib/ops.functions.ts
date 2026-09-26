import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireRole } from "./gate.server";
import type { CashEntryRow, OrderItemRow, OrderRow, ShiftRow } from "./rows";

const ACTIVE_STATUSES = ["confirmed", "preparing", "ready", "out_for_delivery"];

async function listOrdersByStatus(statuses: string[]) {
  const { q } = await import("./db.server");
  const orders = await q<OrderRow>(
    "select * from orders where status = any($1::text[]) order by created_at asc",
    [statuses],
  );
  if (!orders.length) return { orders, items: [] as OrderItemRow[] };
  const items = await q<OrderItemRow>(
    "select * from order_items where order_id = any($1::uuid[]) order by name",
    [orders.map((o) => o.id)],
  );
  return { orders, items };
}

// ---------- Cozinha (KDS) ----------

export const getKitchenOrders = createServerFn({ method: "GET" }).handler(async () => {
  await requireRole("cozinha");
  return listOrdersByStatus(["confirmed", "preparing", "ready"]);
});

export const setOrderStatus = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        orderId: z.string().uuid(),
        status: z.enum(["preparing", "ready", "served", "cancelled"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireRole("cozinha");
    const { tx } = await import("./db.server");
    await tx(async (client) => {
      await client.query("update orders set status = $1, updated_at = now() where id = $2", [
        data.status,
        data.orderId,
      ]);
      if (data.status === "cancelled") {
        // devolve o estoque
        await client.query(
          `update products p set stock = p.stock + i.qty
           from order_items i
           where i.order_id = $1 and i.product_id = p.id`,
          [data.orderId],
        );
      }
    });
    return { ok: true as const };
  });

// ---------- Entrega ----------

export const getDeliveryBoard = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireRole("entrega");
  const { q } = await import("./db.server");
  const ready = await q<OrderRow>(
    `select * from orders
     where status = 'ready' and order_type = 'delivery' and courier_id is null
     order by created_at asc`,
  );
  const mine = session.courierId
    ? await q<OrderRow>(
        `select * from orders
         where courier_id = $1 and status = any($2::text[])
         order by created_at asc`,
        [session.courierId, ACTIVE_STATUSES],
      )
    : [];
  const allIds = [...ready, ...mine].map((o) => o.id);
  const items = allIds.length
    ? await q<OrderItemRow>(
        "select * from order_items where order_id = any($1::uuid[]) order by name",
        [allIds],
      )
    : [];
  return { ready, mine, items };
});

export const assignDelivery = createServerFn({ method: "POST" })
  .validator((data) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const session = await requireRole("entrega");
    if (!session.courierId) throw new Error("Entregador não identificado");
    const { q } = await import("./db.server");
    const rows = await q<{ id: string }>(
      `update orders set courier_id = $1, courier_name = $2, updated_at = now()
       where id = $3 and courier_id is null
       returning id`,
      [session.courierId, session.courierName ?? null, data.orderId],
    );
    if (!rows.length) throw new Error("Este pedido já foi assumido por outro entregador");
    return { ok: true as const };
  });

export const toggleItemChecked = createServerFn({ method: "POST" })
  .validator((data) => z.object({ itemId: z.string().uuid(), checked: z.boolean() }).parse(data))
  .handler(async ({ data }) => {
    await requireRole("entrega");
    const { q } = await import("./db.server");
    await q("update order_items set checked = $1 where id = $2", [data.checked, data.itemId]);
    return { ok: true as const };
  });

export const setOutForDelivery = createServerFn({ method: "POST" })
  .validator((data) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const session = await requireRole("entrega");
    const { q, q1 } = await import("./db.server");
    const pending = await q1<{ count: string }>(
      "select count(*)::text as count from order_items where order_id = $1 and checked = false",
      [data.orderId],
    );
    if (Number(pending?.count ?? 0) > 0) {
      throw new Error("Confira todos os itens antes de sair para entrega");
    }
    await q(
      `update orders set status = 'out_for_delivery', updated_at = now()
       where id = $1 and courier_id = $2`,
      [data.orderId, session.courierId ?? null],
    );
    return { ok: true as const };
  });

export const confirmDelivered = createServerFn({ method: "POST" })
  .validator((data) =>
    z.object({ orderId: z.string().uuid(), payment_method: z.string().min(2) }).parse(data),
  )
  .handler(async ({ data }) => {
    const session = await requireRole("entrega");
    const { tx } = await import("./db.server");
    return tx(async (client) => {
      const { rows } = await client.query<OrderRow>(
        `update orders set status = 'delivered', payment_method = $1, updated_at = now()
         where id = $2 returning *`,
        [data.payment_method, data.orderId],
      );
      const order = rows[0];
      if (!order) throw new Error("Pedido não encontrado");

      const { rows: shifts } = await client.query<{ id: string }>(
        "select id from shifts where closed_at is null order by opened_at desc limit 1",
      );
      await client.query(
        `insert into cash_entries (shift_id, type, amount, method, description, order_id)
         values ($1,'income',$2,$3,$4,$5)`,
        [
          shifts[0]?.id ?? null,
          order.total,
          data.payment_method,
          `Pedido #${order.order_number} — entrega por ${session.courierName ?? "entregador"}`,
          order.id,
        ],
      );
      return { ok: true as const, orderNumber: order.order_number };
    });
  });

// ---------- Caixa ----------

export const getCashierData = createServerFn({ method: "GET" }).handler(async () => {
  await requireRole("caixa");
  const { q, q1 } = await import("./db.server");
  const shift = await q1<ShiftRow>(
    "select * from shifts where closed_at is null order by opened_at desc limit 1",
  );
  if (!shift) return { shift: null, entries: [] as CashEntryRow[] };
  const entries = await q<CashEntryRow>(
    "select * from cash_entries where shift_id = $1 order by created_at desc",
    [shift.id],
  );
  return { shift, entries };
});

export const openShift = createServerFn({ method: "POST" })
  .validator((data) => z.object({ opening_amount: z.number().min(0) }).parse(data))
  .handler(async ({ data }) => {
    await requireRole("caixa");
    const { q, q1 } = await import("./db.server");
    const existing = await q1<{ id: string }>(
      "select id from shifts where closed_at is null limit 1",
    );
    if (existing) throw new Error("Já existe um turno aberto");
    await q("insert into shifts (opening_amount) values ($1)", [data.opening_amount]);
    return { ok: true as const };
  });

export const addCashEntry = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        type: z.enum(["income", "expense"]),
        amount: z.number().positive(),
        method: z.string().optional(),
        description: z.string().min(2),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireRole("caixa");
    const { q, q1 } = await import("./db.server");
    const shift = await q1<{ id: string }>(
      "select id from shifts where closed_at is null order by opened_at desc limit 1",
    );
    if (!shift) throw new Error("Abra o turno antes de lançar valores");
    await q(
      `insert into cash_entries (shift_id, type, amount, method, description)
       values ($1,$2,$3,$4,$5)`,
      [shift.id, data.type, data.amount, data.method || null, data.description],
    );
    return { ok: true as const };
  });

export const closeShift = createServerFn({ method: "POST" })
  .validator((data) => z.object({ notes: z.string().optional() }).parse(data))
  .handler(async ({ data }) => {
    await requireRole("caixa");
    const { q, q1 } = await import("./db.server");
    const shift = await q1<ShiftRow>(
      "select * from shifts where closed_at is null order by opened_at desc limit 1",
    );
    if (!shift) throw new Error("Nenhum turno aberto");

    const entries = await q<CashEntryRow>("select * from cash_entries where shift_id = $1", [
      shift.id,
    ]);
    const orders = await q<{
      id: string;
      order_number: number;
      customer_name: string;
      total: string | number;
      payment_method: string;
      order_type: string;
      status: string;
    }>(
      `select id, order_number, customer_name, total, payment_method, order_type, status
       from orders
       where created_at >= $1 and status <> 'cancelled'
       order by order_number`,
      [shift.opened_at],
    );

    const income = entries.filter((e) => e.type === "income");
    const expenses = entries.filter((e) => e.type === "expense");
    const byMethod: Record<string, number> = {};
    for (const e of income) {
      const m = e.method ?? "Outros";
      byMethod[m] = (byMethod[m] ?? 0) + Number(e.amount);
    }
    const report = {
      opened_at: shift.opened_at,
      closed_at: new Date().toISOString(),
      opening_amount: Number(shift.opening_amount),
      total_income: income.reduce((s, e) => s + Number(e.amount), 0),
      total_expense: expenses.reduce((s, e) => s + Number(e.amount), 0),
      by_method: byMethod,
      orders_count: orders.length,
      orders_total: orders.reduce((s, o) => s + Number(o.total), 0),
      orders,
    };

    await q(
      "update shifts set closed_at = $1, closing_notes = $2, report = $3::jsonb where id = $4",
      [report.closed_at, data.notes || null, JSON.stringify(report), shift.id],
    );
    return { ok: true as const, report };
  });

// Abertura rápida pelo PDV: o operador já está autenticado no fluxo da aplicação.
export const openPosShift = createServerFn({ method: "POST" })
  .validator((data) => z.object({ opening_amount: z.number().min(0) }).parse(data))
  .handler(async ({ data }) => {
    const { q, q1 } = await import("./db.server");
    const existing = await q1<{ id: string }>(
      "select id from shifts where closed_at is null limit 1",
    );
    if (existing) throw new Error("Já existe um turno aberto");
    await q("insert into shifts (opening_amount) values ($1)", [data.opening_amount]);
    return { ok: true as const };
  });
