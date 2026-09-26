import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { passwordMatches } from "./gate.server";
import { q, q1, tx } from "./db.server";
import { canUsePreviewFallback } from "./preview-fallback.server";

export type SaleRow = {
  id: string;
  order_number: number;
  customer_name: string;
  total: number | string;
  amount_paid: number | string;
  credit_amount: number | string;
  payment_status: string;
  payment_method: string;
  status: string;
  created_at: string;
  items_count: number;
  items: { product_id?: string; name: string; qty: number; price: number | string }[];
};

export const getSales = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return await q<SaleRow>(
      `select o.id, o.order_number, o.customer_name, o.total, o.amount_paid, o.credit_amount,
            o.payment_status, o.payment_method, o.status, o.created_at,
            coalesce(sum(i.qty), 0)::int as items_count,
            coalesce(json_agg(json_build_object('product_id', i.product_id, 'name', i.name, 'qty', i.qty, 'price', i.price) order by i.name) filter (where i.id is not null), '[]'::json) as items
     from orders o left join order_items i on i.order_id=o.id
     group by o.id order by o.created_at desc limit 200`,
    );
  } catch {
    // Compatibilidade temporária com bancos VPS que ainda não receberam a migração.
    try {
      return await q<SaleRow>(
        `select o.id, o.order_number, o.customer_name, o.total, o.total as amount_paid,
                0 as credit_amount, 'paid' as payment_status, o.payment_method, o.status, o.created_at,
                coalesce(sum(i.qty), 0)::int as items_count,
                coalesce(json_agg(json_build_object('name', i.name, 'qty', i.qty, 'price', i.price) order by i.name) filter (where i.id is not null), '[]'::json) as items
         from orders o left join order_items i on i.order_id=o.id
         group by o.id order by o.created_at desc limit 200`,
      );
    } catch {
      return [];
    }
  }
});

export const getOpenCustomerSales = createServerFn({ method: "GET" })
  .validator((data) => z.object({ customerName: z.string().min(2) }).parse(data))
  .handler(async ({ data }) => {
    try {
      return await q<SaleRow>(
        `select o.id, o.order_number, o.customer_name, o.total, o.amount_paid, o.credit_amount,
                o.payment_status, o.payment_method, o.status, o.created_at,
                coalesce(sum(i.qty), 0)::int as items_count,
                coalesce(json_agg(json_build_object('product_id', i.product_id, 'name', i.name, 'qty', i.qty, 'price', i.price) order by i.name) filter (where i.id is not null), '[]'::json) as items
         from orders o left join order_items i on i.order_id=o.id
         where lower(o.customer_name)=lower($1) and o.status not in ('cancelled','served','delivered')
         group by o.id order by o.created_at asc`,
        [data.customerName.trim()],
      );
    } catch {
      try {
        return await q<SaleRow>(
          `select o.id, o.order_number, o.customer_name, o.total, o.total as amount_paid,
                  0 as credit_amount, 'paid' as payment_status, o.payment_method, o.status, o.created_at,
                  coalesce(sum(i.qty), 0)::int as items_count,
                  coalesce(json_agg(json_build_object('name', i.name, 'qty', i.qty, 'price', i.price) order by i.name) filter (where i.id is not null), '[]'::json) as items
           from orders o left join order_items i on i.order_id=o.id
           where lower(o.customer_name)=lower($1) and o.status not in ('cancelled','served','delivered')
           group by o.id order by o.created_at asc`,
          [data.customerName.trim()],
        );
      } catch {
        const { getFallbackOpenOrders } = await import("./fallback-store.server");
        return getFallbackOpenOrders(data.customerName) as SaleRow[];
      }
    }
  });

export const getOpenCustomerSummaries = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return await q<{ customer_name: string; total: number; items: number }>(
      "select customer_name, coalesce(sum(total),0) total, coalesce(sum((select coalesce(sum(qty),0) from order_items oi where oi.order_id=o.id)),0)::int items from orders o where status not in ('cancelled','served','delivered') group by customer_name",
    );
  } catch {
    return [];
  }
});

export const finalizeOpenSale = createServerFn({ method: "POST" })
  .validator((data) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    try {
      const rows = await q<{
        id: string;
        total: number;
        amount_paid: number;
        payment_method: string;
        customer_id: string | null;
        order_number: number;
        customer_name: string;
      }>(
        "select id,total,coalesce(amount_paid,0) amount_paid,payment_method,customer_id,order_number,customer_name from orders where id=$1 and status not in ('cancelled','served','delivered')",
        [data.orderId],
      );
      const order = rows[0];
      if (!order) throw new Error("Pedido já finalizado ou não encontrado");
      const due = Math.max(0, Number(order.total) - Number(order.amount_paid));
      await q("update orders set status='served', updated_at=now() where id=$1", [data.orderId]);
      try {
        await q(
          "update orders set amount_paid=total, credit_amount=0, payment_status='paid' where id=$1",
          [data.orderId],
        );
      } catch {
        /* schema antigo: o status já foi persistido */
      }
      if (order.customer_id)
        try {
          await q(
            "update customers set credit_balance=greatest(0, credit_balance-$1), updated_at=now() where id=$2",
            [due, order.customer_id],
          );
        } catch {
          /* cliente legado */
        }
      if (due > 0)
        try {
          const shift = await q<{ id: string }>(
            "select id from shifts where closed_at is null order by opened_at desc limit 1",
          );
          if (shift[0]) {
            try {
              await q(
                "insert into cash_entries (shift_id,type,amount,method,description,order_id) values ($1,'income',$2,$3,$4,$5)",
                [
                  shift[0].id,
                  due,
                  order.payment_method === "Pendente" ? "Dinheiro" : order.payment_method,
                  `Finalização venda #${order.order_number} — ${order.customer_name}`,
                  data.orderId,
                ],
              );
            } catch {
              await q(
                "insert into cash_entries (shift_id,type,amount,method,description,order_id) values ($1,'income',round($2),$3,$4,$5)",
                [
                  shift[0].id,
                  due,
                  order.payment_method === "Pendente" ? "Dinheiro" : order.payment_method,
                  `Finalização venda #${order.order_number} — ${order.customer_name}`,
                  data.orderId,
                ],
              );
            }
          }
        } catch {
          /* caixa legado não deve impedir o fechamento do pedido */
        }
      return { ok: true as const, paid: due };
    } catch (error) {
      if (canUsePreviewFallback(error)) {
        const { finalizeFallbackOrder } = await import("./fallback-store.server");
        return finalizeFallbackOrder(data.orderId);
      }
      if (
        error instanceof Error &&
        /(column|relation).*does not exist|invalid input syntax/i.test(error.message)
      ) {
        const legacy = await tx(async (client) => {
          const result = await client.query<{
            id: string;
            total: number;
            amount_paid?: number;
            payment_method: string;
            order_number: number;
            customer_name: string;
          }>(
            "select id,total,payment_method,order_number,customer_name from orders where id=$1 and status not in ('cancelled','served','delivered') for update",
            [data.orderId],
          );
          const order = result.rows[0];
          if (!order) throw new Error("Pedido já finalizado ou não encontrado");
          const due = Number(order.total);
          await client.query("update orders set status='served', updated_at=now() where id=$1", [
            data.orderId,
          ]);
          const shift = await client.query<{ id: string }>(
            "select id from shifts where closed_at is null order by opened_at desc limit 1",
          );
          if (shift.rows[0])
            await client.query(
              "insert into cash_entries (shift_id,type,amount,method,description,order_id) values ($1,'income',round($2),$3,$4,$5)",
              [
                shift.rows[0].id,
                due,
                order.payment_method === "Pendente" ? "Dinheiro" : order.payment_method,
                `Finalização venda #${order.order_number} — ${order.customer_name}`,
                data.orderId,
              ],
            );
          return { ok: true as const, paid: due };
        });
        return legacy;
      }
      throw error;
    }
  });

export const updateOpenSale = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        orderId: z.string().uuid(),
        items: z
          .array(z.object({ product_id: z.string().uuid(), qty: z.number().int().min(1) }))
          .min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) =>
    tx(async (client) => {
      const current = await client.query<{ status: string }>(
        "select status from orders where id=$1 for update",
        [data.orderId],
      );
      if (!current.rows[0] || ["cancelled", "served", "delivered"].includes(current.rows[0].status))
        throw new Error("Este pedido não está aberto");
      const oldItems = await client.query<{ product_id: string; qty: number }>(
        "select product_id, qty from order_items where order_id=$1",
        [data.orderId],
      );
      for (const item of oldItems.rows)
        if (item.product_id)
          await client.query("update products set stock=stock+$1 where id=$2", [
            item.qty,
            item.product_id,
          ]);
      const ids = data.items.map((item) => item.product_id);
      const products = await client.query<{
        id: string;
        name: string;
        price: number;
        needs_kitchen: boolean;
        stock: number;
      }>(
        "select id,name,price,needs_kitchen,stock from products where id=any($1::uuid[]) and available=true for update",
        [ids],
      );
      if (products.rows.length !== ids.length) throw new Error("Produto indisponível");
      let total = 0;
      for (const item of data.items) {
        const p = products.rows.find((x) => x.id === item.product_id)!;
        if (p.stock < item.qty) throw new Error(`Estoque insuficiente: ${p.name}`);
        total += Number(p.price) * item.qty;
      }
      await client.query("delete from order_items where order_id=$1", [data.orderId]);
      for (const item of data.items) {
        const p = products.rows.find((x) => x.id === item.product_id)!;
        await client.query(
          "insert into order_items (order_id,product_id,name,price,qty,needs_kitchen) values ($1,$2,$3,$4,$5,$6)",
          [data.orderId, p.id, p.name, p.price, item.qty, p.needs_kitchen],
        );
        await client.query("update products set stock=stock-$1 where id=$2", [item.qty, p.id]);
      }
      await client.query(
        "update orders set total=$1, amount_paid=least(amount_paid,$1), credit_amount=greatest(0,$1-amount_paid), updated_at=now() where id=$2",
        [total, data.orderId],
      );
      return { ok: true as const, total };
    }),
  );

export const cancelSale = createServerFn({ method: "POST" })
  .validator((data) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    return tx(async (client) => {
      const result = await client.query<{ id: string }>(
        "update orders set status='cancelled', updated_at=now() where id=$1 and status <> 'cancelled' returning id",
        [data.orderId],
      );
      if (!result.rows[0]) throw new Error("Venda já cancelada ou não encontrada");
      await client.query("update cash_entries set voided=true where order_id=$1", [data.orderId]);
      await client.query(
        `update products p set stock=p.stock+i.qty from order_items i where i.order_id=$1 and i.product_id=p.id`,
        [data.orderId],
      );
      await client.query(
        `update customers c set credit_balance=greatest(0, c.credit_balance-o.credit_amount), updated_at=now()
         from orders o where o.id=$1 and o.customer_id=c.id and o.credit_amount>0`,
        [data.orderId],
      );
      return { ok: true as const };
    });
  });

export const deleteSaleAdmin = createServerFn({ method: "POST" })
  .validator((data) =>
    z.object({ orderId: z.string().uuid(), password: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const admin = await q1<{ password_hash: string }>(
      "select password_hash from route_passwords where route='admin'",
    );
    if (!admin || !passwordMatches(data.password, admin.password_hash))
      throw new Error("Senha de administrador inválida");
    const deleted = await q<{ id: string }>(
      "delete from orders where id=$1 and status='cancelled' returning id",
      [data.orderId],
    );
    if (!deleted.length) throw new Error("Cancele a venda antes de excluí-la");
    return { ok: true as const };
  });
