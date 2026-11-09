import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Crown, Trophy, X, History, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { updatePartnerKarma } from "@/lib/ranking.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/ranking-amigos")({
  component: RankingAmigosPage,
});

interface MerchantRank {
  position: number;
  partnerId: string;
  name: string;
  location: string;
  helps: number;
  alibabaCount: number;
  jitCount: number;
  points: number;
  badge: string;
  isUser?: boolean;
  history: Array<{ date: string; action: string; item: string; qty: number }>;
}

function RankingAmigosPage() {
  const saveKarma = useServerFn(updatePartnerKarma);

  const [merchants, setMerchants] = useState<MerchantRank[]>([
    {
      position: 1,
      partnerId: "partner-001",
      name: "Carlos da Coxinha",
      location: "Praça Principal - Setor A",
      helps: 14,
      alibabaCount: 5,
      jitCount: 8,
      points: 1650,
      badge: "Lenda da Feira 👑",
      history: [
        { date: "Ontem, 18:30", action: "Emprestou estoque", item: "Óleo de Soja 900ml", qty: 2 },
        { date: "3 dias atrás", action: "Socorreu no JIT", item: "Farinha de Trigo", qty: 5 },
      ],
    },
    {
      position: 2,
      partnerId: "partner-123",
      name: "Sua Barraca (Você)",
      location: "Praça Principal - Setor B",
      helps: 9,
      alibabaCount: 2,
      jitCount: 4,
      points: 1100,
      badge: "Guardião da Praça 🛡️",
      isUser: true,
      history: [
        { date: "Hoje, 12:15", action: "Emprestou estoque", item: "Refrigerante Lata Cola", qty: 6 },
        { date: "4 dias atrás", action: "Socorreu no JIT", item: "Copos Descartáveis 300ml", qty: 2 },
      ],
    },
    {
      position: 3,
      partnerId: "partner-003",
      name: "Pastelaria da Maria",
      location: "Rua do Comércio",
      helps: 7,
      alibabaCount: 1,
      jitCount: 3,
      points: 850,
      badge: "Protetor do Lote 🤝",
      history: [
        { date: "2 dias atrás", action: "Emprestou estoque", item: "Queijo Mussarela (kg)", qty: 3 },
      ],
    },
    {
      position: 4,
      partnerId: "partner-004",
      name: "Bebidas do Alemão",
      location: "Esquina Cultural",
      helps: 4,
      alibabaCount: 1,
      jitCount: 1,
      points: 480,
      badge: "Parceiro Solidário",
      history: [
        { date: "Semana passada", action: "Emprestou estoque", item: "Água Mineral 500ml", qty: 12 },
      ],
    },
  ]);

  const [selectedMerchant, setSelectedMerchant] = useState<MerchantRank | null>(null);
  const [updating, setUpdating] = useState(false);

  async function handleSyncKarma(merchant: MerchantRank) {
    setUpdating(true);
    try {
      const result = await saveKarma({
        data: {
          partnerId: merchant.partnerId,
          radarHelps: merchant.helps,
          alibabaCount: merchant.alibabaCount,
          jitCount: merchant.jitCount,
        },
      });

      // Atualiza a pontuação na lista localmente com o retorno do servidor
      setMerchants((prev) =>
        prev.map((m) => (m.partnerId === merchant.partnerId ? { ...m, points: result.score } : m))
      );

      toast.success(`Karma sincronizado! Score: ${result.score} pts. Medalhas: ${result.medals.join(", ")}`);
    } catch {
      toast.error("Erro ao sincronizar o score de karma.");
    } finally {
      setUpdating(false);
    }
  }

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
        <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[0.65rem] font-bold text-amber-400 border border-amber-500/20 mb-2">
          <Trophy className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
          <span>Hall da Fama Cívico-Comercial</span>
        </div>
        <h1 className="font-display text-3xl font-extrabold">Ranking da Praça</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Toque em qualquer ambulante para ver o histórico detalhado e sincronizar o Karma na rede.
        </p>
      </div>

      {/* Destaque do Top 1 */}
      <div 
        onClick={() => setSelectedMerchant(merchants[0])}
        className="mt-6 glass-card rounded-[1.5rem] p-5 border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-transparent to-transparent flex items-center gap-4 cursor-pointer hover:border-amber-500 transition-all"
      >
        <div className="relative">
          <div className="absolute -top-3 -left-3 bg-amber-500 text-slate-950 p-1.5 rounded-full shadow-lg">
            <Crown className="h-5 w-5 font-black" />
          </div>
          <Avatar className="h-16 w-16 border-2 border-amber-500">
            <AvatarFallback className="bg-amber-500/20 text-amber-400 font-black text-xl">CC</AvatarFallback>
          </Avatar>
        </div>
        <div className="flex-1">
          <span className="text-[0.65rem] font-extrabold uppercase tracking-wider text-amber-400">Rei do Estoque da Região</span>
          <h2 className="text-lg font-black text-foreground">{merchants[0].name}</h2>
          <p className="text-xs text-muted-foreground">{merchants[0].helps} socorros realizados • {merchants[0].points} pts</p>
        </div>
      </div>

      {/* Lista de Posições */}
      <section className="mt-6 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Classificação Geral da Região
        </h2>

        {merchants.map((m) => (
          <div 
            key={m.position}
            onClick={() => setSelectedMerchant(m)}
            className={`glass-card rounded-[1.25rem] p-4 flex items-center justify-between border transition-all cursor-pointer hover:scale-[1.01] ${
              m.isUser ? 'border-primary/50 bg-primary/10 shadow-lg' : 'border-border/60 hover:border-primary/40'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={`flex items-center justify-center w-8 h-8 rounded-xl font-black text-xs ${
                m.position === 1 ? 'bg-amber-500 text-slate-950' : 
                m.position === 2 ? 'bg-slate-300 text-slate-950' : 
                m.position === 3 ? 'bg-amber-700 text-white' : 'bg-background text-muted-foreground border border-border'
              }`}>
                #{m.position}
              </span>
              <div>
                <h3 className="text-sm font-extrabold flex items-center gap-2">
                  {m.name} {m.isUser && <span className="text-[0.65rem] bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Você</span>}
                </h3>
                <p className="text-[0.7rem] text-muted-foreground">{m.badge} • {m.location}</p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-black text-cyan-400 block">{m.points} pts</span>
              <span className="text-[0.65rem] text-muted-foreground">{m.helps} socorros</span>
            </div>
          </div>
        ))}
      </section>

      {/* Modal Interativo com Sincronização de Karma */}
      {selectedMerchant && (
        <div 
          className="fixed inset-0 z-50 grid place-items-center bg-scrim px-4 backdrop-blur-sm"
          onClick={() => setSelectedMerchant(null)}
        >
          <div 
            className="glass-card w-full max-w-md rounded-[2rem] p-6 border border-primary/40 shadow-2xl animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border border-primary/50">
                  <AvatarFallback className="bg-primary/20 text-primary font-black">
                    {selectedMerchant.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <span className="text-[0.65rem] font-bold text-primary uppercase tracking-wider">#{selectedMerchant.position} no Ranking</span>
                  <h2 className="font-display text-lg font-black">{selectedMerchant.name}</h2>
                </div>
              </div>
              <button 
                onClick={() => setSelectedMerchant(null)}
                className="grid h-8 w-8 place-items-center rounded-xl bg-secondary text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-secondary/50 p-3 text-center">
                <span className="text-[0.65rem] text-muted-foreground uppercase font-bold">Pontuação Karma</span>
                <p className="text-lg font-black text-cyan-400">{selectedMerchant.points} pts</p>
              </div>
              <div className="rounded-xl bg-secondary/50 p-3 text-center">
                <span className="text-[0.65rem] text-muted-foreground uppercase font-bold">Socorros na Praça</span>
                <p className="text-lg font-black text-amber-400">{selectedMerchant.helps} vezes</p>
              </div>
            </div>

            <div className="mt-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
                <History className="h-4 w-4 text-primary" /> Histórico de Solidariedade Recente
              </h3>
              
              <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
                {selectedMerchant.history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-secondary/70 p-3 text-xs border border-border/40">
                    <div>
                      <span className="font-bold text-foreground block">{h.action}</span>
                      <span className="text-[0.7rem] text-muted-foreground">{h.item} ({h.qty} un)</span>
                    </div>
                    <span className="text-[0.65rem] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {h.date}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => void handleSyncKarma(selectedMerchant)}
                disabled={updating}
                className="neon-button flex-1 rounded-xl py-3 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <Sparkles className="h-4 w-4" /> {updating ? "Sincronizando..." : "Recalcular Karma"}
              </button>
              <button
                onClick={() => setSelectedMerchant(null)}
                className="rounded-xl bg-secondary px-4 py-3 text-xs font-bold text-muted-foreground hover:text-foreground"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}