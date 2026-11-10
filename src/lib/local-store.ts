/** Armazenamento local de conveniência, sempre particionado pela conta ativa. */
const FAV_PREFIX = "delivery-favorites:";
const ORDERS_PREFIX = "delivery-my-orders:";
export type SavedOrder = { id: string; number: number|string; total: number; at: string };
function accountKey() { if (typeof window === "undefined") return "anonymous"; return (window.localStorage.getItem("vendefacil-email") || "anonymous").trim().toLowerCase(); }
function read<T>(key:string,fallback:T):T { if(typeof window==="undefined")return fallback; try{const raw=window.localStorage.getItem(key);return raw?JSON.parse(raw) as T:fallback}catch{return fallback} }
function write(key:string,value:unknown){if(typeof window==="undefined")return;try{window.localStorage.setItem(key,JSON.stringify(value))}catch{}}
export const getFavorites=()=>read<string[]>(`${FAV_PREFIX}${accountKey()}`,[]);
export function toggleFavorite(id:string){const list=getFavorites();const next=list.includes(id)?list.filter(x=>x!==id):[...list,id];write(`${FAV_PREFIX}${accountKey()}`,next);return next;}
export const getMyOrders=()=>read<SavedOrder[]>(`${ORDERS_PREFIX}${accountKey()}`,[]);
export function saveMyOrder(order:SavedOrder){const next=[order,...getMyOrders().filter(o=>o.id!==order.id)].slice(0,20);write(`${ORDERS_PREFIX}${accountKey()}`,next);return next;}
