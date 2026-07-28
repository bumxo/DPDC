import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, shortId } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import type { Order, OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type OrderRow = Order & { customer: { email: string; company: string | null } | null };

export default async function AdminOrdersPage() {
  const supabase = createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("*, customer:profiles(email, company)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">All orders</h1>

      {(!orders || orders.length === 0) && (
        <p className="text-sm text-gray-500">No orders yet.</p>
      )}

      {orders && orders.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Placed</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(orders as OrderRow[]).map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      #{shortId(order.id)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{order.customer?.email ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {formatDate(order.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status as OrderStatus} />
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatMoney(order.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
