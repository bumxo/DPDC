-- Self-service signup: capture the company name from the signup form and log
-- new registrations. Run after 0003. Idempotent — safe to re-run.

-- ---------------------------------------------------------------------------
-- Replaces the signup trigger from 0001.
--
-- Role is read from app_metadata, which the anon/authenticated keys cannot
-- write — only the service role (the seed script, the Supabase dashboard) can
-- set it. A self-service signup can therefore never make itself an admin, no
-- matter what it puts in the form or in user_metadata. The value is also
-- validated so an unexpected one falls back to 'customer' instead of tripping
-- the profiles.role CHECK constraint and breaking signup entirely.
--
-- Company is read from user_metadata, which the signup form does supply.
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
  if v_role not in ('customer', 'admin') then
    v_role := 'customer';
  end if;

  v_company := nullif(trim(coalesce(new.raw_user_meta_data ->> 'company', '')), '');

  insert into public.profiles (id, email, role, company)
  values (new.id, new.email, v_role, v_company)
  on conflict (id) do nothing;

  -- Give admins visibility of new registrations. Guarded so this migration
  -- still works if 0002 (which creates audit_logs) has not been applied.
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
