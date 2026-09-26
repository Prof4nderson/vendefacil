export const brl = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const ORDER_STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmado",
  preparing: "Em preparo",
  ready: "Pronto",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
  served: "Servido",
  cancelled: "Cancelado",
};

export const PAYMENT_METHODS = ["Dinheiro", "Pix", "Cartão na entrega", "Cartão no local"];
