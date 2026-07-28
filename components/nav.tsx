import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/actions/auth";
import { CartBadge } from "@/components/cart-badge";

export async function Nav() {
  const profile = await getProfile();

  let emailVerified = true;
  if (profile) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    emailVerified = Boolean(user?.email_confirmed_at);
  }

  return (
    <>
      {profile && !emailVerified && (
        <div className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
          Your email address isn&apos;t verified.{" "}
          <Link href="/account" className="font-medium underline">
            Verify it now
          </Link>{" "}
          so you can reset your password if you get locked out.
        </div>
      )}
    <header className="sticky top-0 z-10 border-b-2 border-brand-600 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3">
        <Link
          href="/products"
          className="mr-4 text-lg font-bold tracking-tight text-brand-700"
        >
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
                className="rounded-md px-3 py-2 font-medium text-brand-700 hover:bg-brand-50"
              >
                Admin
              </Link>
            )}

            <div className="ml-auto flex items-center gap-2">
              <Link
                href="/account"
                className="hidden max-w-[14rem] truncate rounded-md px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-900 sm:inline-block"
              >
                {profile.email}
              </Link>
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
    </>
  );
}
