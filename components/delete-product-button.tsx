"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProduct } from "@/actions/admin";

export function DeleteProductButton({
  productId,
  name,
}: {
  productId: string;
  name: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const onDelete = () => {
    if (!confirm(`Delete "${name}"?`)) return;
    startTransition(async () => {
      const result = await deleteProduct(productId);
      setMessage(result.error ?? null);
      router.refresh();
    });
  };

  return (
    <>
      <button
        onClick={onDelete}
        disabled={isPending}
        className="text-red-600 hover:underline disabled:opacity-50"
      >
        Delete
      </button>
      {message && (
        <span className="block text-xs text-amber-600">{message}</span>
      )}
    </>
  );
}
