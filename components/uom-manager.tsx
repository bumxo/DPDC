"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addProductUom,
  deleteProductUom,
  updateProductUom,
} from "@/actions/admin";
import type { ProductUom } from "@/lib/types";

function UomRow({ uom, productId }: { uom: ProductUom; productId: string }) {
  const [units, setUnits] = useState(String(uom.units_per_uom));
  const [price, setPrice] = useState(String(uom.price));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const save = () => {
    setError(null);
    const fd = new FormData();
    fd.set("units_per_uom", units);
    fd.set("price", price);
    startTransition(async () => {
      const result = await updateProductUom(uom.id, productId, {}, fd);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  };

  const remove = () => {
    if (!confirm(`Remove UOM "${uom.uom}"?`)) return;
    startTransition(async () => {
      const result = await deleteProductUom(uom.id, productId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  };

  const dirty =
    units !== String(uom.units_per_uom) || price !== String(uom.price);

  return (
    <tr>
      <td className="px-3 py-2 font-medium">
        {uom.uom}
        {uom.is_default && (
          <span className="ml-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
            default
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={1}
          step={1}
          value={units}
          onChange={(e) => setUnits(e.target.value)}
          className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
          aria-label={`Units per ${uom.uom}`}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
          aria-label={`Price per ${uom.uom}`}
        />
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-2">
          {dirty && (
            <button
              onClick={save}
              disabled={isPending}
              className="text-sm font-medium text-blue-600 hover:underline disabled:opacity-50"
            >
              Save
            </button>
          )}
          <button
            onClick={remove}
            disabled={isPending}
            className="text-sm text-red-600 hover:underline disabled:opacity-50"
          >
            Remove
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

export function UomManager({
  productId,
  uoms,
}: {
  productId: string;
  uoms: ProductUom[];
}) {
  const [uomName, setUomName] = useState("");
  const [units, setUnits] = useState("1");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const add = () => {
    setError(null);
    const fd = new FormData();
    fd.set("uom", uomName);
    fd.set("units_per_uom", units);
    fd.set("price", price);
    startTransition(async () => {
      const result = await addProductUom(productId, {}, fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      setUomName("");
      setUnits("1");
      setPrice("");
      router.refresh();
    });
  };

  const sorted = [...uoms].sort((a, b) => a.units_per_uom - b.units_per_uom);

  return (
    <div className="mt-8 max-w-lg">
      <h2 className="mb-1 text-lg font-semibold">Units of measure</h2>
      <p className="mb-3 text-sm text-gray-500">
        Each UOM has its own price. “Units” converts to base stock (e.g. a Box
        of 100 tablets consumes 100 stock units).
      </p>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2">UOM</th>
              <th className="px-3 py-2">Units</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((uom) => (
              <UomRow key={uom.id} uom={uom} productId={productId} />
            ))}
            <tr className="bg-gray-50">
              <td className="px-3 py-2">
                <input
                  placeholder="e.g. Box of 100"
                  value={uomName}
                  onChange={(e) => setUomName(e.target.value)}
                  className="w-32 rounded-md border border-gray-300 px-2 py-1 text-sm"
                  aria-label="New UOM name"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
                  aria-label="New UOM units"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
                  aria-label="New UOM price"
                />
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  onClick={add}
                  disabled={isPending || !uomName || !price}
                  className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Add
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
