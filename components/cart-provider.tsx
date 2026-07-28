"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CartItem, Product, ProductUom } from "@/lib/types";

interface CartContextValue {
  items: CartItem[];
  count: number;
  total: number;
  addItem: (product: Product, uom: ProductUom, qty?: number) => void;
  setQty: (productId: string, uomId: string, qty: number) => void;
  removeItem: (productId: string, uomId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "dpdc-cart-v2";

/** Max orderable qty for a cart line, given base-unit stock. */
function maxQty(item: Pick<CartItem, "stockQty" | "unitsPerUom">) {
  return Math.floor(item.stockQty / item.unitsPerUom);
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // Ignore corrupted cart data.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, loaded]);

  const addItem = useCallback(
    (product: Product, uom: ProductUom, qty = 1) => {
      setItems((prev) => {
        const existing = prev.find(
          (i) => i.productId === product.id && i.uomId === uom.id
        );
        if (existing) {
          return prev.map((i) =>
            i === existing
              ? { ...i, qty: Math.min(i.qty + qty, maxQty(i)) }
              : i
          );
        }
        const line: CartItem = {
          productId: product.id,
          uomId: uom.id,
          uomName: uom.uom,
          unitsPerUom: uom.units_per_uom,
          sku: product.sku,
          name: product.name,
          unitPrice: Number(uom.price),
          stockQty: product.stock_qty,
          qty: 0,
        };
        line.qty = Math.min(qty, maxQty(line));
        return line.qty > 0 ? [...prev, line] : prev;
      });
    },
    []
  );

  const setQty = useCallback((productId: string, uomId: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => !(i.productId === productId && i.uomId === uomId))
        : prev.map((i) =>
            i.productId === productId && i.uomId === uomId
              ? { ...i, qty: Math.min(qty, maxQty(i)) }
              : i
          )
    );
  }, []);

  const removeItem = useCallback((productId: string, uomId: string) => {
    setItems((prev) =>
      prev.filter((i) => !(i.productId === productId && i.uomId === uomId))
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(() => {
    const count = items.reduce((sum, i) => sum + i.qty, 0);
    const total = items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
    return { items, count, total, addItem, setQty, removeItem, clear };
  }, [items, addItem, setQty, removeItem, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
