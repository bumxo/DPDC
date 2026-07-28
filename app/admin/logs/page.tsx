import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import type { AuditLog } from "@/lib/types";

export const dynamic = "force-dynamic";

type LogRow = AuditLog & { actor: { email: string } | null };

const ACTION_LABELS: Record<string, string> = {
  "product.created": "Product created",
  "product.updated": "Product updated",
  "product.deleted": "Product deleted",
  "products.imported": "Excel import",
  "order.placed": "Order placed",
  "order.status_changed": "Order status changed",
  "account.password_changed": "Password changed",
  "account.email_change_requested": "Email change requested",
  "account.verification_resent": "Verification email resent",
  "account.password_reset_requested": "Password reset requested",
  "account.password_reset_completed": "Password reset completed",
};

function describe(log: LogRow): string {
  const d = (log.details ?? {}) as Record<string, unknown>;
  switch (log.action) {
    case "product.created":
    case "product.deleted":
      return `${d.sku ?? ""} — ${d.name ?? ""}`;
    case "product.updated": {
      const oldV = d.old as Record<string, unknown> | undefined;
      const newV = d.new as Record<string, unknown> | undefined;
      const changes: string[] = [];
      if (oldV && newV) {
        if (oldV.unit_price !== newV.unit_price)
          changes.push(`price ${oldV.unit_price} → ${newV.unit_price}`);
        if (oldV.stock_qty !== newV.stock_qty)
          changes.push(`stock ${oldV.stock_qty} → ${newV.stock_qty}`);
        if (oldV.is_active !== newV.is_active)
          changes.push(`active ${oldV.is_active} → ${newV.is_active}`);
      }
      return `${d.sku ?? ""} — ${d.name ?? ""}${
        changes.length ? ` (${changes.join(", ")})` : ""
      }`;
    }
    case "products.imported":
      return `${d.file ?? "file"}: ${d.created ?? 0} created, ${d.updated ?? 0} updated, ${d.uoms ?? 0} UOMs`;
    case "order.placed":
      return `Order ${String(log.entity_id ?? "").slice(0, 8).toUpperCase()} — total ${d.total ?? ""}`;
    case "order.status_changed":
      return `Order ${String(log.entity_id ?? "").slice(0, 8).toUpperCase()}: ${d.from} → ${d.to}`;
    case "account.email_change_requested":
      return `New address: ${d.to ?? ""}`;
    case "account.password_changed":
    case "account.password_reset_completed":
    case "account.verification_resent":
      return "—";
    default:
      return JSON.stringify(d);
  }
}

export default async function AdminLogsPage() {
  const supabase = createClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("*, actor:profiles(email)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Activity logs</h1>
      <p className="mb-4 text-sm text-gray-500">
        Product changes, imports, orders, and status updates (latest 200).
      </p>

      {(!logs || logs.length === 0) && (
        <p className="text-sm text-gray-500">
          No activity yet. Entries appear once products change or orders are
          placed. (Requires migration 0002.)
        </p>
      )}

      {logs && logs.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Detail</th>
                <th className="px-4 py-3">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(logs as LogRow[]).map((log) => (
                <tr key={log.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">
                    {formatDate(log.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{describe(log)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">
                    {log.actor?.email ?? "system"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
