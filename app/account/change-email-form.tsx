"use client";

import { useFormState, useFormStatus } from "react-dom";
import { changeEmail, type AccountState } from "@/actions/account";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
    >
      {pending ? "Sending…" : "Send verification link"}
    </button>
  );
}

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [state, formAction] = useFormState<AccountState, FormData>(
    changeEmail,
    {}
  );

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="new_email" className="mb-1 block text-sm font-medium">
          Change email address
        </label>
        <input
          id="new_email"
          name="new_email"
          type="email"
          required
          placeholder={currentEmail}
          autoComplete="email"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-400">
          We&apos;ll email the new address a link. The change only applies once
          you click it.
        </p>
      </div>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {state.success}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
