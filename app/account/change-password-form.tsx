"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { changePassword, type AccountState } from "@/actions/account";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Updating…" : "Update password"}
    </button>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = useFormState<AccountState, FormData>(
    changePassword,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Don't leave the old password sitting in the inputs after a successful change.
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="current_password"
          className="mb-1 block text-sm font-medium"
        >
          Current password
        </label>
        <input
          id="current_password"
          name="current_password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      </div>

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
      {state.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {state.success}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
