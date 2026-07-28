"use server";

import { revalidatePath } from "next/cache";
import {
  createAdminClient,
  logAdminAction,
  requireAdminContext,
} from "@/lib/supabase/admin";
import type { Role } from "@/lib/types";

export interface UserActionState {
  error?: string;
  success?: string;
}

const MIN_PASSWORD_LENGTH = 8;

/** Create an account directly. Pre-verified, so no confirmation email is sent. */
export async function adminCreateUser(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const auth = await requireAdminContext();
  if (!auth.ok) return { error: auth.error };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const company = String(formData.get("company") ?? "").trim();
  const role = String(formData.get("role") ?? "customer") as Role;

  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email address." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (role !== "customer" && role !== "admin") {
    return { error: "Role must be customer or admin." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: company ? { company } : {},
  });

  if (error) {
    return {
      error: /already been registered|already exists/i.test(error.message)
        ? "An account with that email already exists."
        : error.message,
    };
  }

  // The signup trigger sets these, but write them explicitly so the result is
  // correct even if migration 0004 has not been applied.
  await admin
    .from("profiles")
    .update({ role, ...(company ? { company } : {}) })
    .eq("id", data.user.id);

  await logAdminAction(auth.context.actorId, "admin.user_created", data.user.id, {
    email,
    role,
    company: company || null,
  });

  revalidatePath("/admin/users");
  return { success: `Created ${email} as ${role}.` };
}

/** Promote or demote an account. */
export async function adminSetRole(
  userId: string,
  role: Role
): Promise<UserActionState> {
  const auth = await requireAdminContext();
  if (!auth.ok) return { error: auth.error };

  if (role !== "customer" && role !== "admin") {
    return { error: "Role must be customer or admin." };
  }

  // Changing your own role is how an admin accidentally locks themselves out
  // of the admin area with no way back through the UI.
  if (userId === auth.context.actorId) {
    return { error: "You cannot change your own role." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: (e as Error).message };
  }

  // Never leave the system with no admin at all.
  if (role === "customer") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return { error: "This is the last admin — promote someone else first." };
    }
  }

  // app_metadata is the source of truth the signup trigger reads; profiles is
  // what the app queries. Keep both in step.
  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role },
  });
  if (authError) return { error: authError.message };

  const { error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) return { error: error.message };

  await logAdminAction(auth.context.actorId, "admin.role_changed", userId, {
    role,
  });

  revalidatePath("/admin/users");
  return { success: `Role updated to ${role}.` };
}

/** Set a new password for an account without involving email. */
export async function adminResetPassword(
  userId: string,
  password: string
): Promise<UserActionState> {
  const auth = await requireAdminContext();
  if (!auth.ok) return { error: auth.error };

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { error: error.message };

  await logAdminAction(auth.context.actorId, "admin.password_reset", userId, {});

  revalidatePath("/admin/users");
  return { success: "Password updated." };
}

/** Mark an address as verified without sending a confirmation email. */
export async function adminConfirmEmail(
  userId: string
): Promise<UserActionState> {
  const auth = await requireAdminContext();
  if (!auth.ok) return { error: auth.error };

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });
  if (error) return { error: error.message };

  await logAdminAction(auth.context.actorId, "admin.email_confirmed", userId, {});

  revalidatePath("/admin/users");
  return { success: "Email marked as verified." };
}
