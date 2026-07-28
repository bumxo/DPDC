"use client";

import { useMemo, useState } from "react";
import { useCart } from "@/components/cart-provider";
import { formatMoney } from "@/lib/format";
import type { ProductWithUoms } from "@/lib/types";

/** UOM selector + price + add button. Price follows the selected UOM. */
export function AddToCartButton({ product }: { product: ProductWithUoms }) {
  const { items, addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const uoms = useMemo(
    () =>
      [...product.uoms].sort((a, b) =>
        a.is_default === b.is_default
          ? a.units_per_uom - b.units_per_uom
          : a.is_default
            ? -1
            : 1
      ),
    [product.uoms]
  );
  const [uomId, setUomId] = useState(uoms[0]?.id);
  const selected = uoms.find((u) => u.id === uomId) ?? uoms[0];

  if (!selected) {
    return <span className="text-sm text-gray-400">No price set</span>;
  }

  const inCartUnits = items
    .filter((i) => i.productId === product.id)
    .reduce((sum, i) => sum + i.qty * i.unitsPerUom, 0);
  const remaining = product.stock_qty - inCartUnits;
  const canAdd = remaining >= selected.units_per_uom;
  const outOfStock = product.stock_qty < selected.units_per_uom;

  return (
    <div className="flex items-center gap-2">
      <div className="text-right">
        <p className="whitespace-nowrap font-semibold">
          {formatMoney(selected.price)}
        </p>
        {selected.units_per_uom > 1 && (
          <p className="text-xs text-gray-400">
            {selected.units_per_uom} pcs
          </p>
        )}
      </div>
      {uoms.length > 1 ? (
        <select
          value={uomId}
          onChange={(e) => setUomId(e.target.value)}
          aria-label={`Unit of measure for ${product.name}`}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        >
          {uoms.map((u) => (
            <option key={u.id} value={u.id}>
              {u.uom}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-sm text-gray-500">{selected.uom}</span>
      )}
      <button
        onClick={() => {
          addItem(product, selected, 1);
          setJustAdded(true);
          setTimeout(() => setJustAdded(false), 1200);
        }}
        disabled={!canAdd}
        className="whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {outOfStock
          ? "Unavailable"
          : !canAdd
            ? "Max in cart"
            : justAdded
              ? "Added ✓"
              : "Add"}
      </button>
    </div>
  );
}
