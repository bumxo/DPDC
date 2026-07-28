"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { describeAuthError, logAuthError } from "@/lib/auth-errors";

export interface AuthState {
  error?: string;
}

export interface SignUpState {
  error?: string;
  /** Set when the account was created but must be verified before signing in. */
  checkInbox?: string;
}

export async function signIn(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "") || "/products";

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Invalid email or password." };
  }

  redirect(next.startsWith("/") ? next : "/products");
}

/**
 * Self-service registration. Always produces a customer: the role lives in
 * app_metadata, which this client key cannot write, so nothing submitted here
 * can grant admin rights.
 */
export async function signUp(
  _prev: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const company = String(formData.get("company") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (!company) return { error: "Company name is required." };
  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email address." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Password and confirmation do not match." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { company },
      emailRedirectTo: `${getSiteUrl()}/auth/confirm?next=/products`,
    },
  });

  if (error) {
    logAuthError("signUp", error);
    return { error: describeAuthError(error, "signup") };
  }

  // Supabase returns a user with no identities when the address is already
  // registered. Report the same message either way so this form cannot be
  // used to discover which addresses have accounts.
  const alreadyRegistered = data.user && data.user.identities?.length === 0;

  if (data.session && !alreadyRegistered) {
    // Email confirmation is disabled for the project — straight in.
    redirect("/products");
  }

  return {
    checkInbox: `We've sent a confirmation link to ${email}. Click it to activate your account, then sign in.`,
  };
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
