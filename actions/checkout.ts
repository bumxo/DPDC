"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface CheckoutResult {
  orderId?: string;
  error?: string;
}

export async function placeOrder(
  items: { productId: string; qty: number }[]
): Promise<CheckoutResult> {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Your cart is empty." };
  }

  const payload = items.map((i) => ({
    product_id: i.productId,
    qty: Math.floor(i.qty),
  }));

  if (payload.some((i) => !i.product_id || !Number.isFinite(i.qty) || i.qty <= 0)) {
    return { error: "Cart contains an invalid item." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to place an order." };
  }

  const { data, error } = await supabase.rpc("place_order", {
    p_items: payload,
  });

  if (error) {
    // Surface stock/availability messages raised by the DB function.
    return { error: error.message || "Checkout failed." };
  }

  revalidatePath("/products");
  revalidatePath("/orders");
  return { orderId: data as string };
}
