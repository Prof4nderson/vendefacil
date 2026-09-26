import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const orderInput = z.object({
  customer_name: z.string().min(2),
  customer_phone: z.string().min(8),
  order_type: z.enum(["delivery", "dine_in"]),
  address: z.string().optional(),
  payment_method: z.string().min(2),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        qty: z.number().int().min(1),
        notes: z.string().max(300).optional(),
      }),
    )
    .min(1),
});

type ProductRow = {
  id: string;
  name: string;
  price: string | number;
  stock: number;
  needs_kitchen: boolean;
};

async function canUsePreviewFallback(error: unknown) {
  const { canUsePreviewFallback: check } = await import("./preview-fallback.server");
  return check(error);
}

export const createOrder = createServerFn({ method: "POST" })
  .validator((data) => orderInput.parse(data))
  .handler(async ({ data }) => {
    if (data.order_type === "delivery" && !data.address?.trim()) {
      throw new Error("Informe o endereço de entrega");
    }
    const { tx } = await import("./db.server");
    const ids = data.items.map((i) => i.product_id);

    try {
      return await tx(async (client) => {
        const { rows: products } = await client.query<ProductRow>(
          "select id, name, price, stock, needs_kitchen from products where id = any($1::uuid[]) and available = true for update",
          [ids],
        );
        if (products.length !== ids.length) {
          throw new Error("Algum item não está mais disponível");
        }

        for (const item of data.items) {
          const product = products.find((p) => p.id === item.product_id);
          if (!product) throw new Error("Algum item não está mais disponível");
          if (product.stock < item.qty) throw new Error(`Estoque insuficiente: ${product.name}`);
        }

        const total = data.items.reduce((sum, item) => {
          const product = products.find((p) => p.id === item.product_id);
          return sum + Number(product?.price ?? 0) * item.qty;
        }, 0);

        const { rows: orderRows } = await client.query<{ id: string; order_number: number }>(
          `insert into orders
             (customer_name, customer_phone, order_type, address, payment_method, notes, total, status)
           values ($1,$2,$3,$4,$5,$6,$7,'confirmed')
           returning id, order_number`,
          [
            data.customer_name.trim(),
            data.customer_phone.trim(),
            data.order_type,
            data.order_type === "delivery" ? (data.address?.trim() ?? null) : null,
            data.payment_method,
            data.notes?.trim() || null,
            total,
          ],
        );
        const order = orderRows[0];
        if (!order) throw new Error("Pedido não foi criado");

        for (const item of data.items) {
          const product = products.find((p) => p.id === item.product_id);
          if (!product) throw new Error("Algum item não está mais disponível");
          await client.query(
            `insert into order_items (order_id, product_id, name, price, qty, needs_kitchen, notes)
             values ($1,$2,$3,$4,$5,$6,$7)`,
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
          await client.query("update products set stock = stock - $1 where id = $2", [
            item.qty,
            product.id,
          ]);
        }

        // No PDV o primeiro fechamento abre o turno automaticamente.
        const { rows: openShifts } = await client.query<{ id: string }>(
          "select id from shifts where closed_at is null order by opened_at desc limit 1",
        );
        const shiftId =
          openShifts[0]?.id ??
          (
            await client.query<{ id: string }>(
              "insert into shifts (opening_amount) values (0) returning id",
            )
          ).rows[0]?.id;
        if (shiftId) {
          await client.query(
            `insert into cash_entries (shift_id, type, amount, method, description, order_id)
             values ($1, 'income', $2, $3, $4, $5)`,
            [
              shiftId,
              total,
              data.payment_method,
              `Venda #${order.order_number} — ${data.customer_name}`,
              order.id,
            ],
          );
        }

        return { ok: true as const, orderId: order.id, orderNumber: order.order_number };
      });
    } catch (error) {
      if (!(await canUsePreviewFallback(error))) throw error;
      const { createFallbackOrder } = await import("./fallback-store.server");
      return createFallbackOrder(data);
    }
  });
