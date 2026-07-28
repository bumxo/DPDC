import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, shortId } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { OrderStatusActions } from "@/components/order-status-actions";
import type { Order, OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

interface ItemRow {
  qty: number;
  unit_price: number;
  uom: string;
  units_per_uom: number;
  product: { name: string; sku: string } | null;
}

type OrderRow = Order & { customer: { email: string; company: string | null } | null };

export default async function AdminOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("*, customer:profiles(email, company)")
    .eq("id", params.id)
    .maybeSingle();

  if (!order) notFound();
  const o = order as OrderRow;

  const { data: items } = await supabase
    .from("order_items")
    .select("qty, unit_price, uom, units_per_uom, product:products(name, sku)")
    .eq("order_id", params.id);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/orders"
        className="mb-4 inline-block text-sm text-brand-600 hover:underline"
      >
        ← All orders
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Order #{shortId(o.id)}</h1>
          <p className="text-sm text-gray-500">
            {o.customer?.company ? `${o.customer.company} · ` : ""}
            {o.customer?.email ?? "Unknown customer"} ·{" "}
            {formatDate(o.created_at)}
          </p>
        </div>
        <StatusBadge status={o.status as OrderStatus} />
      </div>

      <div className="mb-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Unit price</th>
              <th className="px-4 py-3 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(items as ItemRow[] | null)?.map((item, idx) => (
              <tr key={idx}>
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {item.product?.name ?? "(removed product)"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.product?.sku && `${item.product.sku} · `}
                    {item.uom}
                    {item.units_per_uom > 1 && ` (${item.units_per_uom} pcs)`}
                  </p>
                </td>
                <td className="px-4 py-3 text-right">{item.qty}</td>
                <td className="px-4 py-3 text-right">
                  {formatMoney(item.unit_price)}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatMoney(item.qty * item.unit_price)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200">
              <td colSpan={3} className="px-4 py-3 text-right font-semibold">
                Total
              </td>
              <td className="px-4 py-3 text-right font-semibold">
                {formatMoney(o.total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <OrderStatusActions orderId={o.id} status={o.status as OrderStatus} />
    </div>
  );
}
