import { headers } from "next/headers";

/**
 * Absolute origin for links sent by email. Supabase requires a full URL, and
 * the deployed host is only known at request time unless it is pinned via
 * NEXT_PUBLIC_SITE_URL.
 */
export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "http://localhost:3000";

  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
