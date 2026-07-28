"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createProduct, updateProduct, type ActionState } from "@/actions/admin";
import type { Product } from "@/lib/types";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

export function ProductForm({ product }: { product?: Product }) {
  const action = product ? updateProduct.bind(null, product.id) : createProduct;
  const [state, formAction] = useFormState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="sku" className="mb-1 block text-sm font-medium">
            SKU
          </label>
          <input
            id="sku"
            name="sku"
            required
            defaultValue={product?.sku}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={product?.name}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={product?.description ?? ""}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="unit_price" className="mb-1 block text-sm font-medium">
            Base unit price (₱)
          </label>
          <input
            id="unit_price"
            name="unit_price"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={product?.unit_price}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="stock_qty" className="mb-1 block text-sm font-medium">
            Stock quantity
          </label>
          <input
            id="stock_qty"
            name="stock_qty"
            type="number"
            step="1"
            min="0"
            required
            defaultValue={product?.stock_qty}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={product ? product.is_active : true}
          className="h-4 w-4 rounded border-gray-300"
        />
        Active (visible to customers)
      </label>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <SubmitButton label={product ? "Save changes" : "Create product"} />
    </form>
  );
}
