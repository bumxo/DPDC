import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Admin — DPDC B2B" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div>
      <nav className="mb-6 flex flex-wrap gap-1 border-b border-gray-200 pb-3 text-sm">
        <Link
          href="/admin"
          className="rounded-md px-3 py-1.5 font-medium text-gray-600 hover:bg-gray-100"
        >
          Overview
        </Link>
        <Link
          href="/admin/orders"
          className="rounded-md px-3 py-1.5 font-medium text-gray-600 hover:bg-gray-100"
        >
          Orders
        </Link>
        <Link
          href="/admin/products"
          className="rounded-md px-3 py-1.5 font-medium text-gray-600 hover:bg-gray-100"
        >
          Products
        </Link>
      </nav>
      {children}
    </div>
  );
}
