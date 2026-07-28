"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { describeAuthError, logAuthError } from "@/lib/auth-errors";

export interface AccountState {
  error?: string;
  success?: string;
}

const MIN_PASSWORD_LENGTH = 8;

function validatePassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password !== confirm) {
    return "New password and confirmation do not match.";
  }
  return null;
}

/**
 * Change the password of the signed-in user. Supabase does not require the
 * current password to update it, so it is verified explicitly here — otherwise
 * anyone with a borrowed session could lock the owner out.
 */
export async function changePassword(
  _prev: AccountState,
  formData: FormData
): Promise<AccountState> {
  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (!current) return { error: "Enter your current password." };

  const invalid = validatePassword(next, confirm);
  if (invalid) return { error: invalid };
  if (current === next) {
    return { error: "The new password must differ from the current one." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "You are not signed in." };

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  });
  if (reauthError) return { error: "Current password is incorrect." };

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) {
    logAuthError("changePassword", error);
    return { error: describeAuthError(error) };
  }

  await supabase.rpc("log_account_event", {
    p_action: "account.password_changed",
    p_details: {},
  });

  revalidatePath("/account");
  return { success: "Password updated." };
}

/**
 * Request an email change. Supabase sends a verification link to the new
 * address (and to the old one when "Secure email change" is enabled); the
 * address only changes once the link is clicked.
 */
export async function changeEmail(
  _prev: AccountState,
  formData: FormData
): Promise<AccountState> {
  const newEmail = String(formData.get("new_email") ?? "").trim().toLowerCase();
  if (!newEmail || !newEmail.includes("@")) {
    return { error: "Enter a valid email address." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are not signed in." };

  if (user.email?.toLowerCase() === newEmail) {
    return { error: "That is already your email address." };
  }

  const { error } = await supabase.auth.updateUser(
    { email: newEmail },
    { emailRedirectTo: `${getSiteUrl()}/auth/confirm?next=/account` }
  );
  if (error) {
    logAuthError("changeEmail", error);
    return { error: describeAuthError(error, "signup") };
  }

  await supabase.rpc("log_account_event", {
    p_action: "account.email_change_requested",
    p_details: { to: newEmail },
  });

  return {
    success: `Verification link sent to ${newEmail}. The change takes effect once you click it.`,
  };
}

/** Re-send the verification email for an address that is not yet confirmed. */
export async function resendVerification(): Promise<AccountState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "You are not signed in." };
  if (user.email_confirmed_at) {
    return { success: "Your email is already verified." };
  }

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: user.email,
    options: { emailRedirectTo: `${getSiteUrl()}/auth/confirm?next=/account` },
  });
  if (error) {
    logAuthError("resendVerification", error);
    return { error: describeAuthError(error, "signup") };
  }

  await supabase.rpc("log_account_event", {
    p_action: "account.verification_resent",
    p_details: {},
  });

  return { success: `Verification email sent to ${user.email}.` };
}

/**
 * Start the forgot-password flow. Always reports success so the form cannot be
 * used to discover which addresses have accounts.
 */
export async function requestPasswordReset(
  _prev: AccountState,
  formData: FormData
): Promise<AccountState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email address." };
  }

  const supabase = createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/confirm?next=/reset-password`,
  });

  return {
    success:
      "If that address has an account, a password reset link is on its way. Check your inbox and spam folder.",
  };
}

/**
 * Finish the forgot-password flow. Reached with the temporary session created
 * by the recovery link, so no current password is required here.
 */
export async function completePasswordReset(
  _prev: AccountState,
  formData: FormData
): Promise<AccountState> {
  const next = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  const invalid = validatePassword(next, confirm);
  if (invalid) return { error: invalid };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error:
        "This reset link has expired. Request a new one from the sign-in page.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) {
    logAuthError("completePasswordReset", error);
    return { error: describeAuthError(error, "recovery") };
  }

  await supabase.rpc("log_account_event", {
    p_action: "account.password_reset_completed",
    p_details: {},
  });

  return { success: "Password updated. You can now use it to sign in." };
}
