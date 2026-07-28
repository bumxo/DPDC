import Link from "next/link";
import { SignUpForm } from "./signup-form";

export const metadata = { title: "Create account — DPDC B2B" };

export default function SignUpPage() {
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="mb-1 text-2xl font-bold">Create your account</h1>
      <p className="mb-6 text-sm text-gray-500">
        Register your business to browse the catalog and place orders.
      </p>
      <SignUpForm />
      <p className="mt-6 text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
