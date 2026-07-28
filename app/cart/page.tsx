import { redirect } from "next/navigation";

// The cart now lives on the products page itself.
export default function CartPage() {
  redirect("/products");
}
