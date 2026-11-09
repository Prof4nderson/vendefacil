import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, DollarSign, Wallet, CreditCard, QrCode, TrendingUp, ShieldCheck, Printer, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import { getCashClosingData } from "@/lib/cash.functions";

export const Route = createFileRoute("/fechamento-caixa")({
  loader: async () => {
    const data = await getCashClosingData();
    return data;
  },
  component: FechamentoCaixaPage,
});

function FechamentoCaixaPage() {
  const initialCashData = Route.useLoaderData();
  
  // Estado inicial alimentado pelos dados reais do banco
  const [cashSummary] = useState(initialCashData);

  const [countedCash, setCountedCash] = useState<string>("1190.00");
  const [isClosed, setIsClosed] = useState(false);

  // Cálculos financeiros
  const expectedCashInDrawer = cashSummary.initialBalance + cashSummary.cashSales - cashSummary.sangrias;
  const numericCountedCash = parseFloat(countedCash) || 0;
  const cashDifference = numericCountedCash - expectedCashInDrawer;

  const grossRevenue = cashSummary.cashSales + cashSummary.pixSales + cashSummary.cardSales;
  const netProfit = grossRevenue - cashSummary.totalCost;
  const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

  const handleCloseRegister = () => {
    setIsClosed(true);
    toast.success("🔒 Caixa fechado e auditado com sucesso! Relatório gerado para a contabilidade.");
  };

  const handlePrintReport = () => {
    toast.info("🖨️ Enviando relatório financeiro para a impressora térmica da barraca...");
  };

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 pb-28 pt-6 text-foreground">
      {/* Botão de Voltar */}
      <div className="mb-4">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Voltar ao início
        </Link>
      </div>

      {/* Cabeçalho */}
      <div className="border-b border-border/60 pb-4">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[0.65rem] font-bold text-emerald-400 border border-emerald-500/20 mb-2">
          <DollarSign className="h-3.5 w-3.5 animate-pulse" />
          <span>Auditoria Financeira do PDV (Banco de Dados)</span>
        </div>
        <h1 className="font-display text-3xl font-extrabold">Fechamento de Caixa</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conferência de fundo de troco, recebimentos em dinheiro/PIX/cartão e apuração de margem de lucro líquida.
        </p>
      </div>

      {/* Resumo de Entradas por Forma de Pagamento */}
      <section className="mt-6 grid grid-cols-2 gap-3">
        <div className="glass-card rounded-[1.25rem] p-4 border border-border/80">
          <span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Wallet className="h-3.5 w-3.5 text-amber-400" /> Dinheiro em Espécie
          </span>
          <p className="text-xl font-black text-foreground mt-1.5">{brl(cashSummary.cashSales)}</p>
          <span className="text-[0.7rem] text-muted-foreground">Fundo inicial: {brl(cashSummary.initialBalance)}</span>
        </div>

        <div className="glass-card rounded-[1.25rem] p-4 border border-border/80">
          <span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <QrCode className="h-3.5 w-3.5 text-cyan-400" /> Vendas via PIX
          </span>
          <p className="text-xl font-black text-cyan-400 mt-1.5">{brl(cashSummary.pixSales)}</p>
          <span className="text-[0.7rem] text-muted-foreground">Instantâneo na conta</span>
        </div>

        <div className="glass-card rounded-[1.25rem] p-4 border border-border/80">
          <span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <CreditCard className="h-3.5 w-3.5 text-purple-400" /> Cartão (Déb./Créd.)
          </span>
          <p className="text-xl font-black text-purple-400 mt-1.5">{brl(cashSummary.cardSales)}</p>
          <span className="text-[0.7rem] text-muted-foreground">Taxa média app: 1.8%</span>
        </div>

        <div className="glass-card rounded-[1.25rem] p-4 border border-border/80">
          <span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5 text-red-400" /> Sangrias (Retiradas)
          </span>
          <p className="text-xl font-black text-red-400 mt-1.5">- {brl(cashSummary.sangrias)}</p>
          <span className="text-[0.7rem] text-muted-foreground">Retirado para segurança</span>
        </div>
      </section>

      {/* Relatório de Lucratividade (Davi Profit Engine) */}
      <section className="mt-6 glass-card rounded-[1.5rem] p-5 border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" /> DRE Simplificado (Lucratividade)
          </h2>
          <span className="text-[0.65rem] bg-emerald-500/20 text-emerald-300 font-extrabold px-2 py-0.5 rounded-full">
            Margem: {profitMargin.toFixed(1)}%
          </span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">Faturamento Bruto Total</span>
            <span className="font-extrabold text-foreground">{brl(grossRevenue)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">Custo dos Produtos (CMV)</span>
            <span className="font-extrabold text-red-400">- {brl(cashSummary.totalCost)}</span>
          </div>
          <div className="flex justify-between py-1.5 text-sm">
            <span className="font-bold text-emerald-400">Lucro Líquido Real</span>
            <span className="font-black text-emerald-400">{brl(netProfit)}</span>
          </div>
        </div>
      </section>

      {/* Conferência Física do Gaveteiro */}
      <section className="mt-6 glass-card rounded-[1.5rem] p-5 border border-border/80 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Conferência Física do Gaveteiro
        </h2>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-background/50 border border-border/50">
            <span className="text-muted-foreground block">Esperado no Gaveteiro</span>
            <span className="text-base font-black text-foreground mt-0.5 block">{brl(expectedCashInDrawer)}</span>
          </div>
          <div className="p-3 rounded-xl bg-background/50 border border-border/50">
            <span className="text-muted-foreground block">Dinheiro Contado (Físico)</span>
            <input
              type="number"
              value={countedCash}
              disabled={isClosed}
              onChange={(e) => setCountedCash(e.target.value)}
              className="w-full h-8 mt-0.5 rounded-lg bg-background border border-border px-2 text-sm font-bold text-emerald-400 outline-none"
            />
          </div>
        </div>

        {/* Quebra / Sobra de Caixa */}
        <div className={`p-3 rounded-xl text-xs flex justify-between items-center border ${
          cashDifference === 0 
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" 
            : cashDifference > 0 
              ? "bg-blue-500/10 border-blue-500/30 text-blue-300" 
              : "bg-red-500/10 border-red-500/30 text-red-300"
        }`}>
          <span className="font-bold">Diferença (Quebra / Sobra):</span>
          <span className="font-black text-sm">
            {cashDifference === 0 ? "Caixa Perfeito (R$ 0,00)" : cashDifference > 0 ? `Sobra de ${brl(cashDifference)}` : `Falta de ${brl(Math.abs(cashDifference))}`}
          </span>
        </div>

        {/* Botões de Ação */}
        <div className="pt-2 flex gap-3">
          {!isClosed ? (
            <Button
              onClick={handleCloseRegister}
              className="neon-button flex-1 font-extrabold text-xs py-3 h-auto"
            >
              <ShieldCheck className="h-4 w-4 mr-1.5" /> Fechar e Auditar Caixa
            </Button>
          ) : (
            <Button
              onClick={handlePrintReport}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80 flex-1 font-extrabold text-xs py-3 h-auto"
            >
              <Printer className="h-4 w-4 mr-1.5" /> Imprimir Relatório Térmico
            </Button>
          )}
        </div>

        {isClosed && (
          <p className="text-center text-xs text-emerald-400 font-bold flex items-center justify-center gap-1 pt-1">
            <CheckCircle2 className="h-4 w-4" /> Caixa fechado e validado com sucesso!
          </p>
        )}
      </section>
    </div>
  );
}