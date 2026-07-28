import { requireUser } from "@/lib/auth";
import { CartView } from "@/components/cart-view";

export const metadata = { title: "Cart — DPDC B2B" };

export default async function CartPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Your cart</h1>
      <CartView />
    </div>
  );
}
