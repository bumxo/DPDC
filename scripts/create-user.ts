/**
 * Provision an account directly, bypassing the signup form and its
 * confirmation email. Useful for onboarding a B2B customer by hand, for
 * creating the first admin, or when email delivery is not yet configured.
 *
 * Usage:
 *   npm run create-user -- --email=buyer@corp.ph --password='secret123' \
 *                          --company='Corp Pharmacy' [--role=admin|superuser]
 *
 * This is the only way to create the first superuser: the role travels in
 * app_metadata, which the browser's anon key cannot write.
 *
 * Re-running for an existing address resets that account's password and
 * updates its company/role, so it doubles as a rescue tool if you are locked
 * out. Requires SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Copy .env.example to .env.local and fill them in (Supabase → Project Settings → API)."
  );
  process.exit(1);
}

function arg(name: string): string | undefined {
  const prefixed = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefixed));
  return hit?.slice(prefixed.length);
}

const email = arg("email")?.trim().toLowerCase();
const password = arg("password");
const company = arg("company")?.trim() ?? null;
const role = (arg("role") ?? "customer").trim();

if (!email || !password) {
  console.error(
    "Usage: npm run create-user -- --email=you@example.com --password='secret123' " +
      "--company='Company Name' [--role=admin]"
  );
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}
if (role !== "customer" && role !== "admin" && role !== "superuser") {
  console.error(
    `Invalid --role "${role}". Use "customer", "admin", or "superuser".`
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(target: string) {
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) throw error;
    const match = data.users.find(
      (u) => u.email?.toLowerCase() === target.toLowerCase()
    );
    if (match) return match;
    if (data.users.length < 100) return null;
    page += 1;
  }
}

async function main() {
  const existing = await findUserByEmail(email!);
  let userId: string;

  if (existing) {
    // email_confirm here also verifies an address that was left unconfirmed.
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      app_metadata: { role },
      user_metadata: company ? { company } : {},
    });
    if (error) throw error;
    userId = existing.id;
    console.log(`✎ Updated existing account: ${email}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // pre-verified: no confirmation email is sent
      app_metadata: { role },
      user_metadata: company ? { company } : {},
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`+ Created account: ${email}`);
  }

  // The signup trigger fills these in, but set them explicitly so this works
  // even if migration 0004 has not been applied yet.
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ role, ...(company ? { company } : {}) })
    .eq("id", userId);
  if (profileError) throw profileError;

  console.log(`  role:     ${role}`);
  if (company) console.log(`  company:  ${company}`);
  console.log(`  verified: yes (no confirmation email needed)`);
  console.log(`\nSign in at /login with ${email} and the password you set.`);
}

main().catch((err) => {
  console.error("Failed:", err.message ?? err);
  process.exit(1);
});
