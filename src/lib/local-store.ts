/**
 * Armazenamento local (navegador) para favoritos e histórico de pedidos do cliente.
 * Não substitui o banco: é apenas conveniência na navegação da barra inferior.
 */
const FAV_KEY = "delivery-favorites";
const ORDERS_KEY = "delivery-my-orders";

export type SavedOrder = { id: string; number: number | string; total: number; at: string };

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
  } catch {
    /* ignora limite de armazenamento */
  }
}

export const getFavorites = () => read<string[]>(FAV_KEY, []);

export function toggleFavorite(id: string) {
  const list = getFavorites();
  const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  write(FAV_KEY, next);
  return next;
}

export const getMyOrders = () => read<SavedOrder[]>(ORDERS_KEY, []);

export function saveMyOrder(order: SavedOrder) {
  const next = [order, ...getMyOrders().filter((o) => o.id !== order.id)].slice(0, 20);
  write(ORDERS_KEY, next);
  return next;
}
