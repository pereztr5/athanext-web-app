-- Camps stability: settle/capacity correctness.
-- 1. camp_checkout_paid: do not re-activate superseded/expired regs (avoids charge-without-spot
--    when a family retries Checkout); only re-reserve lapsed pending_payment; set paid_at only
--    when at least one athlete got a spot; surface unique_violation instead of swallowing all.
-- 2. camp_taken: legacy package_purchases match Money-in (ignore revoked/granted/outside).
-- Safe to run more than once.

create or replace function public.camp_taken(p_camp_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (
    select count(*)::integer
    from public.camp_registrations as reg
    where reg.camp_id = p_camp_id
      and public.camp_reg_holds_spot(reg.status, reg.hold_expires_at)
  ) + (
    select count(*)::integer
    from public.package_purchases as purchase
    where purchase.package_id = p_camp_id
      and purchase.camp_signup_id is null
      and purchase.source = 'package'
      and purchase.status in ('active', 'expired', 'completed')
      and purchase.revoked_at is null
      and purchase.granted_by is null
      and purchase.outside is null
  );
$$;

create or replace function public.camp_checkout_paid(
  p_session_id text,
  p_payment_intent text,
  p_signup_id uuid,
  p_registration_ids uuid[],
  p_amount_total_cents integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_signup public.camp_signups%rowtype;
  v_camp public.coach_packages%rowtype;
  v_reg public.camp_registrations%rowtype;
  v_newly uuid[] := '{}';
  v_without uuid[] := '{}';
  v_paid_count integer;
  v_purchase uuid;
  v_created boolean := false;
begin
  if coalesce(btrim(p_session_id), '') = '' then
    raise exception 'Checkout session id is required' using errcode = '22023';
  end if;

  select * into v_signup from public.camp_signups
  where id = p_signup_id or stripe_session_id = p_session_id
  order by (id = p_signup_id) desc
  limit 1
  for update;
  if not found then
    return jsonb_build_object('found', false);
  end if;

  select * into v_camp from public.coach_packages where id = v_signup.camp_id for update;

  -- Record Stripe ids now; paid_at only after at least one athlete gets a spot.
  update public.camp_signups
    set stripe_session_id = coalesce(stripe_session_id, p_session_id),
        stripe_payment_intent = coalesce(nullif(p_payment_intent, ''), stripe_payment_intent),
        amount_total_cents = coalesce(p_amount_total_cents, amount_total_cents)
    where id = v_signup.id;

  for v_reg in
    select * from public.camp_registrations
    where signup_id = v_signup.id
      and pay_method = 'card'
      and (id = any (coalesce(p_registration_ids, '{}'::uuid[])) or stripe_session_id = p_session_id)
    order by id
    for update
  loop
    if v_reg.status = 'paid' then
      continue;
    end if;
    if v_reg.status = 'pending_payment' and v_reg.hold_expires_at > now() then
      update public.camp_registrations
        set status = 'paid', paid_at = now(), hold_expires_at = null, stripe_session_id = p_session_id
        where id = v_reg.id;
      v_newly := v_newly || v_reg.id;
      continue;
    end if;
    -- Hold lapsed but still pending_payment: try to take a spot again.
    -- status = expired means superseded Checkout or release_stale — never re-activate (refund by hand).
    if v_reg.status = 'pending_payment' and v_reg.group_id is not null then
      begin
        perform public.camp_reserve(v_camp.id, array[v_reg.group_id]);
        update public.camp_registrations
          set status = 'paid', paid_at = now(), hold_expires_at = null, stripe_session_id = p_session_id
          where id = v_reg.id;
        v_newly := v_newly || v_reg.id;
        continue;
      exception
        when unique_violation then
          null;
        when others then
          raise;
      end;
    end if;
    if v_reg.status = 'pending_payment' then
      update public.camp_registrations set status = 'expired' where id = v_reg.id;
    end if;
    v_without := v_without || v_reg.id;
  end loop;

  select count(*)::integer into v_paid_count
  from public.camp_registrations
  where signup_id = v_signup.id and status = 'paid' and stripe_session_id = p_session_id;

  if v_paid_count > 0 then
    update public.camp_signups
      set paid_at = coalesce(paid_at, now())
      where id = v_signup.id;
  end if;

  select id into v_purchase from public.package_purchases where stripe_session_id = p_session_id;
  if v_purchase is null and v_paid_count > 0 then
    insert into public.package_purchases (
      coach_id, package_id, user_id, source, sessions_total, sessions_remaining, status,
      purchase_date, expiry_date, total_amount, stripe_session_id, stripe_payment_intent,
      payment_intent_id, camp_signup_id
    ) values (
      v_camp.coach_id, v_camp.id, null, 'package', 1, 0, 'active',
      now(), coalesce((v_camp.camp_ends_on + 1)::timestamptz, now() + interval '1 year'),
      round(coalesce((
        select sum(reg.price_cents) from public.camp_registrations as reg
        where reg.signup_id = v_signup.id and reg.status = 'paid' and reg.stripe_session_id = p_session_id
      ), 0) / 100.0, 2), p_session_id, nullif(p_payment_intent, ''),
      nullif(p_payment_intent, ''), v_signup.id
    )
    on conflict do nothing
    returning id into v_purchase;
    if v_purchase is null then
      select id into v_purchase from public.package_purchases where stripe_session_id = p_session_id;
    else
      v_created := true;
    end if;
  end if;

  if v_purchase is not null then
    update public.camp_signups set purchase_id = v_purchase where id = v_signup.id and purchase_id is distinct from v_purchase;
    update public.camp_registrations
      set purchase_id = v_purchase
      where signup_id = v_signup.id and status = 'paid' and stripe_session_id = p_session_id
        and purchase_id is distinct from v_purchase;
  end if;

  return jsonb_build_object(
    'found', true,
    'signup_id', v_signup.id,
    'camp_id', v_camp.id,
    'paid_count', v_paid_count,
    'newly_paid', to_jsonb(v_newly),
    'without_spot', to_jsonb(v_without),
    'purchase_id', v_purchase,
    'purchase_created', v_created,
    'followup_done', (select followup_at is not null from public.camp_signups where id = v_signup.id)
  );
end;
$$;

revoke all on function public.camp_checkout_paid(text, text, uuid, uuid[], integer) from public, anon, authenticated;
grant execute on function public.camp_checkout_paid(text, text, uuid, uuid[], integer) to service_role;

-- Coach "Invite family" on a walk-in row without email: attach the email so claim/finish can match.
create or replace function public.set_camp_registration_parent_email(
  p_id uuid,
  p_email text,
  p_parent_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.camp_registrations%rowtype;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := nullif(btrim(coalesce(p_parent_name, '')), '');
begin
  if v_email = '' or char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Add a parent email' using errcode = '22023';
  end if;

  select * into v_reg from public.camp_registrations
  where id = p_id and coach_id = public.current_coach_id()
  for update;
  if not found then
    raise exception 'Registration not found' using errcode = 'P0002';
  end if;
  if v_reg.status in ('cancelled', 'expired') then
    raise exception 'This spot is no longer active' using errcode = '22023';
  end if;

  update public.camp_registrations
    set parent_email = v_email,
        parent_name = coalesce(v_name, parent_name)
    where id = v_reg.id;

  if v_reg.signup_id is not null then
    update public.camp_signups
      set parent_email = coalesce(nullif(btrim(parent_email), ''), v_email)
      where id = v_reg.signup_id and coach_id = v_reg.coach_id;
  end if;

  perform public.camp_link_client(
    v_reg.coach_id, v_email, coalesce(v_name, v_reg.parent_name), v_reg.athlete_first_name, null, v_reg.athlete_id
  );

  return jsonb_build_object(
    'id', v_reg.id,
    'parent_email', v_email,
    'parent_name', coalesce(v_name, v_reg.parent_name)
  );
end;
$$;

revoke all on function public.set_camp_registration_parent_email(uuid, text, text) from public, anon;
grant execute on function public.set_camp_registration_parent_email(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
