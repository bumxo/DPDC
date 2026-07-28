# DPDC B2B Ordering System

A minimal B2B ordering web app: customers browse a product catalog, build a
cart, and submit orders; admins manage products, track stock, and move orders
through their lifecycle.

**Stack:** Next.js 14 (App Router, TypeScript) · Supabase (Postgres, Auth,
RLS) · Tailwind CSS · deployable to Vercel.

## Features

- **Auth** — email/password sign-in via Supabase Auth with two roles:
  `customer` and `admin` (stored in a `profiles` table, auto-created by a
  database trigger on signup).
- **Catalog & checkout on one page** — customers browse and search active
  products with a sticky cart panel alongside the list (`/products`).
- **Cart** — client-side cart (localStorage) with quantity
  controls; checkout runs through a server action that calls the
  `place_order` Postgres function, which locks product rows, validates
  stock, decrements it, and creates the order atomically.
- **Orders** — statuses `pending → confirmed → shipped → delivered`, plus
  `cancelled` (allowed from pending/confirmed; cancelling returns reserved
  stock). Transitions are enforced by a DB trigger.
- **Customer dashboard** — order history with status and line-item detail
  (`/orders`).
- **Admin dashboard** — overview with order counts and low-stock list
  (`/admin`), all orders with status updates (`/admin/orders`), and full
  product CRUD (`/admin/products`).
- **Units of measure (UOM)** — each product can be sold in several units
  (Piece, Blister of 10, Box of 100, Bottle…) with a price per UOM; the
  catalog price follows the selected UOM. Stock is tracked in base units
  (`units_per_uom` converts, e.g. a Box of 100 consumes 100 stock units).
- **Excel mass upload** — Admin → Products → Mass upload accepts an .xlsx
  file (template in `public/templates/product-import-template.xlsx`,
  pre-filled with 100 sample pharmacy items). Products are upserted by SKU;
  each row is one UOM price line.
- **Self-service signup** — `/signup` registers a new business (company
  name, work email, password) and emails a confirmation link. New accounts
  are always customers; see the note on role escalation below.
- **Account security** — `/account` lets a signed-in user change their
  password (the current one is re-verified first) and change their email
  address (confirmed by a link sent to the new inbox). Forgotten passwords
  are recovered via `/forgot-password` → emailed link → `/reset-password`.
- **Email verification** — verification status is shown on the account page,
  with a resend button and a site-wide banner while an address is
  unverified.
- **Activity logs** — Admin → Logs shows an audit trail (product
  create/update/delete, imports, order placement, status changes, and
  account events like password changes) captured by database triggers.
- Prices are displayed in Philippine pesos (₱).

## Security model

- **RLS everywhere.** Customers can only read their own orders/order items
  and active products. Admins (checked via a `SECURITY DEFINER` helper) can
  read everything and manage products/order statuses.
- **No client-side writes.** All mutations go through Next.js server actions
  (`actions/`). Order creation goes through the `place_order` RPC — clients
  have no INSERT permission on `orders`/`order_items` at all.
- Prices are always taken from the database at checkout, never from the
  client.

## Setup

### 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com). In **Project
Settings → API**, note the project URL, `anon` key, and `service_role` key.

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (safe for the browser; RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only.** Used by the seed script. Never commit or expose it. |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Credentials for the seeded admin account |
| `SEED_CUSTOMER_EMAIL` / `SEED_CUSTOMER_PASSWORD` | Credentials for the seeded customer account |

### 3. Apply the database migration

Either with the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

…or open **SQL Editor** in the Supabase dashboard and run each migration in
[`supabase/migrations/`](supabase/migrations/) **in order** (0001, then 0002).

- `0001_init.sql` — `profiles`, `products`, `orders`, `order_items` tables,
  RLS policies, signup trigger, status-transition trigger, and the
  `place_order` checkout function.
- `0002_uoms_and_audit_logs.sql` — `product_uoms` (per-UOM pricing),
  UOM columns on `order_items`, the `audit_logs` table with logging
  triggers, and the UOM-aware `place_order` v2.

- `0003_account_security.sql` — syncs `profiles.email` when a user confirms
  an email change, and adds `log_account_event()` so users can record their
  own account events without `audit_logs` being writable by them.
- `0004_self_signup.sql` — captures the company name from the signup form,
  validates the requested role (falling back to `customer`), and logs new
  registrations to the audit trail.

`0002` and `0003` are idempotent: re-running them is safe and repairs a
partially applied state, so if a run fails partway (or you are unsure whether
it was applied) just paste and run the whole file again. Both end with
`notify pgrst, 'reload schema'` so Supabase's API layer picks up the new
tables immediately.

### 3b. Configure auth emails

The password-reset and email-verification links are sent by Supabase, so the
project needs to know where to send people back to. In the dashboard under
**Authentication → URL Configuration**:

- **Site URL** — your deployed URL (e.g. `https://your-app.vercel.app`).
- **Redirect URLs** — add `https://your-app.vercel.app/auth/confirm` and,
  for local development, `http://localhost:3000/auth/confirm`.

Also set `NEXT_PUBLIC_SITE_URL` in the app's environment so emailed links
point at the right host.

Two things worth knowing about Supabase's built-in email sender: it is
rate-limited to a handful of messages per hour and is meant for development
only, so configure your own SMTP provider under **Authentication → Emails →
SMTP Settings** before real users rely on password resets. And under
**Authentication → Sign In / Providers → Email**, the *Confirm email* toggle
decides whether a brand-new account must verify before it can sign in —
accounts created by the seed script are pre-confirmed either way.

### 4. Seed sample data

```bash
npm install
npm run seed
```

Creates ~10 sample products plus two confirmed accounts:

- **admin** — `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
- **customer** — `SEED_CUSTOMER_EMAIL` / `SEED_CUSTOMER_PASSWORD`

The script is idempotent — rerunning it upserts products by SKU and skips
existing users.

### 4b. Creating accounts by hand

Accounts can be provisioned directly, without the signup form and without
sending a confirmation email — useful for onboarding a customer manually,
creating the first admin, or working before SMTP is configured:

```bash
npm run create-user -- --email=buyer@corp.ph --password='secret123' \
                       --company='Corp Pharmacy' --role=admin
```

`--role` accepts `customer` (default) or `admin`. The account is created
pre-verified, so no email is involved. Re-running it for an address that
already exists resets that account's password and updates its company and
role, which also makes it the way back in if you are locked out.

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with either
seeded account.

## Deploying to Vercel

1. Push this repo to GitHub and import it into Vercel.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the
   Vercel project's environment variables. (`SUPABASE_SERVICE_ROLE_KEY` is
   only needed locally for seeding — don't add it unless you have a
   server-side use for it.)
3. Deploy. No further configuration is required.

## Project structure

```
actions/            Server actions (auth, checkout, admin mutations)
app/
  login/            Sign-in page
  signup/           Self-service registration (always creates a customer)
  forgot-password/  Request a password-reset email
  reset-password/   Set a new password from a recovery link
  auth/confirm/     Landing route for emailed verification/recovery links
  account/          Change password, change email, verification status
  products/         Customer catalog with search + cart panel + checkout
  cart/             Redirects to /products (cart lives there now)
  orders/           Customer order history + detail
  admin/            Admin overview, orders, product CRUD (role-guarded)
components/         UI components (cart provider, forms, tables, badges)
lib/
  supabase/         Browser/server/middleware Supabase clients
  auth.ts           Profile + role guards for server components
  types.ts          Shared domain types
scripts/seed.ts     Idempotent seed script (products + accounts)
scripts/create-user.ts  Provision/reset one account (bypasses signup email)
supabase/migrations/0001_init.sql   Schema, RLS, triggers, checkout RPC
middleware.ts       Session refresh + auth redirects
```

## Notes

- The low-stock threshold is `10` (see `LOW_STOCK_THRESHOLD` in
  `lib/types.ts`).
- Deleting a product that appears on an order deactivates it instead
  (foreign-key safe).
- **Signup always creates a customer.** The role is read from
  `app_metadata`, which the browser's anon key cannot write — only the
  service role (seed script, Supabase dashboard) can set it. Anything a
  visitor submits, including a `role` field smuggled into `user_metadata`,
  is ignored. Admins are promoted deliberately:

  ```sql
  update public.profiles set role = 'admin' where email = 'someone@example.com';
  ```

- **Turn on email confirmation before going live.** With self-signup open,
  Supabase's *Confirm email* toggle (Authentication → Sign In / Providers →
  Email) is what stops anyone registering with an address they don't own.
