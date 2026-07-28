"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { adminCreateUser, type UserActionState } from "@/actions/users";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Creating…" : "Create account"}
    </button>
  );
}

export function CreateUserForm({
  canCreateSuperuser,
}: {
  canCreateSuperuser: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState<UserActionState, FormData>(
    adminCreateUser,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state.success, router]);

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() => setOpen(true)}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + New account
        </button>
        {state.success && (
          <span className="text-sm text-green-700">{state.success}</span>
        )}
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="max-w-2xl rounded-lg border border-gray-200 bg-white p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">New account</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="new-email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input
            id="new-email"
            name="email"
            type="email"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="new-company"
            className="mb-1 block text-sm font-medium"
          >
            Company
          </label>
          <input
            id="new-company"
            name="company"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="new-password"
            className="mb-1 block text-sm font-medium"
          >
            Temporary password
          </label>
          <input
            id="new-password"
            name="password"
            type="text"
            required
            minLength={8}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-400">
            At least 8 characters. Share it with the customer, who can change it
            under Account.
          </p>
        </div>
        <div>
          <label htmlFor="new-role" className="mb-1 block text-sm font-medium">
            Role
          </label>
          <select
            id="new-role"
            name="role"
            defaultValue="customer"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="customer">Customer</option>
            <option value="admin">Admin</option>
            {canCreateSuperuser && (
              <option value="superuser">Superuser</option>
            )}
          </select>
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        The account is created already verified, so no confirmation email is
        sent.
      </p>

      {state.error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {state.success}
        </p>
      )}

      <div className="mt-4">
        <SubmitButton />
      </div>
    </form>
  );
}
