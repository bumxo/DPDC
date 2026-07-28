import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, shortId } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import type { Order, OrderStatus } from "@/lib/types";

export const metadata = { title: "Order detail — DPDC B2B" };
export const dynamic = "force-dynamic";

interface ItemRow {
  qty: number;
  unit_price: number;
  product: { name: string; sku: string } | null;
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { placed?: string };
}) {
  await requireUser();

  const supabase = createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!order) notFound();

  const { data: items } = await supabase
    .from("order_items")
    .select("qty, unit_price, product:products(name, sku)")
    .eq("order_id", params.id);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/orders"
        className="mb-4 inline-block text-sm text-blue-600 hover:underline"
      >
        ← Back to orders
      </Link>

      {searchParams.placed && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Order placed successfully. We&apos;ll confirm it shortly.
        </p>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">
            Order #{shortId((order as Order).id)}
          </h1>
          <p className="text-sm text-gray-500">
            Placed {formatDate((order as Order).created_at)}
          </p>
        </div>
        <StatusBadge status={(order as Order).status as OrderStatus} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
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
                  {item.product?.sku && (
                    <p className="text-xs text-gray-500">{item.product.sku}</p>
                  )}
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
                {formatMoney((order as Order).total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
