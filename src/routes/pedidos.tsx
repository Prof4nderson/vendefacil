import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ReceiptText } from "lucide-react";
import { brl } from "@/lib/format";
import { getMyOrders, type SavedOrder } from "@/lib/local-store";
import { BottomNav } from "@/components/bottom-nav";

export const Route = createFileRoute("/pedidos")({
  head: () => ({
    meta: [
      { title: "Meus pedidos — histórico e acompanhamento" },
      { name: "description", content: "Veja seus pedidos recentes e acompanhe o preparo e a entrega." },
      { property: "og:title", content: "Meus pedidos — histórico e acompanhamento" },
      { property: "og:description", content: "Veja seus pedidos recentes e acompanhe o preparo e a entrega." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyOrdersPage,
});

function MyOrdersPage() {
  const [orders, setOrders] = useState<SavedOrder[]>([]);
  useEffect(() => setOrders(getMyOrders()), []);

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 pb-28 pt-6">
      <h1 className="font-display text-3xl font-extrabold">Meus pedidos</h1>
      <p className="mt-1 text-sm text-muted-foreground">Toque em um pedido para acompanhar o status.</p>

      <section className="mt-6 space-y-3">
        {orders.map((o) => (
          <Link
            key={o.id}
            to="/pedido/$id"
            params={{ id: o.id }}
            className="glass-card flex items-center gap-3 rounded-[1.5rem] p-4"
          >
            <div className="icon-tile grid h-12 w-12 shrink-0 place-items-center rounded-2xl">
              <ReceiptText className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold">Pedido #{o.number}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(o.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </p>
            </div>
            <span className="text-sm font-black text-primary">{brl(o.total)}</span>
          </Link>
        ))}
        {orders.length === 0 && (
          <div className="glass-card rounded-[1.5rem] py-16 text-center">
            <p className="text-muted-foreground">Você ainda não fez pedidos neste aparelho.</p>
            <Link to="/" className="neon-button mt-4 inline-flex rounded-full px-5 py-3 text-sm font-bold">
              Fazer um pedido
            </Link>
          </div>
        )}
      </section>

      <BottomNav />
    </div>
  );
}
