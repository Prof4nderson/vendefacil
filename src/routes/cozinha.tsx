import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { ChefHat, Bike, Store } from "lucide-react";
import { toast } from "sonner";
import { OpsGate, useOpsQuery, hasOpsAccess } from "@/components/ops-gate";
import { getOpsSessionInfo } from "@/lib/gate.functions";
import { getKitchenOrders, setOrderStatus } from "@/lib/ops.functions";

export const Route = createFileRoute("/cozinha")({
  loader: () => getOpsSessionInfo(),
  head: () => ({
    meta: [
      { title: "Cozinha — Pedidos" },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Cozinha" },
      { property: "og:description", content: "Painel da cozinha" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KitchenPage,
});

function elapsed(createdAt: string) {
  const min = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  return min < 1 ? "agora" : `${min} min`;
}

function KitchenPage() {
  const session = Route.useLoaderData();
  const queryClient = useQueryClient();
  const fetchOrders = useServerFn(getKitchenOrders);
  const changeStatus = useServerFn(setOrderStatus);

  const allowed = hasOpsAccess(session, "cozinha");
  const { data } = useOpsQuery(["kitchen"], fetchOrders, 5000, allowed);

  // Avisa sobre novos pedidos comparando as recargas periódicas
  const seenOrders = useRef<Set<number> | null>(null);
  useEffect(() => {
    if (!allowed || !data) return;
    const numbers = data.orders.map((o) => o.order_number);
    if (seenOrders.current === null) {
      seenOrders.current = new Set(numbers);
      return;
    }
    for (const n of numbers) {
      if (!seenOrders.current.has(n)) {
        seenOrders.current.add(n);
        toast.success(`Novo pedido #${n} confirmado!`);
      }
    }
  }, [data, allowed]);

  async function move(id: string, status: "preparing" | "ready" | "served" | "cancelled") {
    try {
      await changeStatus({ data: { orderId: id, status } });
      queryClient.invalidateQueries({ queryKey: ["kitchen"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  type Order = NonNullable<typeof data>["orders"][number];
  type Item = NonNullable<typeof data>["items"][number];
  const orders: Order[] = data?.orders ?? [];
  const allItems: Item[] = data?.items ?? [];
  const itemsOf = (orderId: string) =>
    allItems.filter((i) => i.order_id === orderId && i.needs_kitchen !== false);
  const cols = [
    { status: "confirmed", title: "Confirmados", orders: orders.filter((o) => o.status === "confirmed") },
    { status: "preparing", title: "Em preparo", orders: orders.filter((o) => o.status === "preparing") },
    { status: "ready", title: "Prontos", orders: orders.filter((o) => o.status === "ready") },
  ];

  return (
    <OpsGate role="cozinha" title="Cozinha" session={session}>
      <div className="mx-auto min-h-screen max-w-6xl px-4 py-4">
        <header className="mb-4 flex items-center gap-2">
          <ChefHat className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">Cozinha</h1>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          {cols.map((col) => (
            <section key={col.status}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {col.title}
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{col.orders.length}</span>
              </h2>
              <div className="space-y-3">
                {col.orders.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    Nenhum pedido
                  </p>
                )}
                {col.orders.map((order) => {
                  const kitchenItems = itemsOf(order.id);
                  return (
                    <article
                      key={order.id}
                      className={`rounded-2xl border bg-card p-4 ${col.status === "confirmed" ? "border-primary/40" : "border-border"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-xl font-bold">#{order.order_number}</span>
                        <span className="text-xs font-medium text-muted-foreground">{elapsed(order.created_at)}</span>
                      </div>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium">
                        {order.customer_name}
                        {order.order_type === "delivery" ? (
                          <Bike className="h-4 w-4 text-primary" aria-label="Entrega" />
                        ) : (
                          <Store className="h-4 w-4 text-accent-foreground" aria-label="No restaurante" />
                        )}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {kitchenItems.map((item) => (
                          <li key={item.id} className="text-sm">
                            <span className="font-semibold">{item.qty}×</span> {item.name}
                            {item.notes && (
                              <p className="ml-5 mt-0.5 rounded-md bg-accent/60 px-2 py-1 text-xs font-medium">
                                ⚠ {item.notes}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                      {order.notes && (
                        <p className="mt-2 rounded-lg bg-accent/50 p-2 text-xs">{order.notes}</p>
                      )}
                      <div className="mt-3 flex gap-2">
                        {col.status === "confirmed" && (
                          <>
                            <button
                              onClick={() => move(order.id, "preparing")}
                              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
                            >
                              Iniciar preparo
                            </button>
                            <button
                              onClick={() => move(order.id, "cancelled")}
                              className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive"
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                        {col.status === "preparing" && (
                          <button
                            onClick={() => move(order.id, "ready")}
                            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
                          >
                            Marcar pronto
                          </button>
                        )}
                        {col.status === "ready" && order.order_type === "dine_in" && (
                          <button
                            onClick={() => move(order.id, "served")}
                            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
                          >
                            Servido
                          </button>
                        )}
                        {col.status === "ready" && order.order_type === "delivery" && (
                          <p className="flex-1 py-2 text-center text-xs font-medium text-muted-foreground">
                            Aguardando entregador
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </OpsGate>
  );
}
