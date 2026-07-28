import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/product-form";
import { UomManager } from "@/components/uom-manager";
import type { ProductWithUoms } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: product } = await supabase
    .from("products")
    .select("*, uoms:product_uoms(*)")
    .eq("id", params.id)
    .maybeSingle();

  if (!product) notFound();
  const p = product as ProductWithUoms;

  return (
    <div>
      <Link
        href="/admin/products"
        className="mb-4 inline-block text-sm text-brand-600 hover:underline"
      >
        ← Products
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Edit {p.name}</h1>
      <ProductForm product={p} />
      <UomManager productId={p.id} uoms={p.uoms} />
    </div>
  );
}
