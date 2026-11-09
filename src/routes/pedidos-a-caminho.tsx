import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Bike, CheckCircle2, Clock, Navigation, ShoppingBag, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/pedidos-a-caminho")({
  component: PedidosACaminhoPage,
});

interface IncomingOrder {
  id: string;
  clientName: string;
  items: string;
  etaMinutes: number;
  status: "a_caminho" | "preparando" | "pronto";
}

function PedidosACaminhoPage() {
  const [orders, setOrders] = useState<IncomingOrder[]>([
    {
      id: "PED-102",
      clientName: "Marcos Vinicius",
      items: "2x X-Burguer Artesanal + 1x Coca 600ml",
      etaMinutes: 8,
      status: "a_caminho",
    },
    {
      id: "PED-105",
      clientName: "Ana Paula",
      items: "1x Pastel de Carne + 1x Caldo de Cana",
      etaMinutes: 3,
      status: "preparando",
    },
  ]);

  const handleAdvanceStatus = (id: string, currentStatus: string) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === id) {
          const nextStatus = currentStatus === "a_caminho" ? "preparando" : "pronto";
          return { ...ord, status: nextStatus as any };
        }
        return ord;
      })
    );
    toast.success("Status do pedido antecipado atualizado com sucesso!");
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
          <Bike className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
          <span>Fluxo Just-in-Time (Inovação do Davi)</span>
        </div>
        <h1 className="font-display text-3xl font-extrabold">Clientes a Caminho</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie os pedidos antecipados. O cliente avisa a distância e você prepara para entregar na hora certa, sem filas.
        </p>
      </div>

      {/* Lista de Pedidos de Clientes a Caminho */}
      <section className="mt-6 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Fila de Chegada Imediata ({orders.length})
        </h2>

        {orders.map((ord) => (
          <div 
            key={ord.id}
            className="glass-card rounded-[1.5rem] p-5 space-y-4 border border-border/80 shadow-lg"
          >
            <div className="flex justify-between items-start gap-2">
              <div>
                <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {ord.id}
                </span>
                <h3 className="text-base font-extrabold mt-1.5">{ord.clientName}</h3>
                <p className="text-xs text-muted-foreground">{ord.items}</p>
              </div>

              <div className="text-right bg-background/50 p-2.5 rounded-xl border border-border/50">
                <span className="text-[0.65rem] text-muted-foreground block">Chegando em</span>
                <span className="text-sm font-black text-amber-400 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> ~{ord.etaMinutes} min
                </span>
              </div>
            </div>

            {/* Status Visual */}
            <div className="flex items-center gap-2 pt-1">
              <span className={`text-xs px-2.5 py-1 rounded-lg font-bold border ${
                ord.status === 'a_caminho' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                ord.status === 'preparando' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                {ord.status === 'a_caminho' ? '🚶 Cliente a Caminho' :
                 ord.status === 'preparando' ? '🔥 Preparando na Barraca' : '✅ Pronto para Entrega'}
              </span>
            </div>

            {/* Ação de Avançar */}
            <div className="pt-2 flex justify-end border-t border-border/40">
              {ord.status !== 'pronto' ? (
                <Button
                  onClick={() => handleAdvanceStatus(ord.id, ord.status)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold text-xs py-2 h-auto"
                >
                  <Utensils className="h-4 w-4 mr-1.5" /> 
                  {ord.status === 'a_caminho' ? 'Iniciar Preparo' : 'Marcar como Pronto'}
                </Button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> Entregue ao Cliente
                </span>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}