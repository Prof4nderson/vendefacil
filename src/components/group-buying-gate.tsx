import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Flame, ShoppingCart, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

interface Campaign {
  id: number;
  product_name: string;
  base_price: number;
  bulk_price: number;
  min_units: number;
  current_units: number;
  expires_at: string;
}

export function GroupBuyingGate() {
  const [isOpen, setIsOpen] = useState(false);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [unitsToBuy, setUnitsToBuy] = useState(5);

  useEffect(() => {
    // Simula a busca da campanha ativa mais urgente ao abrir o app
    // No projeto real, isso bate na rota backend que criaremos
    setTimeout(() => {
      setCampaign({
        id: 1,
        product_name: 'Caixa de Refrigerante 600ml (Direto da Fábrica)',
        base_price: 65.00,
        bulk_price: 42.50,
        min_units: 500,
        current_units: 380, // Quase batendo a meta!
        expires_at: new Date(Date.now() + 86400000 * 2).toISOString(),
      });
      setIsOpen(true); // Trava a tela com o aviso obrigatório exigido pelo Davi
    }, 1000);
  }, []);

  if (!campaign) return null;

  // Calcula o progresso percentual da meta
  const progressPercent = Math.min(
    Math.round((campaign.current_units / campaign.min_units) * 100), 
    100
  );

  // Simula o preço dinâmico caindo conforme mais gente entra
  const currentDynamicPrice = (
    campaign.base_price - 
    (campaign.base_price - campaign.bulk_price) * (progressPercent / 100)
  ).toFixed(2);

  const handleJoinBulkOrder = () => {
    toast.success(`Sucesso! ${unitsToBuy} unidades reservadas no lote coletivo.`);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md bg-slate-950 text-white border-cyan-500/30">
        <DialogHeader>
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm tracking-wide uppercase">
            <Flame className="w-5 h-5 text-amber-400 animate-pulse" />
            <span>Alerta de Compra Coletiva (Alibaba do Davi)</span>
          </div>
          <DialogTitle className="text-xl font-extrabold text-white">
            {campaign.product_name}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Junte forças com outros ambulantes da região para comprar direto de fábrica e cortar o atravessador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Caixa de Destaque do Preço Dinâmico */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 block">Preço Atual no Lote</span>
              <span className="text-2xl font-black text-emerald-400">R$ {currentDynamicPrice}</span>
              <span className="text-xs text-slate-500 line-through ml-2">R$ {campaign.base_price.toFixed(2)} mercadinho</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-cyan-400 flex items-center gap-1">
                <TrendingDown className="w-3 h-3" /> Quanto mais gente, mais barato!
              </span>
            </div>
          </div>

          {/* Barra de Progresso do Lote */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Meta do Lote: {campaign.current_units} / {campaign.min_units} un.</span>
              <span className="font-bold text-cyan-400">{progressPercent}% Concluído</span>
            </div>
            <Progress value={progressPercent} className="h-3 bg-slate-800" />
          </div>

          {/* Seletor de Quantidade */}
          <div className="space-y-2">
            <label className="text-xs text-slate-400 block">Quantas unidades você vai garantir?</label>
            <div className="flex items-center gap-3">
              {[1, 5, 10, 20].map((qty) => (
                <button
                  key={qty}
                  onClick={() => setUnitsToBuy(qty)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${
                    unitsToBuy === qty 
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/20' 
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {qty} un.
                </button>
              ))}
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-3 pt-2">
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              className="flex-1 border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-white"
            >
              Ver Depois
            </Button>
            <Button 
              onClick={handleJoinBulkOrder}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-extrabold hover:opacity-90 shadow-xl"
            >
              <ShoppingCart className="w-4 h-4 mr-2" /> Entrar no Lote Agora
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}