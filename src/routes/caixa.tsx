import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Wallet, TrendingUp, TrendingDown, DoorOpen, DoorClosed } from "lucide-react";
import { toast } from "sonner";
import { OpsGate, useOpsQuery, hasOpsAccess } from "@/components/ops-gate";
import { getOpsSessionInfo } from "@/lib/gate.functions";
import { getCashierData, openShift, addCashEntry, closeShift } from "@/lib/ops.functions";
import { brl, PAYMENT_METHODS } from "@/lib/format";


export const Route = createFileRoute("/caixa")({
  loader: () => getOpsSessionInfo(),
  head: () => ({
    meta: [
      { title: "Caixa" },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Caixa" },
      { property: "og:description", content: "Controle de caixa e turno" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CashierPage,
});

type Report = {
  opened_at: string;
  closed_at: string;
  opening_amount: number;
  total_income: number;
  total_expense: number;
  by_method: Record<string, number>;
  orders_count: number;
  orders_total: number;
  orders: { order_number: number; customer_name: string; total: number; payment_method: string }[];
};

function CashierPage() {
  const session = Route.useLoaderData();
  const queryClient = useQueryClient();
  const fetchData = useServerFn(getCashierData);
  const open = useServerFn(openShift);
  const addEntry = useServerFn(addCashEntry);
  const close = useServerFn(closeShift);

  const { data } = useOpsQuery(["cashier"], fetchData, 5000, hasOpsAccess(session, "caixa"));
  const [opening, setOpening] = useState("");
  const [entryType, setEntryType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  const [description, setDescription] = useState("");
  const [report, setReport] = useState<Report | null>(null);


  const shift = data?.shift ?? null;
  const entries = data?.entries ?? [];
  const income = entries.filter((e) => e.type === "income").reduce((s, e) => s + Number(e.amount), 0);
  const expense = entries.filter((e) => e.type === "expense").reduce((s, e) => s + Number(e.amount), 0);

  async function handleOpen() {
    try {
      await open({ data: { opening_amount: Number(opening.replace(",", ".")) || 0 } });
      toast.success("Turno aberto!");
      queryClient.invalidateQueries({ queryKey: ["cashier"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function handleEntry() {
    const value = Number(amount.replace(",", "."));
    if (!value || value <= 0) { toast.error("Informe um valor"); return; }
    if (!description.trim()) { toast.error("Informe a descrição"); return; }
    try {
      await addEntry({
        data: { type: entryType, amount: value, description, method: entryType === "income" ? method : undefined },
      });
      toast.success("Lançamento registrado");
      setAmount("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["cashier"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function handleClose() {
    if (!window.confirm("Fechar o turno e gerar o relatório de faturamento?")) return;
    try {
      const res = await close({ data: {} });
      setReport(res.report as Report);
      queryClient.invalidateQueries({ queryKey: ["cashier"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <OpsGate role="caixa" title="Caixa" session={session}>
      <div className="mx-auto min-h-screen max-w-xl px-4 py-4 pb-10">
        <header className="mb-4 flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">Caixa</h1>
        </header>

        {!shift ? (
          <div className="rounded-3xl border border-border bg-card p-5">
            <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
              <DoorOpen className="h-5 w-5 text-primary" /> Abrir turno
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Informe o valor inicial em caixa (fundo de troco)</p>
            <input
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className="mt-4 w-full rounded-xl border border-input bg-background px-4 py-3"
            />
            <button onClick={handleOpen} className="mt-4 w-full rounded-2xl bg-primary py-3.5 font-semibold text-primary-foreground">
              Abrir turno
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">Entradas</p>
                <p className="mt-1 text-sm font-bold text-primary">{brl(income)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">Saídas</p>
                <p className="mt-1 text-sm font-bold text-destructive">{brl(expense)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">Saldo</p>
                <p className="mt-1 text-sm font-bold">{brl(Number(shift.opening_amount) + income - expense)}</p>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-border bg-card p-5">
              <h2 className="font-display text-lg font-semibold">Novo lançamento</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setEntryType("income")}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-medium ${entryType === "income" ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  <TrendingUp className="h-4 w-4" /> Receita
                </button>
                <button
                  onClick={() => setEntryType("expense")}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-medium ${entryType === "expense" ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  <TrendingDown className="h-4 w-4" /> Despesa
                </button>
              </div>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="Valor (0,00)"
                className="mt-3 w-full rounded-xl border border-input bg-background px-4 py-3"
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição"
                className="mt-3 w-full rounded-xl border border-input bg-background px-4 py-3"
              />
              {entryType === "income" && (
                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMethod(m)}
                      className={`rounded-lg border-2 py-2 text-xs ${method === m ? "border-primary bg-primary/10 font-semibold" : "border-border"}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={handleEntry} className="mt-4 w-full rounded-2xl bg-primary py-3.5 font-semibold text-primary-foreground">
                Registrar
              </button>
            </div>

            <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Lançamentos do turno ({entries.length})
            </h2>
            <div className="space-y-2">
              {entries.length === 0 && (
                <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  Nenhum lançamento ainda
                </p>
              )}
              {entries.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{e.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.method ?? (e.type === "expense" ? "Despesa" : "Receita")} •{" "}
                      {new Date(e.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <span className={`text-sm font-bold ${e.type === "income" ? "text-primary" : "text-destructive"}`}>
                    {e.type === "income" ? "+" : "−"}{brl(e.amount)}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={handleClose}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-4 font-semibold text-background"
            >
              <DoorClosed className="h-5 w-5" /> Fechar turno e gerar relatório
            </button>
          </>
        )}

        {report && (
          <div className="fixed inset-0 z-40 flex flex-col justify-end bg-scrim" onClick={() => setReport(null)}>
            <div className="max-h-[90vh] overflow-y-auto rounded-t-3xl bg-background p-5" onClick={(e) => e.stopPropagation()}>
              <h2 className="font-display text-xl font-bold">Relatório do turno</h2>
              <p className="text-xs text-muted-foreground">
                {new Date(report.opened_at).toLocaleString("pt-BR")} → {new Date(report.closed_at).toLocaleString("pt-BR")}
              </p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span>Fundo inicial</span><span className="font-medium">{brl(report.opening_amount)}</span></div>
                <div className="flex justify-between"><span>Pedidos ({report.orders_count})</span><span className="font-medium">{brl(report.orders_total)}</span></div>
                <div className="flex justify-between"><span>Total de entradas</span><span className="font-bold text-primary">{brl(report.total_income)}</span></div>
                <div className="flex justify-between"><span>Total de saídas</span><span className="font-bold text-destructive">{brl(report.total_expense)}</span></div>
                <div className="flex justify-between border-t border-border pt-2 font-bold">
                  <span>Saldo final</span>
                  <span>{brl(report.opening_amount + report.total_income - report.total_expense)}</span>
                </div>
              </div>
              <h3 className="mt-4 text-sm font-semibold">Por meio de pagamento</h3>
              <div className="mt-2 space-y-1 text-sm">
                {Object.entries(report.by_method).map(([m, v]) => (
                  <div key={m} className="flex justify-between"><span>{m}</span><span className="font-medium">{brl(v)}</span></div>
                ))}
                {Object.keys(report.by_method).length === 0 && <p className="text-muted-foreground">Sem receitas no turno.</p>}
              </div>
              <button onClick={() => setReport(null)} className="mt-5 w-full rounded-2xl bg-primary py-3.5 font-semibold text-primary-foreground">
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </OpsGate>
  );
}
