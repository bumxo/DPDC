export type Role = "customer" | "admin";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled";

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];

/** Allowed transitions, mirrored from the DB trigger. */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export interface Profile {
  id: string;
  email: string;
  role: Role;
  company: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit_price: number;
  stock_qty: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductUom {
  id: string;
  product_id: string;
  uom: string;
  units_per_uom: number;
  price: number;
  is_default: boolean;
}

export type ProductWithUoms = Product & { uoms: ProductUom[] };

export interface AuditLog {
  id: number;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface Order {
  id: string;
  customer_id: string;
  status: OrderStatus;
  total: number;
  created_at: string;
}

export interface OrderItem {
  order_id: string;
  product_id: string;
  uom: string;
  units_per_uom: number;
  qty: number;
  unit_price: number;
}

export interface CartItem {
  productId: string;
  uomId: string;
  uomName: string;
  unitsPerUom: number;
  sku: string;
  name: string;
  unitPrice: number;
  stockQty: number;
  qty: number;
}

export const LOW_STOCK_THRESHOLD = 10;
