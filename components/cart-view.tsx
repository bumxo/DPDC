"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useCart } from "@/components/cart-provider";
import { formatMoney } from "@/lib/format";
import { placeOrder } from "@/actions/checkout";

export function CartView() {
  const { items, total, setQty, removeItem, clear } = useCart();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
        <p className="mb-3 text-gray-500">Your cart is empty.</p>
        <Link
          href="/products"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          Browse products →
        </Link>
      </div>
    );
  }

  const submitOrder = () => {
    setError(null);
    startTransition(async () => {
      const result = await placeOrder(
        items.map((i) => ({ productId: i.productId, qty: i.qty }))
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      clear();
      router.push(`/orders/${result.orderId}?placed=1`);
    });
  };

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
        {items.map((item) => (
          <li
            key={item.productId}
            className="flex flex-wrap items-center gap-3 p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.name}</p>
              <p className="text-xs text-gray-500">
                {item.sku} · {formatMoney(item.unitPrice)} each
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setQty(item.productId, item.qty - 1)}
                aria-label={`Decrease quantity of ${item.name}`}
                className="h-8 w-8 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={item.stockQty}
                value={item.qty}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (Number.isFinite(v)) setQty(item.productId, v);
                }}
                aria-label={`Quantity of ${item.name}`}
                className="h-8 w-14 rounded-md border border-gray-300 text-center text-sm"
              />
              <button
                onClick={() => setQty(item.productId, item.qty + 1)}
                disabled={item.qty >= item.stockQty}
                aria-label={`Increase quantity of ${item.name}`}
                className="h-8 w-8 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
              >
                +
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="w-20 text-right font-medium">
                {formatMoney(item.qty * item.unitPrice)}
              </span>
              <button
                onClick={() => removeItem(item.productId)}
                className="text-sm text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
        <span className="text-lg font-semibold">
          Total: {formatMoney(total)}
        </span>
        <button
          onClick={submitOrder}
          disabled={isPending}
          className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "Placing order…" : "Place order"}
        </button>
      </div>
      <p className="text-xs text-gray-500">
        Stock is validated again when the order is submitted. Prices are locked
        at submission time.
      </p>
    </div>
  );
}
