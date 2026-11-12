/** Armazenamento local de conveniência, sempre particionado pela conta ativa. */
const FAV_PREFIX = "delivery-favorites:";
const ORDERS_PREFIX = "delivery-my-orders:";
const SALE_DRAFT_PREFIX = "vendefacil-sale-draft:";
export type SavedOrder = { id: string; number: number | string; total: number; at: string };
export type SaleDraft = {
  cart: Record<string, number>;
  activeCustomer: {
    id: string;
    name: string;
    note: string;
    total: number;
    items: number;
    credit: number;
  };
  payment: string;
  orderType: "dine_in" | "delivery";
  deliveryAddress: string;
  creditAmount: number;
  updatedAt: string;
};
function accountKey() {
  if (typeof window === "undefined") return "anonymous";
  return (window.localStorage.getItem("vendefacil-email") || "anonymous").trim().toLowerCase();
}
function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
export const getFavorites = () => read<string[]>(`${FAV_PREFIX}${accountKey()}`, []);
export function toggleFavorite(id: string) {
  const list = getFavorites();
  const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  write(`${FAV_PREFIX}${accountKey()}`, next);
  return next;
}
export const getMyOrders = () => read<SavedOrder[]>(`${ORDERS_PREFIX}${accountKey()}`, []);
export function saveMyOrder(order: SavedOrder) {
  const next = [order, ...getMyOrders().filter((o) => o.id !== order.id)].slice(0, 20);
  write(`${ORDERS_PREFIX}${accountKey()}`, next);
  return next;
}
export const getSaleDraft = () =>
  read<SaleDraft | null>(`${SALE_DRAFT_PREFIX}${accountKey()}`, null);
export function saveSaleDraft(draft: Omit<SaleDraft, "updatedAt">) {
  const value = { ...draft, updatedAt: new Date().toISOString() } satisfies SaleDraft;
  write(`${SALE_DRAFT_PREFIX}${accountKey()}`, value);
  return value;
}
export function clearSaleDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(`${SALE_DRAFT_PREFIX}${accountKey()}`);
  } catch {}
}
