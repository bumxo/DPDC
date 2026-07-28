import Link from "next/link";
import { ProductForm } from "@/components/product-form";

export default function NewProductPage() {
  return (
    <div>
      <Link
        href="/admin/products"
        className="mb-4 inline-block text-sm text-brand-600 hover:underline"
      >
        ← Products
      </Link>
      <h1 className="mb-6 text-2xl font-bold">New product</h1>
      <ProductForm />
    </div>
  );
}
