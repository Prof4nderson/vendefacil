import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { passwordMatches } from "./gate.server";
import { q, q1, tx } from "./db.server";

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
  items: { name: string; qty: number; price: number | string }[];
};

export const getSales = createServerFn({ method: "GET" }).handler(async () => {
  return q<SaleRow>(
    `select o.id, o.order_number, o.customer_name, o.total, o.amount_paid, o.credit_amount,
            o.payment_status, o.payment_method, o.status, o.created_at,
            coalesce(sum(i.qty), 0)::int as items_count,
            coalesce(json_agg(json_build_object('name', i.name, 'qty', i.qty, 'price', i.price) order by i.name) filter (where i.id is not null), '[]'::json) as items
     from orders o left join order_items i on i.order_id=o.id
     group by o.id order by o.created_at desc limit 200`,
  );
});

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
