-- Account security: keep profiles.email in sync when a user confirms an email
-- change, and let users record their own account events in the audit log.
-- Run after 0002. Idempotent — safe to re-run.

-- ---------------------------------------------------------------------------
-- Email changes are confirmed by clicking a link in the new inbox, which
-- updates auth.users directly. Mirror that onto profiles so the admin order
-- lists and audit log show the current address.
-- ---------------------------------------------------------------------------

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Account events (password changed, email change requested, verification
-- resent). audit_logs stays admin-insert-only at the RLS level; this
-- SECURITY DEFINER function is the one narrow door a regular user gets, and
-- it always stamps the caller's own id as the actor.
-- ---------------------------------------------------------------------------

create or replace function public.log_account_event(
  p_action  text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Whitelist: callers cannot forge arbitrary audit entries.
  if p_action not in (
    'account.password_changed',
    'account.email_change_requested',
    'account.verification_resent',
    'account.password_reset_requested',
    'account.password_reset_completed'
  ) then
    raise exception 'Unsupported account event: %', p_action;
  end if;

  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), p_action, 'account', auth.uid()::text, p_details);
end;
$$;

revoke all on function public.log_account_event(text, jsonb) from public, anon;
grant execute on function public.log_account_event(text, jsonb) to authenticated;

notify pgrst, 'reload schema';
