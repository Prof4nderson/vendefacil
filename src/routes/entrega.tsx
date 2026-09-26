import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Bike, Check, PackageCheck, MapPin, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { getOpsSessionInfo, courierLogin } from "@/lib/gate.functions";
import {
  getDeliveryBoard,
  assignDelivery,
  toggleItemChecked,
  setOutForDelivery,
  confirmDelivered,
} from "@/lib/ops.functions";
import { useOpsQuery } from "@/components/ops-gate";
import { brl, PAYMENT_METHODS } from "@/lib/format";

export const Route = createFileRoute("/entrega")({
  loader: () => getOpsSessionInfo(),
  head: () => ({
    meta: [
      { title: "Entregas" },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Entregas" },
      { property: "og:description", content: "Painel do entregador" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeliveryPage,
});

type Board = Awaited<ReturnType<typeof getDeliveryBoard>>;
type Order = Board["ready"][number];
type Item = Board["items"][number];

function DeliveryPage() {
  const session = Route.useLoaderData();
  const isCourier = session.roles.includes("entrega") || session.roles.includes("admin");

  if (!isCourier) return <CourierLogin />;
  return <Board courierName={session.courierName} isAdmin={session.roles.includes("admin")} />;
}

function CourierLogin() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useServerFn(courierLogin);

  async function submit() {
    setLoading(true);
    setError("");
    const res = await login({ data: { name, password } });
    if (!res.ok) {
      setError("Nome ou senha incorretos");
      setLoading(false);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bike className="h-6 w-6" />
        </div>
        <h1 className="font-display mt-4 text-center text-2xl font-bold">Entregador</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">Entre com seu nome e senha</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-5 w-full rounded-xl border border-input bg-background px-4 py-3"
          placeholder="Seu nome"
          autoFocus
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="mt-3 w-full rounded-xl border border-input bg-background px-4 py-3"
          placeholder="Senha"
        />
        {error && <p className="mt-2 text-center text-sm font-medium text-destructive">{error}</p>}
        <button
          onClick={submit}
          disabled={loading || !name || !password}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Entrar
        </button>
      </div>
    </div>
  );
}

function Board({ courierName, isAdmin }: { courierName: string | null; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const fetchBoard = useServerFn(getDeliveryBoard);
  const assign = useServerFn(assignDelivery);
  const toggle = useServerFn(toggleItemChecked);
  const out = useServerFn(setOutForDelivery);
  const delivered = useServerFn(confirmDelivered);

  const { data } = useOpsQuery(["delivery"], fetchBoard);
  const [payMethod, setPayMethod] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  // Avisa quando surgem novos pedidos prontos para entrega
  const seenReady = useRef<Set<number> | null>(null);
  useEffect(() => {
    if (!data) return;
    const numbers = data.ready.map((o) => o.order_number);
    if (seenReady.current === null) {
      seenReady.current = new Set(numbers);
      return;
    }
    for (const n of numbers) {
      if (!seenReady.current.has(n)) {
        seenReady.current.add(n);
        toast.success(`Pedido #${n} pronto para entrega!`);
      }
    }
  }, [data]);

  async function run(key: string, fn: () => Promise<unknown>, okMsg?: string) {
    setBusy(key);
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
      queryClient.invalidateQueries({ queryKey: ["delivery"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  }

  const ready: Order[] = data?.ready ?? [];
  const mine: Order[] = data?.mine ?? [];
  const items: Item[] = data?.items ?? [];
  const itemsOf = (orderId: string) => items.filter((i) => i.order_id === orderId);

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 py-4">
      <header className="mb-4 flex items-center gap-2">
        <Bike className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">Entregas</h1>
        {courierName && <span className="ml-auto text-sm text-muted-foreground">{courierName}</span>}
        {isAdmin && !courierName && (
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <KeyRound className="h-3 w-3" /> Admin
          </span>
        )}
      </header>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Prontos para entrega ({ready.length})
      </h2>
      <div className="space-y-3">
        {ready.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Nenhum pedido aguardando
          </p>
        )}
        {ready.map((order) => (
          <article key={order.id} className="rounded-2xl border border-border bg-card p-4">
            <OrderHeader order={order} />
            <ul className="mt-2 space-y-1 text-sm">
              {itemsOf(order.id).map((i) => (
                <li key={i.id}>
                  <span className="font-semibold">{i.qty}×</span> {i.name}
                  {i.notes && <p className="ml-5 text-xs text-muted-foreground">⚠ {i.notes}</p>}
                </li>
              ))}
            </ul>
            <button
              onClick={() => run(`assign-${order.id}`, () => assign({ data: { orderId: order.id } }), "Entrega assumida")}
              disabled={busy === `assign-${order.id}`}
              className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Assumir entrega
            </button>
          </article>
        ))}
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Minhas entregas ({mine.length})
      </h2>
      <div className="space-y-3 pb-8">
        {mine.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Você não tem entregas em andamento
          </p>
        )}
        {mine.map((order) => {
          const orderItems = itemsOf(order.id);
          const allChecked = orderItems.length > 0 && orderItems.every((i) => i.checked);
          return (
            <article key={order.id} className="rounded-2xl border border-border bg-card p-4">
              <OrderHeader order={order} />
              {order.address && (
                <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {order.address}
                </p>
              )}
              {order.customer_phone && (
                <a href={`tel:${order.customer_phone}`} className="mt-1 block text-xs font-medium text-primary underline">
                  {order.customer_phone}
                </a>
              )}

              <ul className="mt-3 space-y-2">
                {orderItems.map((i) => (
                  <li key={i.id}>
                    <button
                      onClick={() => run(`chk-${i.id}`, () => toggle({ data: { itemId: i.id, checked: !i.checked } }))}
                      className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left text-sm"
                    >
                      <span className={`flex h-6 w-6 items-center justify-center rounded-md ${i.checked ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                        {i.checked && <Check className="h-4 w-4" />}
                      </span>
                      <span className={i.checked ? "line-through opacity-60" : ""}>
                        <span className="font-semibold">{i.qty}×</span> {i.name}
                        {i.notes && <span className="block text-xs text-muted-foreground">⚠ {i.notes}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              {order.status !== "out_for_delivery" ? (
                <button
                  onClick={() => run(`out-${order.id}`, () => out({ data: { orderId: order.id } }), "Saiu para entrega!")}
                  disabled={!allChecked || busy === `out-${order.id}`}
                  className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                >
                  {allChecked ? "Sair para entrega" : "Confira todos os itens acima"}
                </button>
              ) : (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Confirmar pagamento ({brl(order.total)})</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m}
                        onClick={() => setPayMethod((p) => ({ ...p, [order.id]: m }))}
                        className={`rounded-lg border-2 py-2 text-xs ${(payMethod[order.id] ?? order.payment_method) === m ? "border-primary bg-primary/10 font-semibold" : "border-border"}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() =>
                      run(
                        `done-${order.id}`,
                        () =>
                          delivered({
                            data: { orderId: order.id, payment_method: payMethod[order.id] ?? order.payment_method },
                          }),
                        "Entrega concluída!",
                      )
                    }
                    disabled={busy === `done-${order.id}`}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    <PackageCheck className="h-4 w-4" /> Confirmar entrega e pagamento
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function OrderHeader({ order }: { order: Order }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="font-display text-xl font-bold">#{order.order_number}</span>
        <p className="text-sm font-medium">{order.customer_name}</p>
      </div>
      <span className="text-sm font-semibold">{brl(order.total)}</span>
    </div>
  );
}
