"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NEXT_STATUSES, type OrderStatus } from "@/lib/types";

export interface ActionState {
  error?: string;
}

async function requireAdminClient() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { supabase, error: "Admin access required." };
  return { supabase, error: null };
}

function parseProductForm(formData: FormData) {
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const unitPrice = Number(formData.get("unit_price"));
  const stockQty = Number(formData.get("stock_qty"));
  const isActive = formData.get("is_active") === "on";

  if (!sku || !name) return { error: "SKU and name are required." };
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return { error: "Unit price must be a non-negative number." };
  }
  if (!Number.isInteger(stockQty) || stockQty < 0) {
    return { error: "Stock quantity must be a non-negative integer." };
  }

  return {
    values: {
      sku,
      name,
      description: description || null,
      unit_price: unitPrice,
      stock_qty: stockQty,
      is_active: isActive,
    },
  };
}

export async function createProduct(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, error: authError } = await requireAdminClient();
  if (authError) return { error: authError };

  const parsed = parseProductForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { error } = await supabase.from("products").insert(parsed.values);
  if (error) {
    return {
      error: error.code === "23505" ? "A product with that SKU already exists." : error.message,
    };
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  redirect("/admin/products");
}

export async function updateProduct(
  productId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, error: authError } = await requireAdminClient();
  if (authError) return { error: authError };

  const parsed = parseProductForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { error } = await supabase
    .from("products")
    .update(parsed.values)
    .eq("id", productId);

  if (error) {
    return {
      error: error.code === "23505" ? "A product with that SKU already exists." : error.message,
    };
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  redirect("/admin/products");
}

export async function deleteProduct(productId: string): Promise<ActionState> {
  const { supabase, error: authError } = await requireAdminClient();
  if (authError) return { error: authError };

  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) {
    // FK violation: the product appears on an order, so deactivate instead.
    if (error.code === "23503") {
      const { error: updateError } = await supabase
        .from("products")
        .update({ is_active: false })
        .eq("id", productId);
      if (updateError) return { error: updateError.message };
      revalidatePath("/admin/products");
      revalidatePath("/products");
      return {
        error:
          "Product is referenced by existing orders, so it was deactivated instead of deleted.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  return {};
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  _prev: ActionState,
  _formData: FormData
): Promise<ActionState> {
  const { supabase, error: authError } = await requireAdminClient();
  if (authError) return { error: authError };

  const { data: order } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();

  if (!order) return { error: "Order not found." };

  const allowed = NEXT_STATUSES[order.status as OrderStatus] ?? [];
  if (!allowed.includes(status)) {
    return { error: `Cannot move an order from "${order.status}" to "${status}".` };
  }

  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId);

  if (error) return { error: error.message };

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/products");
  return {};
}
