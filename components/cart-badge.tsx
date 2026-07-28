"use client";

import Link from "next/link";
import { useCart } from "@/components/cart-provider";

export function CartBadge() {
  const { count } = useCart();

  return (
    <Link
      href="/products"
      className="relative rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    >
      Cart
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-xs font-semibold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
