import { createServerFn } from "@tanstack/react-start";

export type CollectiveDeal = {
  id: string;
  itemTitle: string;
  category: string;
  supplier: string;
  basePrice: number;
  targetQty: number;
  currentQty: number;
  unit: string;
  image: string;
  discountTiers: Array<{ minQty: number; discountPercent: number }>;
};

let dealsStore: CollectiveDeal[] = [
  {
    id: "deal-1",
    itemTitle: "Caixa de Óleo de Soja (20 un. x 900ml)",
    category: "Insumos de Cozinha",
    supplier: "Atacadão Regional B2B",
    basePrice: 180.0,
    targetQty: 50,
    currentQty: 38,
    unit: "caixas",
    image: "🍳",
    discountTiers: [
      { minQty: 20, discountPercent: 10 },
      { minQty: 40, discountPercent: 18 },
      { minQty: 60, discountPercent: 25 },
    ],
  },
  {
    id: "deal-2",
    itemTitle: "Fardo de Copos Descartáveis 300ml (1000 un.)",
    category: "Embalagens",
    supplier: "Distribuidora Embalashow",
    basePrice: 95.0,
    targetQty: 80,
    currentQty: 62,
    unit: "fardos",
    image: "🥤",
    discountTiers: [
      { minQty: 30, discountPercent: 12 },
      { minQty: 60, discountPercent: 20 },
      { minQty: 100, discountPercent: 30 },
    ],
  },
];

// Listar ofertas ativas
export const getCollectiveDeals = createServerFn({ method: "GET" }).handler(async () => {
  return dealsStore;
});

// Entrar em uma compra coletiva (adicionar cotas)
export const joinCollectiveDeal = createServerFn({ method: "POST" })
  .validator((data: { dealId: string; quantity: number; merchantName: string }) => data)
  .handler(async ({ data }) => {
    const deal = dealsStore.find((d) => d.id === data.dealId);
    if (!deal) throw new Error("Oferta coletiva não encontrada.");

    deal.currentQty += data.quantity;

    // Calcula o desconto atual atingido
    let currentDiscount = 0;
    for (const tier of deal.discountTiers) {
      if (deal.currentQty >= tier.minQty) {
        currentDiscount = tier.discountPercent;
      }
    }

    const finalPricePerUnit = deal.basePrice * (1 - currentDiscount / 100);

    return {
      success: true,
      newTotalQty: deal.currentQty,
      currentDiscount,
      finalPricePerUnit: finalPricePerUnit.toFixed(2),
      message: `${data.merchantName} garantiu ${data.quantity} cotas! Desconto atual: ${currentDiscount}%`,
    };
  });