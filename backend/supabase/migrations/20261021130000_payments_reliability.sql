-- Payments reliability (fix/payments-reliability).
--
-- 1. One Checkout can pay for several bookings, but coach_slot_bookings.stripe_session_id and
--    payments.stripe_session_id were UNIQUE, so saving the Checkout id on the second booking
--    (and the second payment row) failed. Both become plain indexes.
-- 2. Unpaid Checkouts held their spots forever. Rows a Checkout holds now carry
--    hold_expires_at (the Checkout's own expiry); release_unpaid_checkout_holds() cancels them
--    once it passes (webhook checkout.session.expired, or the 10 minute job below) and gives
--    back credits used in the same basket.
-- 3. Marking a Checkout paid is one transaction: mark_checkout_paid() flips the bookings and
--    writes the payment rows together and says which bookings were newly paid. Emails, payouts
--    and calendar events run after it and set paid_followup_at only once they succeed, so a
--    failed step is retried (Stripe webhook retry, the confirmation page, the next verify call).
-- 4. Credits redeemed for a Checkout that then failed to start are given back.
-- Idempotent: safe to run more than once.

-- ---------- 1. Several bookings per Checkout ----------
alter table public.coach_slot_bookings drop constraint if exists coach_slot_bookings_stripe_session_id_key;
create index if not exists coach_slot_bookings_stripe_session_id_idx
  on public.coach_slot_bookings (stripe_session_id) where stripe_session_id is not null;

alter table public.payments drop constraint if exists payments_stripe_session_id_key;
create index if not exists payments_stripe_session_id_idx
  on public.payments (stripe_session_id) where stripe_session_id is not null;

-- payments.booking_id already has payments_booking_unique (checked live: no duplicates).

-- ---------- 2/3. New booking columns ----------
alter table public.coach_slot_bookings add column if not exists hold_expires_at timestamptz;
alter table public.coach_slot_bookings add column if not exists paid_followup_at timestamptz;
alter table public.coach_slot_bookings add column if not exists paid_followup_claimed_at timestamptz;

comment on column public.coach_slot_bookings.hold_expires_at is
  'Set while an unpaid Stripe Checkout holds this spot (equals the Checkout expiry). Cleared when paid.';
comment on column public.coach_slot_bookings.paid_followup_at is
  'When the paid-booking emails, payout planning and calendar event finished. Null = still to do.';
comment on column public.coach_slot_bookings.paid_followup_claimed_at is
  'Lease so two callers (webhook, confirmation page) do not send the same emails at once.';

create index if not exists coach_slot_bookings_hold_expires_idx
  on public.coach_slot_bookings (hold_expires_at) where hold_expires_at is not null;

-- Bookings paid before this change already had their emails and payouts.
update public.coach_slot_bookings
  set paid_followup_at = coalesce(updated_at, now())
  where paid_followup_at is null and payment_status in ('paid', 'credit');

-- Unpaid in-app Checkouts started before this change used Stripe's default 24 hour expiry.
-- Rows that were never requests (no expires_at) and are not coach walk-ins get that deadline
-- so the job below releases them.
update public.coach_slot_bookings
  set hold_expires_at = created_at + interval '24 hours'
  where status = 'pending_payment'
    and payment_status = 'unpaid'
    and stripe_session_id is not null
    and hold_expires_at is null
    and expires_at is null
    and notes is distinct from 'Added by coach after arrival';

-- ---------- 3. Atomic paid marking ----------
-- p_booking_ids: bookings named in the Checkout metadata (a Checkout replaced by a newer one
-- still finds its bookings). Rows already pointing at the session are included too.
-- p_payments: payment rows computed by the function (fees per booking), as a JSON array.
-- Only bookings still waiting (pending_payment / unpaid, or an accepted request's card hold)
-- are marked; bookings paid by another Checkout or released are left alone.
-- Returns every booking this Checkout paid for (card or credit in the same basket).
create or replace function public.mark_checkout_paid(
  p_session_id text,
  p_payment_intent text,
  p_booking_ids uuid[],
  p_payments jsonb default '[]'::jsonb
)
returns table (paid_booking_id uuid, paid_with text, newly_paid boolean, followup_done boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_newly uuid[];
  v_credit uuid[];
begin
  if coalesce(btrim(p_session_id), '') = '' then
    raise exception 'Checkout session id is required' using errcode = '22023';
  end if;

  with marked as (
    update public.coach_slot_bookings as b
      set status = 'booked',
          payment_status = 'paid',
          stripe_session_id = p_session_id,
          stripe_payment_intent = coalesce(nullif(p_payment_intent, ''), b.stripe_payment_intent),
          hold_expires_at = null,
          updated_at = now()
      where (b.id = any (coalesce(p_booking_ids, '{}'::uuid[])) or b.stripe_session_id = p_session_id)
        and b.status in ('pending_payment', 'booked')
        and b.payment_status in ('unpaid', 'requires_action', 'authorized')
      returning b.id
  )
  select coalesce(array_agg(marked.id), '{}'::uuid[]) into v_newly from marked;

  -- Credits used in the same basket stop being a hold once the card part is paid.
  with kept as (
    update public.coach_slot_bookings as b
      set hold_expires_at = null, updated_at = now()
      where b.stripe_session_id = p_session_id
        and b.payment_status = 'credit'
        and b.status = 'booked'
        and b.hold_expires_at is not null
      returning b.id
  )
  select coalesce(array_agg(kept.id), '{}'::uuid[]) into v_credit from kept;

  if coalesce(nullif(p_payment_intent, ''), '') <> '' then
    update public.coach_slot_bookings as b
      set stripe_payment_intent = p_payment_intent
      where b.stripe_session_id = p_session_id
        and b.payment_status = 'paid'
        and b.stripe_payment_intent is distinct from p_payment_intent;
  end if;

  insert into public.payments as p (
    booking_id, slot_id, coach_offer_amount, platform_fee_amount, stripe_price_amount,
    total_amount, currency, type, stripe_session_id, stripe_payment_intent
  )
  select r.booking_id, r.slot_id, coalesce(r.coach_offer_amount, 0), coalesce(r.platform_fee_amount, 0),
         coalesce(r.stripe_price_amount, 0), r.total_amount, coalesce(r.currency, 'USD'),
         coalesce(r.type, 'booking_credit'), p_session_id, nullif(p_payment_intent, '')
  from jsonb_to_recordset(coalesce(p_payments, '[]'::jsonb)) as r(
    booking_id uuid, slot_id uuid, coach_offer_amount numeric, platform_fee_amount numeric,
    stripe_price_amount numeric, total_amount numeric, currency text, type text
  )
  join public.coach_slot_bookings as b
    on b.id = r.booking_id and b.stripe_session_id = p_session_id and b.payment_status = 'paid'
  on conflict on constraint payments_booking_unique do update
    set slot_id = excluded.slot_id,
        coach_offer_amount = excluded.coach_offer_amount,
        platform_fee_amount = excluded.platform_fee_amount,
        stripe_price_amount = excluded.stripe_price_amount,
        total_amount = excluded.total_amount,
        currency = excluded.currency,
        type = excluded.type,
        stripe_session_id = excluded.stripe_session_id,
        stripe_payment_intent = coalesce(excluded.stripe_payment_intent, p.stripe_payment_intent);

  return query
    select b.id, b.payment_status, (b.id = any (v_newly) or b.id = any (v_credit)), b.paid_followup_at is not null
    from public.coach_slot_bookings as b
    where b.stripe_session_id = p_session_id
      and b.status <> 'canceled'
      and (b.payment_status = 'paid' or (b.payment_status = 'credit' and b.hold_expires_at is null));
end;
$$;

revoke all on function public.mark_checkout_paid(text, text, uuid[], jsonb) from public, anon, authenticated;
grant execute on function public.mark_checkout_paid(text, text, uuid[], jsonb) to service_role;

-- ---------- 2/4. Giving back held spots and credits ----------
-- Credit bookings: the credit goes back to its package, then the booking is cancelled
-- (p_delete = false) or removed (p_delete = true, the Checkout never started).
create or replace function public.undo_checkout_credits(p_booking_ids uuid[], p_reason text default null, p_delete boolean default false)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_n integer := 0;
begin
  for v_row in
    select b.id, b.credit_purchase_id
    from public.coach_slot_bookings as b
    where b.id = any (coalesce(p_booking_ids, '{}'::uuid[]))
      and b.payment_status = 'credit'
      and b.status = 'booked'
    for update of b
  loop
    if v_row.credit_purchase_id is not null then
      update public.package_purchases
        set sessions_remaining = least(sessions_total, sessions_remaining + 1), updated_at = now()
        where id = v_row.credit_purchase_id;
    end if;
    if p_delete then
      delete from public.coach_slot_bookings where id = v_row.id;
    else
      update public.coach_slot_bookings
        set status = 'canceled', canceled_at = now(), hold_expires_at = null, updated_at = now(),
            cancellation_reason = coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Payment not completed')
        where id = v_row.id;
      perform public.void_booking_transfers(v_row.id);
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke all on function public.undo_checkout_credits(uuid[], text, boolean) from public, anon, authenticated;
grant execute on function public.undo_checkout_credits(uuid[], text, boolean) to service_role;

-- Releases spots held by unpaid Checkouts.
--   p_session_id null : every hold more than 15 minutes past its expiry (the job below).
--   p_session_id set  : that Checkout's holds once due (checkout.session.expired), or right away
--                       with p_force (the family started a new Checkout instead).
-- A hold the family has since moved to a newer Checkout has a later hold_expires_at, so a late
-- expired event for the old Checkout leaves it alone.
create or replace function public.release_unpaid_checkout_holds(p_session_id text default null, p_force boolean default false)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending uuid[];
  v_credit uuid[];
  v_n integer := 0;
begin
  select
    coalesce(array_agg(b.id) filter (where b.status = 'pending_payment'), '{}'::uuid[]),
    coalesce(array_agg(b.id) filter (where b.status = 'booked' and b.payment_status = 'credit'), '{}'::uuid[])
  into v_pending, v_credit
  from public.coach_slot_bookings as b
  where b.hold_expires_at is not null
    and (
      (b.status = 'pending_payment' and b.payment_status in ('unpaid', 'requires_action'))
      or (b.status = 'booked' and b.payment_status = 'credit')
    )
    and case
      when p_session_id is null then b.hold_expires_at < now() - interval '15 minutes'
      else b.stripe_session_id = p_session_id and (p_force or b.hold_expires_at <= now() + interval '2 minutes')
    end;

  update public.coach_slot_bookings
    set status = 'canceled', canceled_at = now(), hold_expires_at = null, updated_at = now(),
        cancellation_reason = 'Payment not completed'
    where id = any (v_pending);
  get diagnostics v_n = row_count;

  v_n := v_n + public.undo_checkout_credits(v_credit, 'Payment not completed', false);
  return v_n;
end;
$$;

revoke all on function public.release_unpaid_checkout_holds(text, boolean) from public, anon, authenticated;
grant execute on function public.release_unpaid_checkout_holds(text, boolean) to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'release-unpaid-checkouts';
select cron.schedule('release-unpaid-checkouts', '*/10 * * * *', $$select public.release_unpaid_checkout_holds()$$);
