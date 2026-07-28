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
const VALID_ROLES: Role[] = ["customer", "admin", "superuser"];

/** Reads a target's current role using the service client. */
async function getTargetRole(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<Role | null> {
  const { data } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return (data?.role as Role) ?? null;
}

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
  if (!VALID_ROLES.includes(role)) {
    return { error: "Role must be customer, admin, or superuser." };
  }
  if (role === "superuser" && !auth.context.isSuperuser) {
    return { error: "Only a superuser can create another superuser." };
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

  if (!VALID_ROLES.includes(role)) {
    return { error: "Role must be customer, admin, or superuser." };
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

  const targetRole = await getTargetRole(admin, userId);
  if (!targetRole) return { error: "Account not found." };

  // Only a superuser may grant or revoke superuser. Without the second check
  // a plain admin could demote the superuser and take over.
  if (
    (role === "superuser" || targetRole === "superuser") &&
    !auth.context.isSuperuser
  ) {
    return { error: "Only a superuser can change superuser accounts." };
  }

  // Never leave the system with no admin at all.
  if (role === "customer") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("role", ["admin", "superuser"]);
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

  // Resetting a superuser's password would hand a plain admin the superuser
  // account outright, which is the whole protection defeated.
  const targetRole = await getTargetRole(admin, userId);
  if (targetRole === "superuser" && !auth.context.isSuperuser) {
    return { error: "Only a superuser can reset a superuser's password." };
  }

  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { error: error.message };

  await logAdminAction(auth.context.actorId, "admin.password_reset", userId, {});

  revalidatePath("/admin/users");
  return { success: "Password updated." };
}

/**
 * Permanently delete an account. Restricted to superusers — plain admins
 * cannot delete anyone. Superuser accounts are undeletable; the database
 * enforces that too, via a trigger, so this check is only the friendly error.
 */
export async function adminDeleteUser(
  userId: string
): Promise<UserActionState> {
  const auth = await requireAdminContext();
  if (!auth.ok) return { error: auth.error };

  if (!auth.context.isSuperuser) {
    return { error: "Only a superuser can delete accounts." };
  }
  if (userId === auth.context.actorId) {
    return { error: "You cannot delete your own account." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const targetRole = await getTargetRole(admin, userId);
  if (!targetRole) return { error: "Account not found." };
  if (targetRole === "superuser") {
    return { error: "Superuser accounts cannot be deleted." };
  }

  // Orders reference profiles, so an account with history cannot be removed
  // without destroying that history. Say so instead of failing opaquely.
  const { count: orderCount } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", userId);

  if ((orderCount ?? 0) > 0) {
    return {
      error: `This account has ${orderCount} order(s). Deleting it would remove that order history, so it is blocked — demote the account instead.`,
    };
  }

  const { data: target } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  await logAdminAction(auth.context.actorId, "admin.user_deleted", userId, {
    email: target?.email ?? null,
    role: targetRole,
  });

  revalidatePath("/admin/users");
  return { success: `Deleted ${target?.email ?? "account"}.` };
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
