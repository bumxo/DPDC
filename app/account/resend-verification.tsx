"use client";

import { useState, useTransition } from "react";
import { resendVerification } from "@/actions/account";

export function ResendVerification() {
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isPending, startTransition] = useTransition();

  const resend = () => {
    startTransition(async () => {
      const result = await resendVerification();
      setIsError(Boolean(result.error));
      setMessage(result.error ?? result.success ?? null);
    });
  };

  return (
    <div>
      <button
        onClick={resend}
        disabled={isPending}
        className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Resend verification email"}
      </button>
      {message && (
        <p className={`mt-2 text-sm ${isError ? "text-red-700" : "text-green-700"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
