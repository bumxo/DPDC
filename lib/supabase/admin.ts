// The `server-only` import makes importing this file from a client component
// a build error. The service-role key below bypasses every RLS policy, so it
// must never reach the browser.
import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Service-role client. Bypasses RLS entirely — only ever use it behind
 * `requireAdmin()` below, never on a path a non-admin can reach.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to the server environment " +
        "(Vercel → Settings → Environment Variables) to use admin user management."
    );
  }

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface AdminContext {
  /** The signed-in admin performing the action. */
  actorId: string;
  actorEmail: string;
}

/**
 * Confirms the caller is an admin, using their own session and RLS — never
 * the service-role client, which would happily confirm anything. Returns an
 * error string instead of throwing so actions can surface it in the UI.
 */
export async function requireAdminContext(): Promise<
  { ok: true; context: AdminContext } | { ok: false; error: string }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "You are not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { ok: false, error: "Admin access required." };
  }

  return {
    ok: true,
    context: { actorId: user.id, actorEmail: user.email ?? "" },
  };
}

/** Writes an admin action to the audit trail. Best effort — never blocks. */
export async function logAdminAction(
  actorId: string,
  action: string,
  targetId: string,
  details: Record<string, unknown>
) {
  const supabase = createClient();
  await supabase
    .from("audit_logs")
    .insert({
      actor_id: actorId,
      action,
      entity: "user",
      entity_id: targetId,
      details,
    })
    .then(({ error }) => {
      if (error) console.error("[audit]", action, error.message);
    });
}
