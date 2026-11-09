import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, Handshake, MapPin, PackagePlus, ShieldAlert, CheckCircle2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/radar-socorro")({
  component: RadarSocorroPage,
});

interface EmergencyRequest {
  id: number;
  tenant_name: string;
  product_name: string;
  units_needed: number;
  location: string;
  distance: string;
  status: "active" | "matched";
}

// Sintetizador de Áudio Nativo (Web Audio API) - Sem dependências externas
function playSound(type: "alert" | "success") {
  try {
    const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "alert") {
      // Som de Alerta S.O.S. (Bi-bi agudo)
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // Dó5 / Ré5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // Lá5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else {
      // Som de Conquista / Sucesso (Arpejo harmonioso)
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    }
  } catch {
    // Silencia caso o navegador bloqueie autoplay sem interação prévia
  }
}

function RadarSocorroPage() {
  const [requests, setRequests] = useState<EmergencyRequest[]>([
    {
      id: 1,
      tenant_name: "Barraca do João (Praça Principal)",
      product_name: "Caixa de Refrigerante 600ml",
      units_needed: 10,
      location: "Praça Central - Setor A",
      distance: "120m de você",
      status: "active",
    },
    {
      id: 2,
      tenant_name: "Pastelaria da Maria",
      product_name: "Fardo de Copos Descartáveis 300ml",
      units_needed: 5,
      location: "Rua do Comércio - Esquina",
      distance: "300m de você",
      status: "active",
    },
  ]);

  const [newItem, setNewItem] = useState("");
  const [newUnits, setNewUnits] = useState(5);
  const [showForm, setShowForm] = useState(false);

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return toast.error("Informe o produto necessário.");

    const newReq: EmergencyRequest = {
      id: Date.now(),
      tenant_name: "Sua Barraca (Você)",
      product_name: newItem.trim(),
      units_needed: newUnits,
      location: "Praça Principal - Setor B",
      distance: "Você",
      status: "active",
    };

    setRequests([newReq, ...requests]);
    setNewItem("");
    setShowForm(false);
    playSound("alert");
    toast.success("🚨 Alerta S.O.S. disparado na praça com som de alerta!");
  };

  const handleHelpPeer = (id: number, tenantName: string) => {
    setRequests((prev) =>
      prev.map((req) => (req.id === id ? { ...req, status: "matched" } : req))
    );
    playSound("success");
    toast.success("🏆 +150 Pontos de Reputação! Você ganhou o selo 'Guardião da Praça' por salvar o estoque de " + tenantName);
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
        <div className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-[0.65rem] font-bold text-red-400 border border-red-500/20 mb-2">
          <ShieldAlert className="h-3.5 w-3.5 text-red-400 animate-pulse" />
          <span>Rede P2P do Davi (Áudio Ativo)</span>
        </div>
        <h1 className="font-display text-3xl font-extrabold">Radar de Socorro</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajude colegas vizinhos com alertas sonoros em tempo real sintetizados pela Web Audio API.
        </p>
      </div>

      {/* Botão para Disparar Socorro Próprio */}
      <div className="mt-6 glass-card rounded-[1.5rem] p-4 border border-border/80 flex items-center justify-between bg-primary/5">
        <div>
          <h2 className="text-sm font-extrabold text-foreground">O seu estoque acabou?</h2>
          <p className="text-xs text-muted-foreground">Dispare um alerta S.O.S. com som de sirene na praça.</p>
        </div>
        <Button 
          onClick={() => setShowForm(!showForm)}
          className="bg-red-500 hover:bg-red-600 text-white font-extrabold text-xs py-2 h-auto"
        >
          <AlertTriangle className="h-3.5 w-3.5 mr-1.5" /> Pedir Socorro
        </Button>
      </div>

      {/* Formulário de S.O.S */}
      {showForm && (
        <form onSubmit={handleCreateRequest} className="mt-4 glass-card rounded-[1.5rem] p-4 border border-red-500/30 space-y-3 animate-in fade-in zoom-in-95">
          <h3 className="text-xs font-bold uppercase tracking-wider text-red-400">Novo Alerta de Falta de Estoque</h3>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">O que está faltando?</label>
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Ex: Fardos de água, Gelo..."
              className="w-full h-10 rounded-xl bg-background border border-border px-3 text-sm outline-none focus:border-red-500"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground block mb-1">Quantidade</label>
              <input
                type="number"
                min="1"
                value={newUnits}
                onChange={(e) => setNewUnits(Number(e.target.value))}
                className="w-full h-10 rounded-xl bg-background border border-border px-3 text-sm outline-none"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="h-10 font-bold text-xs bg-red-500 hover:bg-red-600 text-white">
                Disparar S.O.S.
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Lista de Pedidos de Socorro na Redondeza */}
      <section className="mt-6 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Alertas Ativos na Região ({requests.filter(r => r.status === 'active').length})
        </h2>

        {requests.map((req) => (
          <div 
            key={req.id}
            className={`glass-card rounded-[1.5rem] p-5 space-y-3 border transition-all ${
              req.status === 'matched' ? 'border-emerald-500/30 bg-emerald-950/10 opacity-75' : 'border-border/80'
            }`}
          >
            <div className="flex justify-between items-start gap-2">
              <div>
                <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  SOS Emergência
                </span>
                <h3 className="text-base font-extrabold mt-1.5">{req.product_name}</h3>
                <p className="text-xs font-medium text-foreground/90">{req.tenant_name}</p>
              </div>

              <div className="text-right">
                <span className="text-xs font-black text-red-400 bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20 block">
                  Precisa: {req.units_needed} un.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border/40">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-primary" /> {req.location}
              </span>
              <span className="flex items-center gap-1 font-semibold text-cyan-400">
                📍 {req.distance}
              </span>
            </div>

            <div className="pt-2 flex justify-end">
              {req.status === 'matched' ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4" /> Socorro em Andamento (Você salvou este!)
                </span>
              ) : (
                <Button
                  onClick={() => handleHelpPeer(req.id, req.tenant_name)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2 h-auto"
                >
                  <Handshake className="h-4 w-4 mr-1.5" /> Salvar Venda (Emprestar / Repassar)
                </Button>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}