// Tipos das linhas do banco (PostgreSQL) usados pelo app.

export type CategoryRow = {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
  created_at: string;
};

export type ProductRow = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: string | number;
  image_url: string | null;
  stock: number;
  available: boolean;
  needs_kitchen: boolean;
  created_at: string;
};

export type OrderRow = {
  id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string | null;
  order_type: string;
  address: string | null;
  payment_method: string;
  status: string;
  total: string | number;
  notes: string | null;
  courier_id: string | null;
  courier_name: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  price: string | number;
  qty: number;
  needs_kitchen: boolean;
  checked: boolean;
  notes: string | null;
};

export type CourierRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  vehicle_plate: string | null;
  active: boolean;
  created_at: string;
};

export type ShiftReport = {
  opened_at: string;
  closed_at: string;
  opening_amount: number;
  total_income: number;
  total_expense: number;
  by_method: Record<string, number>;
  orders_count: number;
  orders_total: number;
  orders: {
    id: string;
    order_number: number;
    customer_name: string;
    total: string | number;
    payment_method: string;
    order_type: string;
    status: string;
  }[];
};

export type ShiftRow = {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_amount: string | number;
  closing_notes: string | null;
  report: ShiftReport | null;
};

export type CashEntryRow = {
  id: string;
  shift_id: string | null;
  type: string;
  amount: string | number;
  method: string | null;
  description: string | null;
  order_id: string | null;
  created_at: string;
};

export type DailyMenuRow = {
  id: string;
  weekday: number;
  product_id: string;
};
