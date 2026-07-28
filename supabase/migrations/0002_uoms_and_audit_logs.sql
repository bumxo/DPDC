-- Adds: multiple units of measure (UOM) per product with per-UOM pricing,
-- and an admin audit log. Run after 0001_init.sql.
--
-- This migration is idempotent — re-running it is safe and repairs a
-- partially applied state, so it can be pasted into the Supabase SQL editor
-- as many times as needed.

-- ---------------------------------------------------------------------------
-- Product UOMs
-- ---------------------------------------------------------------------------
-- Each product can be sold in several units (Piece, Blister, Box, Bottle…).
-- `units_per_uom` converts to base stock units: products.stock_qty is always
-- tracked in base units (e.g. one tablet), so a Box of 100 consumes 100.

create table if not exists public.product_uoms (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete cascade,
  uom           text not null,
  units_per_uom integer not null default 1 check (units_per_uom > 0),
  price         numeric(10, 2) not null check (price >= 0),
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (product_id, uom)
);

create index if not exists product_uoms_product_id_idx
  on public.product_uoms (product_id);

-- Backfill: every product without a UOM gets a base "Piece" at its unit_price.
insert into public.product_uoms (product_id, uom, units_per_uom, price, is_default)
select id, 'Piece', 1, unit_price, true
from public.products
on conflict (product_id, uom) do nothing;

-- New products automatically get a base UOM so the catalog always has a price.
create or replace function public.create_default_uom()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.product_uoms (product_id, uom, units_per_uom, price, is_default)
  values (new.id, 'Piece', 1, new.unit_price, true)
  on conflict (product_id, uom) do nothing;
  return new;
end;
$$;

drop trigger if exists products_create_default_uom on public.products;
create trigger products_create_default_uom
  after insert on public.products
  for each row execute function public.create_default_uom();

alter table public.product_uoms enable row level security;

drop policy if exists "product_uoms: read with product" on public.product_uoms;
create policy "product_uoms: read with product"
  on public.product_uoms for select
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and (p.is_active or public.is_admin())
    )
  );

drop policy if exists "product_uoms: admin insert" on public.product_uoms;
create policy "product_uoms: admin insert"
  on public.product_uoms for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "product_uoms: admin update" on public.product_uoms;
create policy "product_uoms: admin update"
  on public.product_uoms for update
  to authenticated
  using (public.is_admin());

drop policy if exists "product_uoms: admin delete" on public.product_uoms;
create policy "product_uoms: admin delete"
  on public.product_uoms for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Order items: record which UOM was purchased
-- ---------------------------------------------------------------------------

alter table public.order_items add column if not exists uom text not null default 'Piece';
alter table public.order_items add column if not exists units_per_uom integer not null default 1;

-- The same product can now appear on one order in different UOMs, so the
-- primary key gains the uom column. Only rewrite it if it is still the
-- original two-column key.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.order_items'::regclass
      and contype = 'p'
      and array_length(conkey, 1) = 2
  ) then
    alter table public.order_items drop constraint order_items_pkey;
    alter table public.order_items add primary key (order_id, product_id, uom);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------

create table if not exists public.audit_logs (
  id         bigint generated always as identity primary key,
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  text,
  details    jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs: admin read" on public.audit_logs;
create policy "audit_logs: admin read"
  on public.audit_logs for select
  to authenticated
  using (public.is_admin());

-- Server actions (e.g. the Excel import) write summary entries directly.
drop policy if exists "audit_logs: admin insert" on public.audit_logs;
create policy "audit_logs: admin insert"
  on public.audit_logs for insert
  to authenticated
  with check (public.is_admin());

-- Product changes are logged automatically by trigger (covers UI edits,
-- imports, and seed runs alike). actor_id is null for service-role writes.
create or replace function public.audit_products()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'product.created', 'product', new.id::text,
            jsonb_build_object('sku', new.sku, 'name', new.name,
                               'unit_price', new.unit_price, 'stock_qty', new.stock_qty));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'product.updated', 'product', new.id::text,
            jsonb_build_object('sku', new.sku, 'name', new.name,
                               'old', jsonb_build_object('unit_price', old.unit_price,
                                                         'stock_qty', old.stock_qty,
                                                         'is_active', old.is_active),
                               'new', jsonb_build_object('unit_price', new.unit_price,
                                                         'stock_qty', new.stock_qty,
                                                         'is_active', new.is_active)));
    return new;
  else
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'product.deleted', 'product', old.id::text,
            jsonb_build_object('sku', old.sku, 'name', old.name));
    return old;
  end if;
end;
$$;

drop trigger if exists products_audit on public.products;
create trigger products_audit
  after insert or update or delete on public.products
  for each row execute function public.audit_products();

-- Order lifecycle logging.
create or replace function public.audit_orders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'order.placed', 'order', new.id::text,
            jsonb_build_object('customer_id', new.customer_id, 'total', new.total));
  elsif new.status is distinct from old.status then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'order.status_changed', 'order', new.id::text,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;

drop trigger if exists orders_audit on public.orders;
create trigger orders_audit
  after insert or update on public.orders
  for each row execute function public.audit_orders();

-- ---------------------------------------------------------------------------
-- Checkout v2: items now specify a UOM
-- ---------------------------------------------------------------------------
-- Payload: [{ "product_id": uuid, "uom_id": uuid, "qty": int }, ...]
-- Stock is validated and decremented in base units (qty * units_per_uom).

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
  v_uom      public.product_uoms%rowtype;
  v_units    integer;
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
           (e ->> 'uom_id')::uuid     as uom_id,
           sum((e ->> 'qty')::int)    as qty
    from jsonb_array_elements(p_items) e
    group by 1, 2
  loop
    if v_item.qty is null or v_item.qty <= 0 then
      raise exception 'Invalid quantity';
    end if;

    select * into v_uom
    from public.product_uoms
    where id = v_item.uom_id and product_id = v_item.product_id;

    if not found then
      raise exception 'Invalid unit of measure';
    end if;

    -- Lock the product row so concurrent checkouts cannot oversell.
    select * into v_product
    from public.products
    where id = v_item.product_id and is_active
    for update;

    if not found then
      raise exception 'Product is not available';
    end if;

    v_units := v_item.qty * v_uom.units_per_uom;

    if v_product.stock_qty < v_units then
      raise exception 'Insufficient stock for "%" (% base units available, % requested)',
        v_product.name, v_product.stock_qty, v_units;
    end if;

    update public.products
    set stock_qty = stock_qty - v_units
    where id = v_product.id;

    insert into public.order_items (order_id, product_id, uom, units_per_uom, qty, unit_price)
    values (v_order_id, v_product.id, v_uom.uom, v_uom.units_per_uom, v_item.qty, v_uom.price);

    v_total := v_total + v_uom.price * v_item.qty;
  end loop;

  update public.orders set total = v_total where id = v_order_id;
  return v_order_id;
end;
$$;

revoke all on function public.place_order(jsonb) from public, anon;
grant execute on function public.place_order(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Cancellation stock restore must now use units_per_uom
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

  if new.status = 'cancelled' then
    -- Aggregate first: the same product can appear in multiple UOMs.
    update public.products p
    set stock_qty = p.stock_qty + s.units
    from (
      select product_id, sum(qty * units_per_uom) as units
      from public.order_items
      where order_id = new.id
      group by product_id
    ) s
    where s.product_id = p.id;
  end if;

  return new;
end;
$$;

-- Tell Supabase's API layer to pick up the new tables and relationships.
notify pgrst, 'reload schema';
