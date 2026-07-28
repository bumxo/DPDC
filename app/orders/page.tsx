import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, shortId } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import type { Order } from "@/lib/types";

export const metadata = { title: "My orders — DPDC B2B" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const profile = await requireUser();

  const supabase = createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">My orders</h1>

      {(!orders || orders.length === 0) && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="mb-3 text-gray-500">You haven&apos;t placed any orders yet.</p>
          <Link
            href="/products"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Browse products →
          </Link>
        </div>
      )}

      <ul className="space-y-3">
        {(orders as Order[] | null)?.map((order) => (
          <li key={order.id}>
            <Link
              href={`/orders/${order.id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300"
            >
              <div>
                <p className="font-medium">Order #{shortId(order.id)}</p>
                <p className="text-xs text-gray-500">
                  {formatDate(order.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <StatusBadge status={order.status} />
                <span className="font-semibold">{formatMoney(order.total)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
