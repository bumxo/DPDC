-- B2B ordering system: schema, RLS, and checkout RPC
-- Apply with `supabase db push` or paste into the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  role       text not null default 'customer' check (role in ('customer', 'admin')),
  company    text,
  created_at timestamptz not null default now()
);

create table public.products (
  id          uuid primary key default gen_random_uuid(),
  sku         text not null unique,
  name        text not null,
  description text,
  unit_price  numeric(10, 2) not null check (unit_price >= 0),
  stock_qty   integer not null default 0 check (stock_qty >= 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.orders (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id),
  status      text not null default 'pending'
              check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  total       numeric(12, 2) not null default 0 check (total >= 0),
  created_at  timestamptz not null default now()
);

create table public.order_items (
  order_id   uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id),
  qty        integer not null check (qty > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  primary key (order_id, product_id)
);

create index orders_customer_id_idx on public.orders (customer_id);
create index order_items_product_id_idx on public.order_items (product_id);
create index products_name_idx on public.products (name);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER so policies can check the caller's role without
-- recursing into the profiles RLS policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- Auto-create a profile whenever an auth user is created. The role can be
-- preset via app_metadata.role (used by the seed script for the admin user).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_app_meta_data ->> 'role', 'customer')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Order status transitions (and stock restore on cancellation)
-- ---------------------------------------------------------------------------

create or replace function public.validate_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'pending'   and new.status in ('confirmed', 'cancelled')) or
    (old.status = 'confirmed' and new.status in ('shipped', 'cancelled')) or
    (old.status = 'shipped'   and new.status = 'delivered')
  ) then
    raise exception 'Invalid status transition: % -> %', old.status, new.status;
  end if;

  -- Return reserved stock when an order is cancelled.
  if new.status = 'cancelled' then
    update public.products p
    set stock_qty = p.stock_qty + oi.qty
    from public.order_items oi
    where oi.order_id = new.id and oi.product_id = p.id;
  end if;

  return new;
end;
$$;

create trigger orders_validate_status_change
  before update of status on public.orders
  for each row execute function public.validate_order_status_change();

-- ---------------------------------------------------------------------------
-- Checkout RPC: validates stock, decrements it, and creates the order
-- atomically. Runs as SECURITY DEFINER so customers never need write access
-- to products/orders/order_items directly.
-- ---------------------------------------------------------------------------

create or replace function public.place_order(p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid := auth.uid();
  v_order_id uuid;
  v_total    numeric(12, 2) := 0;
  v_item     record;
  v_product  public.products%rowtype;
begin
  if v_customer is null then
    raise exception 'Not authenticated';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  insert into public.orders (customer_id, status, total)
  values (v_customer, 'pending', 0)
  returning id into v_order_id;

  for v_item in
    select (e ->> 'product_id')::uuid as product_id,
           sum((e ->> 'qty')::int)    as qty
    from jsonb_array_elements(p_items) e
    group by 1
  loop
    if v_item.qty is null or v_item.qty <= 0 then
      raise exception 'Invalid quantity';
    end if;

    -- Lock the product row so concurrent checkouts cannot oversell.
    select * into v_product
    from public.products
    where id = v_item.product_id and is_active
    for update;

    if not found then
      raise exception 'Product is not available';
    end if;

    if v_product.stock_qty < v_item.qty then
      raise exception 'Insufficient stock for "%" (available: %)',
        v_product.name, v_product.stock_qty;
    end if;

    update public.products
    set stock_qty = stock_qty - v_item.qty
    where id = v_product.id;

    insert into public.order_items (order_id, product_id, qty, unit_price)
    values (v_order_id, v_product.id, v_item.qty, v_product.unit_price);

    v_total := v_total + v_product.unit_price * v_item.qty;
  end loop;

  update public.orders set total = v_total where id = v_order_id;
  return v_order_id;
end;
$$;

revoke all on function public.place_order(jsonb) from public, anon;
grant execute on function public.place_order(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles    enable row level security;
alter table public.products    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- profiles: users read their own row; admins read all. No client writes —
-- rows are created by the auth trigger.
create policy "profiles: read own or admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

-- products: customers see active products; admins see and manage everything.
create policy "products: read active or admin"
  on public.products for select
  to authenticated
  using (is_active or public.is_admin());

create policy "products: admin insert"
  on public.products for insert
  to authenticated
  with check (public.is_admin());

create policy "products: admin update"
  on public.products for update
  to authenticated
  using (public.is_admin());

create policy "products: admin delete"
  on public.products for delete
  to authenticated
  using (public.is_admin());

-- orders: customers see their own; admins see all and update status.
-- Inserts happen only through place_order() (SECURITY DEFINER).
create policy "orders: read own or admin"
  on public.orders for select
  to authenticated
  using (customer_id = auth.uid() or public.is_admin());

create policy "orders: admin update"
  on public.orders for update
  to authenticated
  using (public.is_admin());

-- order_items: visible when the parent order is visible.
create policy "order_items: read via order"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.customer_id = auth.uid() or public.is_admin())
    )
  );
