"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { completePasswordReset, type AccountState } from "@/actions/account";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Set new password"}
    </button>
  );
}

export function ResetPasswordForm() {
  const [state, formAction] = useFormState<AccountState, FormData>(
    completePasswordReset,
    {}
  );

  if (state.success) {
    return (
      <div className="space-y-4">
        <p className="rounded-md bg-green-50 px-3 py-3 text-sm text-green-800">
          {state.success}
        </p>
        <Link
          href="/products"
          className="inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Continue to products
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="new_password" className="mb-1 block text-sm font-medium">
          New password
        </label>
        <input
          id="new_password"
          name="new_password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-400">At least 8 characters.</p>
      </div>

      <div>
        <label
          htmlFor="confirm_password"
          className="mb-1 block text-sm font-medium"
        >
          Confirm new password
        </label>
        <input
          id="confirm_password"
          name="confirm_password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      </div>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
