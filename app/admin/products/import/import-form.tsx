"use client";

import { useFormState, useFormStatus } from "react-dom";
import { importProducts, type ImportResult } from "@/actions/import";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Importing…" : "Upload and import"}
    </button>
  );
}

export function ImportForm() {
  const [state, formAction] = useFormState<ImportResult, FormData>(
    importProducts,
    {}
  );

  return (
    <div className="space-y-4">
      <form
        action={formAction}
        className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-4"
      >
        <input
          type="file"
          name="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
        />
        <SubmitButton />
      </form>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {state.created !== undefined && (
        <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Import finished: <strong>{state.created}</strong> created,{" "}
          <strong>{state.updated}</strong> updated,{" "}
          <strong>{state.uoms}</strong> UOM prices set.
        </div>
      )}

      {state.rowErrors && state.rowErrors.length > 0 && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p className="mb-1 font-semibold">
            {state.rowErrors.length} row(s) skipped:
          </p>
          <ul className="ml-4 list-disc space-y-0.5">
            {state.rowErrors.slice(0, 20).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
            {state.rowErrors.length > 20 && (
              <li>…and {state.rowErrors.length - 20} more</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
