/**
 * Turns a Supabase auth error into something a user can act on.
 *
 * When GoTrue replies with an empty or non-standard body, supabase-js has
 * nothing to read a message from and sets `message` to the stringified body —
 * literally "{}". Showing that to a user is worse than useless, so opaque
 * errors are replaced with the likely causes. The original is logged
 * server-side (see logAuthError) for whoever is reading the deploy logs.
 */

const OPAQUE = new Set(["", "{}", "[]", "null", "undefined", "[object Object]"]);

export function describeAuthError(
  error: { message?: string; status?: number } | null | undefined,
  context: "signup" | "signin" | "recovery" | "generic" = "generic"
): string {
  const raw = (error?.message ?? "").trim();

  if (!OPAQUE.has(raw)) {
    // Supabase's own wording for a failed send is accurate but bare; point at
    // the setting that actually fixes it.
    if (/error sending.*email/i.test(raw)) {
      return "The account could not be created because the confirmation email failed to send. This is almost always SMTP: in Supabase, open Authentication → Emails and configure an SMTP provider (the built-in sender is limited to a few messages per hour).";
    }
    if (/database error/i.test(raw)) {
      return "The database rejected the new account. If the migrations were applied out of order, re-run the latest one in the Supabase SQL editor.";
    }
    return raw;
  }

  // No message to work with. The HTTP status is then the only real clue, so
  // include it rather than leaving the reader with nothing to search for.
  const status = error?.status;
  const detail = status ? ` (status ${status})` : "";

  if (status === 429) {
    return `Too many attempts — the email rate limit was hit${detail}. Supabase's built-in sender allows only a few messages per hour. Wait, or configure SMTP under Authentication → Emails.`;
  }

  switch (context) {
    case "signup":
      return `Sign-up failed and the service returned no details${detail}. The usual cause is email delivery — Supabase's built-in sender is capped at a few messages per hour. To confirm: turn off "Confirm email" (Authentication → Sign In / Providers → Email) and try again; if it then works, configure SMTP under Authentication → Emails. Logs → Auth shows the exact reason.`;
    case "recovery":
      return `The reset could not be completed and the service returned no details${detail}. Check Logs → Auth in the Supabase dashboard.`;
    default:
      return `Something went wrong and the service returned no details${detail}. Check Logs → Auth in the Supabase dashboard.`;
  }
}

/** Server-side breadcrumb so the real error survives in the deploy logs. */
export function logAuthError(where: string, error: unknown) {
  console.error(`[auth:${where}]`, JSON.stringify(error, Object.getOwnPropertyNames(error ?? {})));
}
