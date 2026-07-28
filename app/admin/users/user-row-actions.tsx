"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminConfirmEmail,
  adminDeleteUser,
  adminResetPassword,
  adminSetRole,
} from "@/actions/users";
import type { Role } from "@/lib/types";
import type { UserRow } from "./page";

export function UserRowActions({
  user,
  viewerIsSuperuser,
  isSelf,
}: {
  user: UserRow;
  viewerIsSuperuser: boolean;
  isSelf: boolean;
}) {
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

  // A superuser row is only manageable by another superuser; a plain admin
  // must not be able to reset its password or demote it.
  const targetIsProtected = user.role === "superuser" && !viewerIsSuperuser;
  const locked = isPending || targetIsProtected;

  const changeRole = (role: Role) => {
    if (role === user.role) return;
    const warning =
      role === "superuser"
        ? `Make ${user.email} a superuser? They will be able to delete accounts, and their own account cannot be deleted.`
        : role === "admin"
          ? `Make ${user.email} an admin? They will be able to manage products, orders, and accounts.`
          : `Remove admin rights from ${user.email}?`;
    if (!confirm(warning)) return;
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

  const remove = () => {
    if (
      !confirm(
        `Permanently delete ${user.email}? This cannot be undone.`
      )
    ) {
      return;
    }
    setMessage(null);
    startTransition(async () => report(await adminDeleteUser(user.id)));
  };

  const confirmEmail = () => {
    setMessage(null);
    startTransition(async () => report(await adminConfirmEmail(user.id)));
  };

  // Deleting is superuser-only, never self, and never a superuser account.
  const canDelete = viewerIsSuperuser && !isSelf && user.role !== "superuser";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <select
          value={user.role}
          onChange={(e) => changeRole(e.target.value as Role)}
          disabled={locked || isSelf}
          aria-label={`Role for ${user.email}`}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-50"
        >
          <option value="customer">Customer</option>
          <option value="admin">Admin</option>
          {(viewerIsSuperuser || user.role === "superuser") && (
            <option value="superuser">Superuser</option>
          )}
        </select>

        <button
          onClick={() => setResetting((v) => !v)}
          disabled={locked}
          className="whitespace-nowrap rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          Reset password
        </button>

        {!user.verified && (
          <button
            onClick={confirmEmail}
            disabled={locked}
            className="whitespace-nowrap rounded-md border border-amber-300 px-3 py-1 text-sm text-amber-800 hover:bg-amber-50 disabled:opacity-50"
          >
            Mark verified
          </button>
        )}

        {canDelete && (
          <button
            onClick={remove}
            disabled={isPending}
            className="whitespace-nowrap rounded-md border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>

      {resetting && !targetIsProtected && (
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

      {user.role === "superuser" && (
        <p className="text-right text-xs text-gray-400">
          Protected — cannot be deleted
        </p>
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
