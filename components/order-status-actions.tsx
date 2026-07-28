"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus } from "@/actions/admin";
import { NEXT_STATUSES, type OrderStatus } from "@/lib/types";

const LABELS: Partial<Record<OrderStatus, string>> = {
  confirmed: "Confirm order",
  shipped: "Mark as shipped",
  delivered: "Mark as delivered",
  cancelled: "Cancel order",
};

export function OrderStatusActions({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const nextStatuses = NEXT_STATUSES[status];
  if (nextStatuses.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        This order is {status}; no further status changes are possible.
      </p>
    );
  }

  const transition = (next: OrderStatus) => {
    if (
      next === "cancelled" &&
      !confirm("Cancel this order? Reserved stock will be returned.")
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateOrderStatus(orderId, next, {}, new FormData());
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {nextStatuses.map((next) => (
          <button
            key={next}
            onClick={() => transition(next)}
            disabled={isPending}
            className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${
              next === "cancelled"
                ? "border border-red-300 text-red-700 hover:bg-red-50"
                : "bg-brand-600 text-white hover:bg-brand-700"
            }`}
          >
            {LABELS[next] ?? next}
          </button>
        ))}
      </div>
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
