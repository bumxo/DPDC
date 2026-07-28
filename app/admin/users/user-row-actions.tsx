"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminConfirmEmail,
  adminResetPassword,
  adminSetRole,
} from "@/actions/users";
import type { Role } from "@/lib/types";
import type { UserRow } from "./page";

export function UserRowActions({ user }: { user: UserRow }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const report = (result: { error?: string; success?: string }) => {
    setIsError(Boolean(result.error));
    setMessage(result.error ?? result.success ?? null);
    if (!result.error) router.refresh();
  };

  const changeRole = (role: Role) => {
    if (role === user.role) return;
    if (
      !confirm(
        role === "admin"
          ? `Make ${user.email} an admin? They will be able to manage products, orders, and other accounts.`
          : `Remove admin rights from ${user.email}?`
      )
    ) {
      return;
    }
    setMessage(null);
    startTransition(async () => report(await adminSetRole(user.id, role)));
  };

  const submitReset = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await adminResetPassword(user.id, password);
      report(result);
      if (!result.error) {
        setResetting(false);
        setPassword("");
      }
    });
  };

  const confirmEmail = () => {
    setMessage(null);
    startTransition(async () => report(await adminConfirmEmail(user.id)));
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <select
          value={user.role}
          onChange={(e) => changeRole(e.target.value as Role)}
          disabled={isPending}
          aria-label={`Role for ${user.email}`}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-50"
        >
          <option value="customer">Customer</option>
          <option value="admin">Admin</option>
        </select>

        <button
          onClick={() => setResetting((v) => !v)}
          disabled={isPending}
          className="whitespace-nowrap rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          Reset password
        </button>

        {!user.verified && (
          <button
            onClick={confirmEmail}
            disabled={isPending}
            className="whitespace-nowrap rounded-md border border-amber-300 px-3 py-1 text-sm text-amber-800 hover:bg-amber-50 disabled:opacity-50"
          >
            Mark verified
          </button>
        )}
      </div>

      {resetting && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            minLength={8}
            aria-label={`New password for ${user.email}`}
            className="w-44 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
          />
          <button
            onClick={submitReset}
            disabled={isPending || password.length < 8}
            className="rounded-md bg-brand-600 px-3 py-1 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      {message && (
        <p
          className={`text-right text-xs ${
            isError ? "text-red-600" : "text-green-700"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
