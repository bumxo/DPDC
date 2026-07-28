import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Reset password — DPDC B2B" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="mb-1 text-2xl font-bold">Forgot your password?</h1>
      <p className="mb-6 text-sm text-gray-500">
        Enter your account email and we&apos;ll send you a link to set a new
        password.
      </p>
      <ForgotPasswordForm />
      <p className="mt-6 text-sm">
        <Link href="/login" className="text-brand-600 hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}
