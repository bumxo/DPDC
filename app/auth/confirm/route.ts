import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for every link Supabase emails: signup confirmation, email
 * change, and password recovery. Depending on the project's flow settings the
 * link carries either `token_hash` + `type` or a PKCE `code`, so both are
 * handled here. A successful exchange establishes the session, then the user
 * is sent on to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  // Only allow same-site redirect targets.
  const nextParam = searchParams.get("next") ?? "/products";
  const next = nextParam.startsWith("/") ? nextParam : "/products";

  const supabase = createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(
      `${origin}/auth/error?reason=${encodeURIComponent(error.message)}`
    );
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(
      `${origin}/auth/error?reason=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}
