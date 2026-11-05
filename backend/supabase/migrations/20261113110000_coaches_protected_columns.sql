-- "Coaches update own row" lets a coach update every column of their coaches row from the API.
-- That included the columns the platform decides, not the coach:
--   subscription_status / trial_ends_at        -> coach_has_access() (skip the $29 plan)
--   stripe_customer_id / stripe_subscription_id -> coach-billing opens that customer's portal
--   is_verified                                 -> marketplace listing without vetting
--   status                                      -> admins hide (ban) a coach with status = 'hidden'
--   rating / total_reviews                      -> public profile and search
--   email, id, created_at
--
-- This trigger rejects changes to those columns on direct API writes (roles authenticated/anon)
-- unless the caller is an admin. It does not affect:
--   * SECURITY DEFINER functions (admin_*, prepare_account_deletion, ...): they run as the owner,
--   * edge functions using the service role (coach-billing),
--   * columns coaches edit themselves (profile fields, prices, pay mode, listed, deactivated_at).
-- On insert (self-serve coach sign-up) the same columns are reset to platform defaults.

create or replace function public.coaches_guard_protected_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only direct client writes through PostgREST. Definer functions run as their owner and the
  -- service role is trusted.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if auth.uid() is not null and public.has_role(auth.uid(), 'admin'::app_role) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.created_at := now();
    new.is_verified := false;
    new.subscription_status := null;
    new.stripe_customer_id := null;
    new.stripe_subscription_id := null;
    -- coaches_set_trial_ends_on_insert (fires after this one, by name) sets created_at + 30 days.
    new.trial_ends_at := null;
    new.rating := null;
    if coalesce(new.total_reviews, 0) <> 0 then
      new.total_reviews := 0;
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
    or new.created_at is distinct from old.created_at
    or new.email is distinct from old.email
    or new.is_verified is distinct from old.is_verified
    or new.status is distinct from old.status
    or new.rating is distinct from old.rating
    or new.total_reviews is distinct from old.total_reviews
    or new.subscription_status is distinct from old.subscription_status
    or new.trial_ends_at is distinct from old.trial_ends_at
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
  then
    raise exception 'These coach fields are managed by AthaNext and can''t be changed here.'
      using errcode = '42501', hint = 'protected_coach_columns';
  end if;
  return new;
end;
$$;

-- Named so it runs before coaches_set_trial_ends_on_insert (before triggers fire in name order).
drop trigger if exists coaches_guard_protected_columns on public.coaches;
create trigger coaches_guard_protected_columns
  before insert or update on public.coaches
  for each row execute function public.coaches_guard_protected_columns();
