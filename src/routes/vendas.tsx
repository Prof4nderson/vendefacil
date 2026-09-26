import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Ban, CheckCircle2, Eye, LockKeyhole, Trash2, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import { getSales, cancelSale, deleteSaleAdmin, type SaleRow } from "@/lib/sales.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/vendas")({
  loader: () => getSales(),
  head: () => ({
    meta: [{ title: "Vendas — VendeFácil" }, { name: "robots", content: "noindex" }],
  }),
  component: SalesPage,
});

function labelStatus(status: string) {
  if (status === "cancelled") return "Cancelada";
  if (status === "confirmed") return "Em aberto";
  return "Finalizada";
}

function SalesPage() {
  const initial = Route.useLoaderData() as SaleRow[];
  const [sales, setSales] = useState(initial);
  const cancel = useServerFn(cancelSale);
  const remove = useServerFn(deleteSaleAdmin);
  const [passwordSale, setPasswordSale] = useState<SaleRow | null>(null);
  const [password, setPassword] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "done" | "cancelled">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const visible = sales.filter(
    (s) =>
      filter === "all" ||
      (filter === "open"
        ? s.status === "confirmed"
        : filter === "done"
          ? s.status !== "cancelled" && s.status !== "confirmed"
          : s.status === "cancelled"),
  );

  async function doCancel(sale: SaleRow) {
    if (!window.confirm(`Cancelar a venda #${sale.order_number}? O valor não será faturado.`))
      return;
    const observation = window.prompt("Observação do cancelamento (opcional):", "") ?? "";
    try {
      await cancel({ data: { orderId: sale.id, observation } });
      setSales((old) => old.map((x) => (x.id === sale.id ? { ...x, status: "cancelled" } : x)));
      toast.success("Venda cancelada e estoque devolvido");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível cancelar");
    }
  }
  async function doDelete() {
    if (!passwordSale) return;
    try {
      await remove({ data: { orderId: passwordSale.id, password } });
      setSales((old) => old.filter((x) => x.id !== passwordSale.id));
      setPasswordSale(null);
      setPassword("");
      toast.success("Venda excluída");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Senha inválida");
    }
  }

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <a href="/" className="grid h-10 w-10 place-items-center rounded-xl bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div>
            <p className="eyebrow">Gestão operacional</p>
            <h1 className="font-display text-xl font-bold">Ver vendas</h1>
          </div>
          <div className="ml-auto rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
            {visible.length} vendas
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5">
        <div className="mb-5 flex flex-wrap gap-2">
          {(
            [
              ["all", "Todas"],
              ["open", "Em aberto"],
              ["done", "Finalizadas"],
              ["cancelled", "Canceladas"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-full px-4 py-2 text-sm font-bold ${filter === key ? "neon-button" : "bg-secondary"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {visible.map((sale) => (
            <article
              key={sale.id}
              className={`glass-card rounded-2xl p-4 ${sale.status === "cancelled" ? "opacity-75" : ""}`}
            >
              <div className="flex flex-wrap items-start gap-3">
                <button
                  onClick={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
                  title="Mostrar produtos da venda"
                  className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary hover:bg-primary/20"
                >
                  <WalletCards className="h-5 w-5" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg font-bold">Venda #{sale.order_number}</h2>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${sale.status === "cancelled" ? "bg-red-400/15 text-red-300" : sale.status === "confirmed" ? "bg-amber-400/15 text-amber-300" : "bg-primary/15 text-primary"}`}
                    >
                      {labelStatus(sale.status)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {sale.customer_name} • {sale.items_count} itens •{" "}
                    {new Date(sale.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-xl font-black text-primary">{brl(sale.total)}</p>
                  <p className="text-xs text-muted-foreground">
                    {sale.payment_method}
                    {Number(sale.credit_amount) > 0 ? ` • fiado ${brl(sale.credit_amount)}` : ""}
                  </p>
                </div>
              </div>
              {expandedId === sale.id && (
                <div className="mt-3 rounded-xl bg-secondary/60 p-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Produtos do pedido
                  </p>
                  <div className="space-y-2">
                    {sale.items.map((item, index) => (
                      <div
                        key={`${item.name}-${index}`}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>
                          <b>{item.qty}×</b> {item.name}
                        </span>
                        <span className="font-bold">{brl(Number(item.price) * item.qty)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>
                    Pago: <b className="text-foreground">{brl(sale.amount_paid)}</b>
                  </span>
                  {Number(sale.credit_amount) > 0 && (
                    <span>
                      Devedor: <b className="text-amber-300">{brl(sale.credit_amount)}</b>
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {sale.status !== "cancelled" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => doCancel(sale)}
                      className="rounded-lg text-xs"
                    >
                      <Ban className="mr-1 h-3.5 w-3.5" /> Cancelar
                    </Button>
                  )}
                  {sale.status === "cancelled" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPasswordSale(sale)}
                      className="rounded-lg text-xs"
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir Admin
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      toast.info(`Venda #${sale.order_number}: ${labelStatus(sale.status)}`)
                    }
                    className="rounded-lg text-xs"
                  >
                    <Eye className="mr-1 h-3.5 w-3.5" /> Detalhes
                  </Button>
                </div>
              </div>
            </article>
          ))}
          {visible.length === 0 && (
            <div className="glass-card rounded-2xl p-12 text-center text-muted-foreground">
              <CheckCircle2 className="mx-auto h-8 w-8" />
              <p className="mt-3 font-semibold">Nenhuma venda nesta categoria.</p>
            </div>
          )}
        </div>
      </main>
      {passwordSale && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-scrim px-4"
          onClick={() => setPasswordSale(null)}
        >
          <div
            className="glass-card w-full max-w-sm rounded-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <LockKeyhole className="h-6 w-6 text-primary" />
            <h2 className="mt-3 font-display text-xl font-bold">Senha do administrador</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A exclusão física só é permitida para vendas já canceladas.
            </p>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha Admin"
              className="mt-4 h-11 w-full rounded-xl border border-input bg-background px-3"
            />
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                onClick={() => setPasswordSale(null)}
                className="flex-1 rounded-xl"
              >
                Voltar
              </Button>
              <Button onClick={doDelete} className="neon-button flex-1 rounded-xl">
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
