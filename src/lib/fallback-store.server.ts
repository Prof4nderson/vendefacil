import type { CategoryRow, OrderItemRow, OrderRow, ProductRow } from "./rows";

const createdAt = "2026-01-01T00:00:00.000Z";

const CAT_QUENTES = "00000000-0000-4000-8000-000000000001";
const CAT_LANCHES = "00000000-0000-4000-8000-000000000002";
const CAT_SOBREMESAS = "00000000-0000-4000-8000-000000000003";
const CAT_BEBIDAS = "00000000-0000-4000-8000-000000000004";
const CAT_OUTROS = "00000000-0000-4000-8000-000000000005";

export const fallbackCategories: CategoryRow[] = [
  { id: CAT_QUENTES, name: "Pratos quentes", sort_order: 1, active: true, created_at: createdAt },
  { id: CAT_LANCHES, name: "Lanches", sort_order: 2, active: true, created_at: createdAt },
  { id: CAT_SOBREMESAS, name: "Sobremesas", sort_order: 3, active: true, created_at: createdAt },
  { id: CAT_BEBIDAS, name: "Bebidas", sort_order: 4, active: true, created_at: createdAt },
  { id: CAT_OUTROS, name: "Outros", sort_order: 5, active: true, created_at: createdAt },
];

export const fallbackProducts: ProductRow[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    category_id: CAT_QUENTES,
    name: "Strogonoff neon",
    description: "Frango cremoso, arroz e batata palha crocante",
    price: 28.9,
    image_url: "/images/strogonoff.jpg",
    stock: 18,
    available: true,
    needs_kitchen: true,
    created_at: createdAt,
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    category_id: CAT_QUENTES,
    name: "Lasanha holográfica",
    description: "Camadas de molho, queijo gratinado e carne",
    price: 30.9,
    image_url: "/images/lasanha.jpg",
    stock: 10,
    available: true,
    needs_kitchen: true,
    created_at: createdAt,
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    category_id: CAT_LANCHES,
    name: "X-Burguer turbo",
    description: "Hambúrguer, queijo, alface, tomate e molho da casa",
    price: 18.9,
    image_url: "/images/xburguer.jpg",
    stock: 25,
    available: true,
    needs_kitchen: true,
    created_at: createdAt,
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    category_id: CAT_SOBREMESAS,
    name: "Brownie com sorvete",
    description: "Chocolate intenso com final gelado",
    price: 14.9,
    image_url: "/images/brownie.jpg",
    stock: 12,
    available: true,
    needs_kitchen: true,
    created_at: createdAt,
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    category_id: CAT_BEBIDAS,
    name: "Suco natural 500ml",
    description: "Laranja, maracujá ou manga",
    price: 9,
    image_url: null,
    stock: 20,
    available: true,
    needs_kitchen: false,
    created_at: createdAt,
  },
];

type FallbackStore = {
  nextOrderNumber: number;
  orders: OrderRow[];
  items: OrderItemRow[];
};

const globalFallback = globalThis as typeof globalThis & {
  __deliveryFallbackStore?: FallbackStore;
};

function store() {
  if (!globalFallback.__deliveryFallbackStore) {
    globalFallback.__deliveryFallbackStore = { nextOrderNumber: 1001, orders: [], items: [] };
  }
  return globalFallback.__deliveryFallbackStore;
}

export function getFallbackMenu(weekday: number) {
  return {
    categories: fallbackCategories,
    products: fallbackProducts,
    dailyIds: fallbackProducts.filter((p) => p.category_id === CAT_QUENTES).map((p) => p.id),
    weekday,
  };
}

export function getFallbackSettings() {
  return {
    restaurant_name: "Sabor da Casa",
    primary_color: "#00d5ff",
    logo_url: null as string | null,
  };
}

export function createFallbackOrder(data: {
  customer_name: string;
  customer_phone: string;
  order_type: "delivery" | "dine_in";
  address?: string | undefined;
  payment_method: string;
  notes?: string | undefined;
  items: { product_id: string; qty: number; notes?: string | undefined }[];
}) {
  const fallbackStore = store();
  const products = data.items.map((item) => fallbackProducts.find((p) => p.id === item.product_id));
  if (products.some((p) => !p)) throw new Error("Algum item não está mais disponível");
  for (const item of data.items) {
    const product = fallbackProducts.find((p) => p.id === item.product_id);
    if (!product || product.stock < item.qty) throw new Error("Estoque insuficiente");
  }
  const total = data.items.reduce((sum, item) => {
    const product = fallbackProducts.find((p) => p.id === item.product_id);
    return sum + Number(product?.price ?? 0) * item.qty;
  }, 0);
  const orderId = crypto.randomUUID();
  const now = new Date().toISOString();
  const order: OrderRow = {
    id: orderId,
    order_number: fallbackStore.nextOrderNumber,
    customer_name: data.customer_name.trim(),
    customer_phone: data.customer_phone.trim(),
    order_type: data.order_type,
    address: data.order_type === "delivery" ? (data.address?.trim() ?? null) : null,
    payment_method: data.payment_method,
    status: "confirmed",
    total,
    notes: data.notes?.trim() || null,
    courier_id: null,
    courier_name: null,
    created_at: now,
    updated_at: now,
  };
  fallbackStore.nextOrderNumber += 1;
  fallbackStore.orders.unshift(order);
  for (const item of data.items) {
    const product = fallbackProducts.find((p) => p.id === item.product_id);
    if (!product) continue;
    fallbackStore.items.push({
      id: crypto.randomUUID(),
      order_id: orderId,
      product_id: product.id,
      name: product.name,
      price: product.price,
      qty: item.qty,
      needs_kitchen: product.needs_kitchen,
      checked: false,
      notes: item.notes?.trim() || null,
    });
  }
  return { ok: true as const, orderId: order.id, orderNumber: order.order_number };
}

export function getFallbackOrder(id: string) {
  const fallbackStore = store();
  const order = fallbackStore.orders.find((o) => o.id === id);
  if (!order) throw new Error("Pedido não encontrado");
  const items = fallbackStore.items.filter((i) => i.order_id === id);
  return { order, items };
}

/** Senhas padrão usadas apenas no preview (sem banco configurado). */
export const fallbackRoutePasswords: Record<string, string> = {
  admin: "admin123",
  cozinha: "cozinha123",
  entrega: "entrega123",
  caixa: "caixa123",
};

export const fallbackCouriers = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    name: "Carlos Entregador",
    phone: "(11) 90000-0000",
    email: "carlos@example.com",
    vehicle_plate: "ABC1D23",
    password: "1234",
    active: true,
    created_at: createdAt,
  },
];

export function getFallbackAdminData() {
  const fallbackStore = store();
  return {
    categories: fallbackCategories,
    products: fallbackProducts,
    daily: fallbackProducts
      .filter((p) => p.category_id === CAT_QUENTES)
      .flatMap((p) =>
        [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          id: `${p.id}-${weekday}`,
          weekday,
          product_id: p.id,
          created_at: createdAt,
        })),
      ),
    couriers: fallbackCouriers.map(({ password: _password, ...c }) => c),
    shifts: [] as never[],
    recentOrders: fallbackStore.orders.map((o) => ({
      id: o.id,
      order_number: o.order_number,
      customer_name: o.customer_name,
      total: o.total,
      status: o.status,
      order_type: o.order_type,
      payment_method: o.payment_method,
      courier_name: o.courier_name,
      created_at: o.created_at,
    })),
  };
}
