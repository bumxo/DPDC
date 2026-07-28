/**
 * Seeds the database with sample products and two accounts (one admin, one
 * customer). Idempotent: safe to run multiple times.
 *
 * Usage: npm run seed  (requires .env.local with SUPABASE_SERVICE_ROLE_KEY)
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Copy .env.example to .env.local and fill them in."
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ACCOUNTS = [
  {
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.com",
    password: process.env.SEED_ADMIN_PASSWORD ?? "admin-password-123",
    role: "admin" as const,
  },
  {
    email: process.env.SEED_CUSTOMER_EMAIL ?? "customer@example.com",
    password: process.env.SEED_CUSTOMER_PASSWORD ?? "customer-password-123",
    role: "customer" as const,
  },
];

const PRODUCTS = [
  { sku: "PKG-1001", name: "Corrugated Shipping Box (S)", description: "30×20×15 cm single-wall box, pack of 25.", unit_price: 18.5, stock_qty: 240 },
  { sku: "PKG-1002", name: "Corrugated Shipping Box (M)", description: "45×30×25 cm single-wall box, pack of 25.", unit_price: 26.0, stock_qty: 180 },
  { sku: "PKG-1003", name: "Corrugated Shipping Box (L)", description: "60×40×40 cm double-wall box, pack of 20.", unit_price: 39.9, stock_qty: 8 },
  { sku: "TAPE-2001", name: "Packing Tape 48mm", description: "Clear acrylic tape, 66 m roll, pack of 36.", unit_price: 42.0, stock_qty: 320 },
  { sku: "WRAP-3001", name: "Stretch Wrap Roll", description: "500 mm × 300 m, 20 µm cast stretch film.", unit_price: 12.75, stock_qty: 96 },
  { sku: "WRAP-3002", name: "Bubble Wrap Roll", description: "600 mm × 100 m, 10 mm bubbles.", unit_price: 31.4, stock_qty: 5 },
  { sku: "LBL-4001", name: "Thermal Shipping Labels", description: "100×150 mm, 500 labels per roll, pack of 8.", unit_price: 54.0, stock_qty: 150 },
  { sku: "PAL-5001", name: "Euro Pallet (EPAL)", description: "1200×800 mm, heat-treated wood.", unit_price: 22.0, stock_qty: 64 },
  { sku: "STRAP-6001", name: "PP Strapping Kit", description: "12 mm strap, 1000 m coil with 250 buckles.", unit_price: 68.5, stock_qty: 0 },
  { sku: "GLV-7001", name: "Nitrile Work Gloves", description: "Size L, box of 100.", unit_price: 9.9, stock_qty: 410, is_active: false },
];

async function findUserByEmail(email: string) {
  // listUsers is paginated; a seed database is small enough to scan.
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) throw error;
    const match = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (match) return match;
    if (data.users.length < 100) return null;
    page += 1;
  }
}

async function seedAccounts() {
  for (const account of ACCOUNTS) {
    const existing = await findUserByEmail(account.email);
    if (existing) {
      console.log(`✓ User already exists: ${account.email} (${account.role})`);
      // Make sure the profile role matches (e.g. if the migration trigger
      // ran before app_metadata was considered).
      await supabase
        .from("profiles")
        .update({ role: account.role })
        .eq("id", existing.id);
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      app_metadata: { role: account.role },
    });
    if (error) throw error;

    // The DB trigger creates the profile; enforce the role explicitly in
    // case the trigger predates the role-from-metadata logic.
    await supabase
      .from("profiles")
      .update({ role: account.role })
      .eq("id", data.user.id);

    console.log(`+ Created ${account.role}: ${account.email}`);
  }
}

async function seedProducts() {
  const { error } = await supabase
    .from("products")
    .upsert(
      PRODUCTS.map((p) => ({ is_active: true, ...p })),
      { onConflict: "sku" }
    );
  if (error) throw error;
  console.log(`+ Upserted ${PRODUCTS.length} products`);
}

async function main() {
  await seedAccounts();
  await seedProducts();
  console.log("\nSeed complete. Sign in with:");
  for (const account of ACCOUNTS) {
    console.log(`  ${account.role}: ${account.email} / ${account.password}`);
  }
}

main().catch((err) => {
  console.error("Seed failed:", err.message ?? err);
  process.exit(1);
});
