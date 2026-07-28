import Link from "next/link";
import { ImportForm } from "./import-form";

export default function ImportProductsPage() {
  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/products"
        className="mb-4 inline-block text-sm text-blue-600 hover:underline"
      >
        ← Products
      </Link>
      <h1 className="mb-2 text-2xl font-bold">Mass upload products</h1>
      <p className="mb-6 text-sm text-gray-600">
        Upload an Excel file (.xlsx) to create or update products and their
        prices in bulk. Products are matched by <strong>SKU</strong> — existing
        ones are updated, new ones are created.
      </p>

      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="mb-2 font-semibold">Template format</p>
        <p className="mb-2">
          <a
            href="/templates/product-import-template.xlsx"
            download
            className="font-medium underline"
          >
            Download the template
          </a>{" "}
          (pre-filled with 100 sample pharmacy items). Columns:
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <code>sku</code>, <code>name</code>, <code>description</code> — one
            product per SKU; repeat the SKU on extra rows to add more UOMs.
          </li>
          <li>
            <code>uom</code> — unit name (Piece, Blister of 10, Box of 100,
            Bottle 60ml…).
          </li>
          <li>
            <code>units_per_uom</code> — how many base units the UOM contains
            (a Box of 100 tablets = 100). Stock is tracked in base units.
          </li>
          <li>
            <code>price</code> — selling price for that UOM (₱).
          </li>
          <li>
            <code>stock_qty</code> — stock in base units. Leave blank to keep
            the current stock of an existing product.
          </li>
          <li>
            <code>is_active</code> — TRUE/FALSE (blank = TRUE).
          </li>
        </ul>
      </div>

      <ImportForm />
    </div>
  );
}
