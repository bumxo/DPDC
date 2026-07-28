import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import type { Product } from "@/lib/types";
import { AddToCartButton } from "@/components/add-to-cart-button";

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(products as Product[] | null)?.map((product) => (
          <div
            key={product.id}
            className="flex flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-1 flex items-start justify-between gap-2">
              <h2 className="font-semibold">{product.name}</h2>
              <span className="whitespace-nowrap font-semibold">
                {formatMoney(product.unit_price)}
              </span>
            </div>
            <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">
              {product.sku}
            </p>
            {product.description && (
              <p className="mb-3 text-sm text-gray-600">{product.description}</p>
            )}
            <div className="mt-auto flex items-center justify-between pt-2">
              <span
                className={`text-xs ${
                  product.stock_qty === 0 ? "text-red-600" : "text-gray-500"
                }`}
              >
                {product.stock_qty === 0
                  ? "Out of stock"
                  : `${product.stock_qty} in stock`}
              </span>
              <AddToCartButton product={product} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
