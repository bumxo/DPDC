"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useCart } from "@/components/cart-provider";
import { formatMoney, shortId } from "@/lib/format";
import { placeOrder } from "@/actions/checkout";

export function CartPanel() {
  const { items, total, setQty, removeItem, clear, maxQtyFor } = useCart();
  const [error, setError] = useState<string | null>(null);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const submitOrder = () => {
    setError(null);
    startTransition(async () => {
      const result = await placeOrder(
        items.map((i) => ({
          productId: i.productId,
          uomId: i.uomId,
          qty: i.qty,
        }))
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      clear();
      setPlacedOrderId(result.orderId ?? null);
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">Cart</h2>

      {placedOrderId && (
        <div className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Order placed!{" "}
          <Link
            href={`/orders/${placedOrderId}`}
            className="font-medium underline"
          >
            View order #{shortId(placedOrderId)}
          </Link>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-gray-500">
          Your cart is empty. Add products from the list.
        </p>
      ) : (
        <>
          <ul className="mb-3 divide-y divide-gray-100">
            {items.map((item) => (
              <li key={`${item.productId}:${item.uomId}`} className="py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.uomName}
                      {item.unitsPerUom > 1 && ` (${item.unitsPerUom} pcs)`} ·{" "}
                      {formatMoney(item.unitPrice)} each
                    </p>
                  </div>
                  <button
                    onClick={() => removeItem(item.productId, item.uomId)}
                    aria-label={`Remove ${item.name}`}
                    className="text-gray-400 hover:text-red-600"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        setQty(item.productId, item.uomId, item.qty - 1)
                      }
                      aria-label={`Decrease quantity of ${item.name}`}
                      className="h-6 w-6 rounded border border-gray-300 text-xs text-gray-600 hover:bg-gray-100"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm">{item.qty}</span>
                    <button
                      onClick={() =>
                        setQty(item.productId, item.uomId, item.qty + 1)
                      }
                      disabled={item.qty >= maxQtyFor(item)}
                      aria-label={`Increase quantity of ${item.name}`}
                      className="h-6 w-6 rounded border border-gray-300 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-sm font-medium">
                    {formatMoney(item.qty * item.unitPrice)}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {error && (
            <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mb-3 flex items-center justify-between border-t border-gray-200 pt-3">
            <span className="text-sm font-semibold">Total</span>
            <span className="text-lg font-bold">{formatMoney(total)}</span>
          </div>

          <button
            onClick={submitOrder}
            disabled={isPending}
            className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {isPending ? "Placing order…" : "Place order"}
          </button>
          <p className="mt-2 text-xs text-gray-400">
            Stock and prices are validated at submission.
          </p>
        </>
      )}
    </div>
  );
}
