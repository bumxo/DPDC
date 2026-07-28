import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import type { Product } from "@/lib/types";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { CartPanel } from "@/components/cart-panel";

export const metadata = { title: "Products — DPDC B2B" };
export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  await requireUser();
  const q = (searchParams.q ?? "").trim();

  const supabase = createClient();
  let query = supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (q) {
    query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,description.ilike.%${q}%`);
  }

  const { data: products, error } = await query;

  return (
    <div className="lg:grid lg:grid-cols-[1fr_21rem] lg:items-start lg:gap-6">
      {/* Product list */}
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Products</h1>
          <form className="flex w-full gap-2 sm:w-auto">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search by name, SKU…"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none sm:w-64"
            />
            <button
              type="submit"
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
            >
              Search
            </button>
          </form>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Failed to load products: {error.message}
          </p>
        )}

        {products && products.length === 0 && (
          <p className="text-sm text-gray-500">
            {q ? `No products match "${q}".` : "No products available yet."}
          </p>
        )}

        {products && products.length > 0 && (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
            {(products as Product[]).map((product) => (
              <li
                key={product.id}
                className="flex flex-wrap items-center gap-3 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <h2 className="font-semibold">{product.name}</h2>
                    <span className="text-xs uppercase tracking-wide text-gray-400">
                      {product.sku}
                    </span>
                  </div>
                  {product.description && (
                    <p className="mt-0.5 text-sm text-gray-600">
                      {product.description}
                    </p>
                  )}
                  <p
                    className={`mt-0.5 text-xs ${
                      product.stock_qty === 0 ? "text-red-600" : "text-gray-500"
                    }`}
                  >
                    {product.stock_qty === 0
                      ? "Out of stock"
                      : `${product.stock_qty} in stock`}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="whitespace-nowrap font-semibold">
                    {formatMoney(product.unit_price)}
                  </span>
                  <AddToCartButton product={product} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Cart panel: upper right on desktop, below the list on mobile */}
      <aside className="mt-8 lg:sticky lg:top-20 lg:mt-0">
        <CartPanel />
      </aside>
    </div>
  );
}
