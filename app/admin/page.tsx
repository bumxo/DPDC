import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { LOW_STOCK_THRESHOLD, ORDER_STATUSES, type Product } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const supabase = createClient();

  const [{ data: orders }, { data: lowStock }] = await Promise.all([
    supabase.from("orders").select("status"),
    supabase
      .from("products")
      .select("*")
      .lte("stock_qty", LOW_STOCK_THRESHOLD)
      .eq("is_active", true)
      .order("stock_qty"),
  ]);

  const counts = ORDER_STATUSES.map((status) => ({
    status,
    count: orders?.filter((o) => o.status === status).length ?? 0,
  }));

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-2xl font-bold">Overview</h1>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {counts.map(({ status, count }) => (
            <Link
              key={status}
              href="/admin/orders"
              className="rounded-lg border border-gray-200 bg-white p-4 text-center shadow-sm hover:border-blue-300"
            >
              <p className="text-2xl font-bold">{count}</p>
              <StatusBadge status={status} />
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Low stock{" "}
          <span className="text-sm font-normal text-gray-500">
            (≤ {LOW_STOCK_THRESHOLD} units, active products)
          </span>
        </h2>
        {!lowStock || lowStock.length === 0 ? (
          <p className="text-sm text-gray-500">No products are low on stock.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(lowStock as Product[]).map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.sku}</td>
                    <td className="px-4 py-3 text-right">
                      {formatMoney(p.unit_price)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        p.stock_qty === 0 ? "text-red-600" : "text-amber-600"
                      }`}
                    >
                      {p.stock_qty}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/products/${p.id}/edit`}
                        className="text-blue-600 hover:underline"
                      >
                        Restock
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
