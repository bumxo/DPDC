"use client";

import { useState } from "react";
import { useCart } from "@/components/cart-provider";
import type { Product } from "@/lib/types";

export function AddToCartButton({ product }: { product: Product }) {
  const { items, addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const inCart = items.find((i) => i.productId === product.id)?.qty ?? 0;
  const atLimit = inCart >= product.stock_qty;

  if (product.stock_qty === 0) {
    return (
      <button
        disabled
        className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-400"
      >
        Unavailable
      </button>
    );
  }

  return (
    <button
      onClick={() => {
        addItem(product, 1);
        setJustAdded(true);
        setTimeout(() => setJustAdded(false), 1200);
      }}
      disabled={atLimit}
      className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {atLimit ? "Max in cart" : justAdded ? "Added ✓" : "Add to cart"}
    </button>
  );
}
