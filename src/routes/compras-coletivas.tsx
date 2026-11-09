import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Flame, ShoppingCart, TrendingDown, Truck, Zap, ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/compras-coletivas")({
  component: ComprasColetivasPage,
});

interface Campaign {
  id: number;
  product_name: string;
  category: string;
  base_price: number;
  bulk_price: number;
  min_units: number;
  current_units: number;
  expires_at: string;
}

function ComprasColetivasPage() {
  const [campaigns] = useState<Campaign[]>([
    {
      id: 1,
      product_name: "Caixa de Refrigerante 600ml (Lote Direto da Fábrica)",
      category: "Bebidas",
      base_price: 65.00,
      bulk_price: 42.50,
      min_units: 500,
      current_units: 380,
      expires_at: "2026-11-12T23:59:59Z",
    },
    {
      id: 2,
      product_name: "Fardo de Copos Descartáveis 300ml (1.000 un.)",
      category: "Insumos",
      base_price: 90.00,
      bulk_price: 58.00,
      min_units: 300,
      current_units: 210,
      expires_at: "2026-11-13T18:00:00Z",
    },
  ]);

  const [selectedUnits, setSelectedUnits] = useState<{ [key: number]: number }>({
    1: 10,
    2: 5,
  });

  const handleJoinOrder = (campaign: Campaign) => {
    const units = selectedUnits[campaign.id] || 5;
    const qualifiesFreeShipping = units >= 10;

    toast.success(
      `Sucesso! ${units} unidades reservadas no lote coletivo. ${
        qualifiesFreeShipping ? "🚚 Frete Grátis Progressivo Garantido!" : ""
      }`
    );
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
        <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-[0.65rem] font-bold text-cyan-400 border border-cyan-500/20 mb-2">
          <Flame className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
          <span>Alibaba do Davi (B2B)</span>
        </div>
        <h1 className="font-display text-3xl font-extrabold">Compras Coletivas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Junte-se a outros ambulantes, corte o atravessador e maximize suas margens direto da fábrica.
        </p>
      </div>

      {/* Lista de Campanhas */}
      <section className="mt-6 space-y-4">
        {campaigns.map((camp) => {
          const progress = Math.min(Math.round((camp.current_units / camp.min_units) * 100), 100);
          const units = selectedUnits[camp.id] || 5;
          const dynamicPrice = (
            camp.base_price -
            (camp.base_price - camp.bulk_price) * (progress / 100)
          ).toFixed(2);

          const hasFreeShipping = units >= 10;

          return (
            <div 
              key={camp.id}
              className="glass-card rounded-[1.5rem] p-5 space-y-4 border border-border/80 shadow-lg"
            >
              <div className="flex justify-between items-start gap-3">
                <div>
                  <span className="text-[0.65px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">
                    {camp.category}
                  </span>
                  <h2 className="text-base font-extrabold mt-1.5">{camp.product_name}</h2>
                  <span className="text-xs text-muted-foreground">Depósito Central Três Rios</span>
                </div>

                <div className="text-right bg-background/50 p-2.5 rounded-xl border border-border/50">
                  <span className="text-[0.65rem] text-muted-foreground block">Preço no Lote</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-black text-emerald-400">R$ {dynamicPrice}</span>
                    <span className="text-xs text-muted-foreground line-through">R$ {camp.base_price.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Barra de Progresso */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Meta: {camp.current_units} / {camp.min_units} un.</span>
                  <span className="font-bold text-cyan-400">{progress}% Atingido</span>
                </div>
                <Progress value={progress} className="h-2.5 bg-background" />
              </div>

              {/* Selos de Regras (Davi) */}
              <div className="grid grid-cols-3 gap-2 pt-1 text-[0.7rem]">
                <div className="flex items-center gap-1.5 bg-background/40 p-2 rounded-lg border border-border/40 text-muted-foreground">
                  <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span><strong>1%</strong> Early Bird</span>
                </div>
                <div className={`flex items-center gap-1.5 p-2 rounded-lg border text-[0.7rem] ${
                  hasFreeShipping ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' : 'bg-background/40 border-border/40 text-muted-foreground'
                }`}>
                  <Truck className="h-3.5 w-3.5 shrink-0" />
                  <span><strong>Frete Grátis</strong> (≥10 un)</span>
                </div>
                <div className="flex items-center gap-1.5 bg-background/40 p-2 rounded-lg border border-border/40 text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  <span>QR Code</span>
                </div>
              </div>

              {/* Controles de Quantidade e Ação */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/40">
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <span className="text-xs text-muted-foreground">Qtd:</span>
                  {[5, 10, 20, 50].map((qty) => (
                    <button
                      key={qty}
                      onClick={() => setSelectedUnits({ ...selectedUnits, [camp.id]: qty })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                        units === qty
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-border hover:bg-accent'
                      }`}
                    >
                      {qty}
                    </button>
                  ))}
                </div>

                <Button
                  onClick={() => handleJoinOrder(camp)}
                  className="w-full sm:w-auto font-extrabold text-xs py-2 h-auto"
                >
                  <ShoppingCart className="h-3.5 w-3.5 mr-1.5" /> Entrar no Lote
                </Button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}