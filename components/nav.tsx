import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { signOut } from "@/actions/auth";
import { CartBadge } from "@/components/cart-badge";

export async function Nav() {
  const profile = await getProfile();

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3">
        <Link href="/products" className="mr-4 text-lg font-bold tracking-tight">
          DPDC&nbsp;<span className="font-normal text-gray-500">B2B</span>
        </Link>

        {profile && (
          <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm">
            <Link
              href="/products"
              className="rounded-md px-3 py-2 font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              Products
            </Link>
            <Link
              href="/orders"
              className="rounded-md px-3 py-2 font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              My orders
            </Link>
            <CartBadge />
            {profile.role === "admin" && (
              <Link
                href="/admin"
                className="rounded-md px-3 py-2 font-medium text-blue-700 hover:bg-blue-50"
              >
                Admin
              </Link>
            )}

            <div className="ml-auto flex items-center gap-3">
              <span className="hidden text-xs text-gray-500 sm:inline">
                {profile.email}
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Sign out
                </button>
              </form>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
