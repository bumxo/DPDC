-- Adds a third role, `superuser`: an admin that additionally may delete
-- accounts, and that cannot itself be deleted. Run after 0004.
-- Idempotent — safe to re-run.

-- ---------------------------------------------------------------------------
-- Role vocabulary
-- ---------------------------------------------------------------------------

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('customer', 'admin', 'superuser'));

-- ---------------------------------------------------------------------------
-- A superuser is an admin plus deletion rights, so every existing policy that
-- calls is_admin() must treat it as an admin. Replacing the function updates
-- all of them at once.
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'superuser')
  );
$$;

create or replace function public.is_superuser()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'superuser'
  );
$$;

-- ---------------------------------------------------------------------------
-- Deleting an auth user cascades to profiles, so blocking the cascade here
-- blocks the deletion itself — including via the admin API and the Supabase
-- dashboard. This is the guarantee behind "cannot be deleted"; the app-level
-- check is only the friendly first line.
--
-- Escape hatch, should a superuser ever genuinely need removing:
--   update public.profiles set role = 'admin' where email = '...';
-- then delete the account normally.
-- ---------------------------------------------------------------------------

create or replace function public.protect_superuser_delete()
returns trigger
language plpgsql
as $$
begin
  if old.role = 'superuser' then
    raise exception
      'Superuser accounts cannot be deleted. Change the role to admin first if this is intended.';
  end if;
  return old;
end;
$$;

drop trigger if exists profiles_protect_superuser_delete on public.profiles;
create trigger profiles_protect_superuser_delete
  before delete on public.profiles
  for each row execute function public.protect_superuser_delete();

-- ---------------------------------------------------------------------------
-- Signup trigger: accept superuser as a valid app_metadata role. Still
-- unreachable from the browser — app_metadata is service-role only — so
-- self-signup remains customer-only.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role    text;
  v_company text;
begin
  v_role := coalesce(new.raw_app_meta_data ->> 'role', 'customer');
  if v_role not in ('customer', 'admin', 'superuser') then
    v_role := 'customer';
  end if;

  v_company := nullif(trim(coalesce(new.raw_user_meta_data ->> 'company', '')), '');

  insert into public.profiles (id, email, role, company)
  values (new.id, new.email, v_role, v_company)
  on conflict (id) do nothing;

  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (new.id, 'account.signed_up', 'account', new.id::text,
            jsonb_build_object('email', new.email, 'role', v_role, 'company', v_company));
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

notify pgrst, 'reload schema';
