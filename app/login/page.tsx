import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — DPDC B2B" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="mb-1 text-2xl font-bold">Sign in</h1>
      <p className="mb-6 text-sm text-gray-500">
        Use your company account to place and track orders.
      </p>
      <LoginForm next={searchParams.next} />
      <p className="mt-4 text-center text-sm">
        <Link
          href="/forgot-password"
          className="text-brand-600 hover:underline"
        >
          Forgot your password?
        </Link>
      </p>
    </div>
  );
}
