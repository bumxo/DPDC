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

…or open **SQL Editor** in the Supabase dashboard and run the contents of
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).

This creates the `profiles`, `products`, `orders`, and `order_items` tables,
all RLS policies, the signup trigger, the status-transition trigger, and the
`place_order` checkout function.

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
supabase/migrations/0001_init.sql   Schema, RLS, triggers, checkout RPC
middleware.ts       Session refresh + auth redirects
```

## Notes

- The low-stock threshold is `10` (see `LOW_STOCK_THRESHOLD` in
  `lib/types.ts`).
- Deleting a product that appears on an order deactivates it instead
  (foreign-key safe).
- There is no self-serve signup page by design — B2B accounts are
  provisioned by an admin (via the Supabase dashboard or the seed script's
  approach with `app_metadata.role`).
