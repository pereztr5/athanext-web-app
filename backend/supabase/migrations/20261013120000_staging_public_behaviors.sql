-- Staging public behaviors: hold coach payouts until the session sticks, honor cancel
-- notice hours, tighten coach billing locks, and wipe more PII on account deletion.

-- ---------- Payout hold statuses ----------
alter table public.payout_transfers drop constraint if exists payout_transfers_status_check;
alter table public.payout_transfers
  add constraint payout_transfers_status_check
  check (status in ('waiting', 'sent', 'failed', 'held', 'void', 'reversing'));

comment on column public.payout_transfers.status is
  'held = paid but session not done; waiting = ready to send; sent; failed; void = cancelled credit; reversing = Stripe reverse pending';

-- Existing unsent booking shares whose session has not ended yet stay held.
update public.payout_transfers t
set status = 'held'
from public.coach_slot_bookings b
join public.coach_availability_slot_occurrences occ on occ.id = b.occurrence_id
where t.booking_id = b.id
  and t.status in ('waiting', 'failed')
  and b.payment_status = 'paid'
  and b.status in ('booked', 'pending_payment')
  and public.eastern_timestamp(occ.occurrence_date, occ.end_time) > now();

-- Bookings may be disputed after a Stripe chargeback.
alter table public.coach_slot_bookings drop constraint if exists bookings_v3_payment_status;
alter table public.coach_slot_bookings
  add constraint bookings_v3_payment_status
  check (payment_status = any (array[
    'unpaid', 'requires_action', 'paid', 'refunded', 'direct', 'pending_offline', 'credit',
    'authorized', 'released', 'outside', 'disputed'
  ]));

-- Plan booking shares as held until the session ends (or a late cancel releases them).
create or replace function public.plan_booking_transfers(p_booking_id uuid)
returns setof public.payout_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.coach_slot_bookings%rowtype;
  v_price numeric;
  v_member public.organization_coaches%rowtype;
  v_owner uuid;
  v_rate numeric;
  v_org_amount numeric := 0;
begin
  select * into v_booking from public.coach_slot_bookings where id = p_booking_id;
  if not found then
    return;
  end if;

  -- Card-paid sessions, or a cancel-credit make-up (coach is paid when that session sticks).
  if v_booking.payment_status = 'paid' then
    null;
  elsif v_booking.payment_status = 'credit'
    and exists (
      select 1 from public.package_purchases p
      where p.id = v_booking.credit_purchase_id and p.source = 'cancel_credit'
    ) then
    null;
  else
    return;
  end if;

  select coalesce(p.coach_offer_amount, occ.price) into v_price
  from public.coach_availability_slot_occurrences occ
  left join public.payments p on p.booking_id = v_booking.id
  where occ.id = v_booking.occurrence_id;
  if coalesce(v_price, 0) <= 0 then
    return;
  end if;

  select * into v_member from public.organization_coaches
  where coach_id = v_booking.coach_id and rate is not null and joined_at <= v_booking.created_at;
  if found then
    select owner_coach_id into v_owner from public.organizations where id = v_member.organization_id;
    select h.rate into v_rate from public.organization_rate_history h
    where h.organization_id = v_member.organization_id and h.coach_id = v_booking.coach_id
      and h.effective_from <= v_booking.created_at
    order by h.effective_from desc limit 1;
    v_org_amount := round(v_price * coalesce(v_rate, v_member.rate) / 100, 2);
  end if;

  insert into public.payout_transfers (booking_id, kind, coach_id, amount, status)
  values (v_booking.id, 'coach', v_booking.coach_id, v_price - v_org_amount, 'held')
  on conflict (booking_id, kind) do nothing;
  if v_org_amount > 0 then
    insert into public.payout_transfers (booking_id, kind, coach_id, organization_id, amount, status)
    values (v_booking.id, 'org', v_owner, v_member.organization_id, v_org_amount, 'held')
    on conflict (booking_id, kind) do nothing;
  end if;

  return query select * from public.payout_transfers where booking_id = v_booking.id;
end;
$$;

revoke all on function public.plan_booking_transfers(uuid) from public, anon, authenticated;
grant execute on function public.plan_booking_transfers(uuid) to service_role;

-- Void held/waiting shares; mark already-sent ones for Stripe reversal.
create or replace function public.void_booking_transfers(p_booking_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer := 0;
begin
  update public.payout_transfers
    set status = 'void', error = null
    where booking_id = p_booking_id and status in ('held', 'waiting', 'failed');
  get diagnostics v_n = row_count;

  update public.payout_transfers
    set status = 'reversing', error = null
    where booking_id = p_booking_id and status = 'sent' and stripe_transfer_id is not null;

  return v_n + (
    select count(*)::integer from public.payout_transfers
    where booking_id = p_booking_id and status = 'reversing'
  );
end;
$$;

revoke all on function public.void_booking_transfers(uuid) from public, anon, authenticated;
grant execute on function public.void_booking_transfers(uuid) to authenticated, service_role;

-- Late cancel or session done: held shares become sendable.
create or replace function public.release_booking_transfers(p_booking_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer := 0;
begin
  update public.payout_transfers
    set status = 'waiting', error = null
    where booking_id = p_booking_id and status = 'held';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.release_booking_transfers(uuid) from public, anon, authenticated;
grant execute on function public.release_booking_transfers(uuid) to authenticated, service_role;

-- Hourly: plan cancel-credit make-ups that finished, then release held shares for ended sessions.
create or replace function public.release_held_booking_transfers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_n integer := 0;
  v_row integer;
begin
  for v_id in
    select b.id
    from public.coach_slot_bookings b
    join public.coach_availability_slot_occurrences occ on occ.id = b.occurrence_id
    join public.package_purchases p on p.id = b.credit_purchase_id and p.source = 'cancel_credit'
    where b.payment_status = 'credit'
      and b.status in ('booked', 'completed', 'no_show')
      and public.eastern_timestamp(occ.occurrence_date, occ.end_time) <= now()
      and not exists (select 1 from public.payout_transfers t where t.booking_id = b.id)
    limit 500
  loop
    perform public.plan_booking_transfers(v_id);
  end loop;

  for v_id in
    select distinct t.booking_id
    from public.payout_transfers t
    join public.coach_slot_bookings b on b.id = t.booking_id
    join public.coach_availability_slot_occurrences occ on occ.id = b.occurrence_id
    where t.status = 'held'
      and t.booking_id is not null
      and b.status in ('booked', 'completed', 'no_show')
      and b.payment_status in ('paid', 'credit')
      and public.eastern_timestamp(occ.occurrence_date, occ.end_time) <= now()
    limit 500
  loop
    select public.release_booking_transfers(v_id) into v_row;
    v_n := v_n + coalesce(v_row, 0);
  end loop;
  return v_n;
end;
$$;

revoke all on function public.release_held_booking_transfers() from public, anon, authenticated;
grant execute on function public.release_held_booking_transfers() to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'release-held-booking-transfers';
select cron.schedule('release-held-booking-transfers', '17 * * * *', $$select public.release_held_booking_transfers()$$);

-- ---------- Cancels: honor notice hours; void or release shares ----------
create or replace function public.cancel_my_booking(p_booking_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.coach_slot_bookings%rowtype;
  v_starts timestamptz;
  v_user uuid;
  v_credit boolean := false;
  v_notice integer;
begin
  select b.* into v_booking
  from public.coach_slot_bookings b
  join public.athlete_profiles a on a.id = b.athlete_id
  where b.id = p_booking_id and (a.user_id = auth.uid() or b.created_by = auth.uid())
  for update of b;
  if not found then
    raise exception 'Booking not found' using errcode = '42501';
  end if;
  if v_booking.status not in ('booked', 'pending_payment', 'requested') then
    raise exception 'This session can no longer be cancelled' using errcode = '22023';
  end if;
  select public.eastern_timestamp(occ.occurrence_date, occ.start_time) into v_starts
  from public.coach_availability_slot_occurrences occ where occ.id = v_booking.occurrence_id;
  if v_starts <= now() then
    raise exception 'This session has already started' using errcode = '22023';
  end if;

  select coalesce(c.cancel_notice_hours, 24) into v_notice
  from public.coaches c where c.id = v_booking.coach_id;
  v_notice := greatest(1, least(coalesce(v_notice, 24), 168));

  if v_booking.status = 'booked' and v_booking.payment_status in ('paid', 'credit')
     and v_starts - now() >= make_interval(hours => v_notice) then
    select user_id into v_user from public.athlete_profiles where id = v_booking.athlete_id;
    if v_booking.payment_status = 'credit' and exists (
      select 1 from public.package_purchases
      where id = v_booking.credit_purchase_id and status = 'active' and (expiry_date is null or expiry_date > now())
    ) then
      update public.package_purchases set sessions_remaining = least(sessions_total, sessions_remaining + 1), updated_at = now()
      where id = v_booking.credit_purchase_id;
    else
      insert into public.package_purchases (
        coach_id, user_id, package_id, source, source_booking_id, sessions_total, sessions_remaining,
        status, purchase_date, expiry_date, total_amount
      ) values (
        v_booking.coach_id, v_user, null, 'cancel_credit', v_booking.id, 1, 1,
        'active', now(), now() + interval '90 days', 0
      );
    end if;
    v_credit := true;
    perform public.void_booking_transfers(v_booking.id);
  elsif v_booking.status = 'booked' and v_booking.payment_status in ('paid', 'credit') then
    -- Late cancel: family keeps the charge; coach is still paid once the hold releases.
    perform public.release_booking_transfers(v_booking.id);
  else
    perform public.void_booking_transfers(v_booking.id);
  end if;

  update public.coach_slot_bookings
  set status = 'canceled', canceled_at = now(), updated_at = now(),
      cancellation_reason = coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Cancelled by the family')
  where id = p_booking_id;
  return jsonb_build_object('credit', v_credit);
end;
$$;

revoke all on function public.cancel_my_booking(uuid, text) from public, anon;
grant execute on function public.cancel_my_booking(uuid, text) to authenticated;

create or replace function public.coach_cancel_session(p_occurrence_id uuid, p_reason text, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_occ public.coach_availability_slot_occurrences;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_booking public.coach_slot_bookings%rowtype;
  v_user uuid;
  v_credits integer := 0;
  v_returned integer := 0;
  v_sent integer;
  v_when text;
begin
  perform public.require_coach_billing_access();
  if v_reason is null then
    raise exception 'Choose a reason' using errcode = '22023';
  end if;
  select * into v_occ from public.coach_availability_slot_occurrences
  where id = p_occurrence_id and coach_id = v_coach and is_enabled
  for update;
  if v_occ.id is null then
    raise exception 'Session not found' using errcode = '42501';
  end if;
  if public.eastern_timestamp(v_occ.occurrence_date, v_occ.end_time) <= now() then
    raise exception 'This session has already ended' using errcode = '22023';
  end if;

  v_when := to_char(v_occ.occurrence_date, 'Dy, Mon FMDD') || ' at ' || to_char(v_occ.start_time, 'FMHH12:MI am');
  v_sent := public.message_session_families(
    v_occ.id,
    coalesce(
      nullif(btrim(coalesce(p_message, '')), ''),
      'I had to cancel our session on ' || v_when || ' (' || v_reason || '). If it was paid, it comes back as a session credit with me.'
    )
  );

  for v_booking in
    select * from public.coach_slot_bookings
    where occurrence_id = v_occ.id and status in ('requested', 'pending_payment', 'booked')
    for update
  loop
    if v_booking.status = 'booked' and v_booking.payment_status in ('paid', 'credit') then
      if v_booking.payment_status = 'credit' and exists (
        select 1 from public.package_purchases
        where id = v_booking.credit_purchase_id and status = 'active' and (expiry_date is null or expiry_date > now())
      ) then
        update public.package_purchases set sessions_remaining = least(sessions_total, sessions_remaining + 1), updated_at = now()
        where id = v_booking.credit_purchase_id;
        v_returned := v_returned + 1;
      else
        select user_id into v_user from public.athlete_profiles where id = v_booking.athlete_id;
        insert into public.package_purchases (
          coach_id, user_id, package_id, source, source_booking_id, sessions_total, sessions_remaining,
          status, purchase_date, expiry_date, total_amount
        ) values (
          v_coach, v_user, null, 'cancel_credit', v_booking.id, 1, 1,
          'active', now(), now() + interval '90 days', 0
        );
      end if;
      v_credits := v_credits + 1;
      perform public.void_booking_transfers(v_booking.id);
    else
      perform public.void_booking_transfers(v_booking.id);
    end if;
    update public.coach_slot_bookings
      set status = 'canceled', canceled_at = now(), updated_at = now(),
          cancellation_reason = 'Cancelled by coach. ' || v_reason
      where id = v_booking.id;
  end loop;

  update public.coach_availability_slot_occurrences
    set is_enabled = false, disabled_reason = 'removed', canceled_at = now(), cancel_reason = v_reason,
        cancel_refund = case
          when v_credits = 0 then 'Nothing was charged'
          when v_occ.session_type = 'group' then case when v_credits = 1 then 'The family who paid got a session credit' else 'Each family who paid got a session credit' end
          when v_returned > 0 then 'The package credit went back'
          else 'The family got a session credit'
        end
    where id = v_occ.id;
  return jsonb_build_object('sent', v_sent, 'credits', v_credits);
end;
$$;

revoke all on function public.coach_cancel_session(uuid, text, text) from public, anon;
grant execute on function public.coach_cancel_session(uuid, text, text) to authenticated;

-- Stripe refund / dispute: update payment status and void or reverse shares.
create or replace function public.mark_booking_charge_reversed(p_booking_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('refunded', 'disputed') then
    raise exception 'Unknown reverse status' using errcode = '22023';
  end if;
  update public.coach_slot_bookings
    set payment_status = p_status, updated_at = now()
    where id = p_booking_id and payment_status in ('paid', 'disputed', 'refunded');
  perform public.void_booking_transfers(p_booking_id);
end;
$$;

revoke all on function public.mark_booking_charge_reversed(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_booking_charge_reversed(uuid, text) to service_role;

-- Pending Stripe reversals for the payouts function.
create or replace function public.list_reversing_transfers(p_limit integer default 50)
returns setof public.payout_transfers
language sql
security definer
set search_path = public
as $$
  select * from public.payout_transfers
  where status = 'reversing' and stripe_transfer_id is not null
  order by created_at
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

revoke all on function public.list_reversing_transfers(integer) from public, anon, authenticated;
grant execute on function public.list_reversing_transfers(integer) to service_role;

-- ---------- $29 lock on invoice create + key coach writes ----------
create or replace function public.create_coach_invoice(
  p_athlete_id uuid, p_service text, p_amount numeric, p_due date, p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_id uuid;
begin
  if v_coach is null then
    raise exception 'Only coaches can send invoices' using errcode = '42501';
  end if;
  perform public.require_coach_billing_access();
  if not public.is_own_client(v_coach, p_athlete_id) then
    raise exception 'Only families you brought to AthaNext can be invoiced. Marketplace families pay in the app.' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 10000 then
    raise exception 'Enter an amount' using errcode = '22023';
  end if;
  if p_due is null then
    raise exception 'Pick a due date' using errcode = '22023';
  end if;
  insert into public.coach_invoices (coach_id, athlete_id, family_name, athlete_name, service, amount, due_date, note)
  select v_coach, a.id, coalesce(up.name, a.full_name, ''), coalesce(a.full_name, ''), left(btrim(p_service), 120),
         round(p_amount, 2), p_due, nullif(left(btrim(coalesce(p_note, '')), 500), '')
  from public.athlete_profiles a left join public.user_profiles up on up.id = a.user_id
  where a.id = p_athlete_id
  returning id into v_id;
  return v_id;
end;
$$;

-- Guard helpers used by RLS: coach owns the row and still has product access.
create or replace function public.coach_owns_and_has_access(p_coach_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_coach_id is not null
    and p_coach_id = public.current_coach_id()
    and public.coach_has_access(p_coach_id);
$$;

revoke all on function public.coach_owns_and_has_access(uuid) from public, anon;
grant execute on function public.coach_owns_and_has_access(uuid) to authenticated;

-- Replace open write policies on booking / availability tables.
-- Reads stay open for the owning coach (lock screen / Settings still load).
-- Writes require an active trial or $29 subscription.
drop policy if exists "All" on public.coach_slot_bookings;
create policy "Coaches read own bookings"
  on public.coach_slot_bookings for select to authenticated
  using (
    coach_id = public.current_coach_id()
    or athlete_id in (select athlete_id from public.user_profiles where id = auth.uid())
    or created_by = auth.uid()
    or public.has_role(auth.uid(), 'admin'::app_role)
  );
create policy "Coaches write own bookings when subscribed"
  on public.coach_slot_bookings for insert to authenticated
  with check (public.coach_owns_and_has_access(coach_id) or public.has_role(auth.uid(), 'admin'::app_role));
create policy "Coaches update own bookings when subscribed"
  on public.coach_slot_bookings for update to authenticated
  using (public.coach_owns_and_has_access(coach_id) or public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.coach_owns_and_has_access(coach_id) or public.has_role(auth.uid(), 'admin'::app_role));
create policy "Coaches delete own bookings when subscribed"
  on public.coach_slot_bookings for delete to authenticated
  using (public.coach_owns_and_has_access(coach_id) or public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "All" on public.coach_availability_slot_occurrences;
create policy "Read occurrences"
  on public.coach_availability_slot_occurrences for select to anon, authenticated
  using (
    is_enabled
    or coach_id = public.current_coach_id()
    or public.has_role(auth.uid(), 'admin'::app_role)
  );
create policy "Coaches write own occurrences when subscribed"
  on public.coach_availability_slot_occurrences for insert to authenticated
  with check (public.coach_owns_and_has_access(coach_id) or public.has_role(auth.uid(), 'admin'::app_role));
create policy "Coaches update own occurrences when subscribed"
  on public.coach_availability_slot_occurrences for update to authenticated
  using (public.coach_owns_and_has_access(coach_id) or public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.coach_owns_and_has_access(coach_id) or public.has_role(auth.uid(), 'admin'::app_role));
create policy "Coaches delete own occurrences when subscribed"
  on public.coach_availability_slot_occurrences for delete to authenticated
  using (public.coach_owns_and_has_access(coach_id) or public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "All" on public.coach_availability;
create policy "Anyone reads availability"
  on public.coach_availability for select to anon, authenticated
  using (true);
create policy "Coaches write own availability when subscribed"
  on public.coach_availability for insert to authenticated
  with check (public.coach_owns_and_has_access(coach_id) or public.has_role(auth.uid(), 'admin'::app_role));
create policy "Coaches update own availability when subscribed"
  on public.coach_availability for update to authenticated
  using (public.coach_owns_and_has_access(coach_id) or public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.coach_owns_and_has_access(coach_id) or public.has_role(auth.uid(), 'admin'::app_role));
create policy "Coaches delete own availability when subscribed"
  on public.coach_availability for delete to authenticated
  using (public.coach_owns_and_has_access(coach_id) or public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "All" on public.coach_availability_v2;
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'coach_availability_v2') then
    execute $p$
      create policy "Anyone reads availability_v2"
        on public.coach_availability_v2 for select to anon, authenticated
        using (true)
    $p$;
    execute $p$
      create policy "Coaches write availability_v2 when subscribed"
        on public.coach_availability_v2 for insert to authenticated
        with check (public.coach_owns_and_has_access(coach_id) or public.has_role(auth.uid(), 'admin'::app_role))
    $p$;
    execute $p$
      create policy "Coaches update availability_v2 when subscribed"
        on public.coach_availability_v2 for update to authenticated
        using (public.coach_owns_and_has_access(coach_id) or public.has_role(auth.uid(), 'admin'::app_role))
        with check (public.coach_owns_and_has_access(coach_id) or public.has_role(auth.uid(), 'admin'::app_role))
    $p$;
    execute $p$
      create policy "Coaches delete availability_v2 when subscribed"
        on public.coach_availability_v2 for delete to authenticated
        using (public.coach_owns_and_has_access(coach_id) or public.has_role(auth.uid(), 'admin'::app_role))
    $p$;
  end if;
end $$;

drop policy if exists "All" on public.coach_availability_slots_v2;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'coach_availability_slots_v2' and column_name = 'availability_id'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'coach_availability_v2' and column_name = 'coach_id'
  ) then
    execute $p$
      create policy "Read slots_v2"
        on public.coach_availability_slots_v2 for select to anon, authenticated
        using (true)
    $p$;
    execute $p$
      create policy "Coaches write slots_v2 when subscribed"
        on public.coach_availability_slots_v2 for insert to authenticated
        with check (
          public.coach_owns_and_has_access((select coach_id from public.coach_availability_v2 a where a.id = availability_id))
          or public.has_role(auth.uid(), 'admin'::app_role)
        )
    $p$;
    execute $p$
      create policy "Coaches update slots_v2 when subscribed"
        on public.coach_availability_slots_v2 for update to authenticated
        using (
          public.coach_owns_and_has_access((select coach_id from public.coach_availability_v2 a where a.id = availability_id))
          or public.has_role(auth.uid(), 'admin'::app_role)
        )
        with check (
          public.coach_owns_and_has_access((select coach_id from public.coach_availability_v2 a where a.id = availability_id))
          or public.has_role(auth.uid(), 'admin'::app_role)
        )
    $p$;
    execute $p$
      create policy "Coaches delete slots_v2 when subscribed"
        on public.coach_availability_slots_v2 for delete to authenticated
        using (
          public.coach_owns_and_has_access((select coach_id from public.coach_availability_v2 a where a.id = availability_id))
          or public.has_role(auth.uid(), 'admin'::app_role)
        )
    $p$;
  end if;
exception when others then
  raise notice 'coach_availability_slots_v2 policies skipped: %', sqlerrm;
end $$;

drop policy if exists "All" on public.coach_availability_weekly_slots;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'coach_availability_weekly_slots' and column_name = 'availability_id'
  ) then
    execute $p$
      create policy "Read weekly slots"
        on public.coach_availability_weekly_slots for select to anon, authenticated
        using (true)
    $p$;
    execute $p$
      create policy "Coaches write weekly slots when subscribed"
        on public.coach_availability_weekly_slots for insert to authenticated
        with check (
          public.coach_owns_and_has_access((select a.coach_id from public.coach_availability a where a.id = availability_id))
          or public.has_role(auth.uid(), 'admin'::app_role)
        )
    $p$;
    execute $p$
      create policy "Coaches update weekly slots when subscribed"
        on public.coach_availability_weekly_slots for update to authenticated
        using (
          public.coach_owns_and_has_access((select a.coach_id from public.coach_availability a where a.id = availability_id))
          or public.has_role(auth.uid(), 'admin'::app_role)
        )
        with check (
          public.coach_owns_and_has_access((select a.coach_id from public.coach_availability a where a.id = availability_id))
          or public.has_role(auth.uid(), 'admin'::app_role)
        )
    $p$;
    execute $p$
      create policy "Coaches delete weekly slots when subscribed"
        on public.coach_availability_weekly_slots for delete to authenticated
        using (
          public.coach_owns_and_has_access((select a.coach_id from public.coach_availability a where a.id = availability_id))
          or public.has_role(auth.uid(), 'admin'::app_role)
        )
    $p$;
  end if;
exception when others then
  raise notice 'coach_availability_weekly_slots policies skipped: %', sqlerrm;
end $$;

-- Coaches table: keep public read; only the owning coach (or admin) may update, including when locked
-- so they can still open Settings / subscribe / deactivate.
drop policy if exists "Enable update for authenticated users only" on public.coaches;
create policy "Coaches update own row"
  on public.coaches for update to authenticated
  using (id = public.current_coach_id() or public.has_role(auth.uid(), 'admin'::app_role))
  with check (id = public.current_coach_id() or public.has_role(auth.uid(), 'admin'::app_role));

-- Configurations: stop any signed-in user from editing fees.
drop policy if exists "Allow authenticated users to update configurations" on public.configurations;
drop policy if exists "Update" on public.configurations;
drop policy if exists "Delete" on public.configurations;
create policy "Admins update configurations"
  on public.configurations for update to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));
create policy "Admins delete configurations"
  on public.configurations for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

-- Messages / conversations: drop the open All RLS policies; keep the member policies.
drop policy if exists "All RLS" on public.messages;
drop policy if exists "All RLS" on public.conversations;
drop policy if exists "All RLS" on public.conversation_participants;

-- ---------- Account deletion PII ----------
create or replace function public.prepare_account_deletion(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete_id uuid;
  v_coach_id uuid;
  v_today date := (timezone('America/New_York', now()))::date;
begin
  select athlete_id, coach_id into v_athlete_id, v_coach_id from public.user_profiles where id = p_user_id;

  update public.coach_slot_bookings as booking
    set status = 'canceled', canceled_at = now(), cancellation_reason = 'Account deleted', updated_at = now()
    from public.coach_availability_slot_occurrences as occurrence
    where booking.occurrence_id = occurrence.id
      and booking.status::text in ('booked', 'pending_payment', 'requested')
      and occurrence.occurrence_date >= v_today
      and ((v_athlete_id is not null and booking.athlete_id = v_athlete_id)
        or (v_coach_id is not null and booking.coach_id = v_coach_id));

  -- Blank this person's messages and conversation previews that quote them.
  update public.messages
    set body = '', edited_at = now()
    where sender_id = p_user_id;
  update public.conversations c
    set last_message_text = null
    where exists (
      select 1 from public.messages m
      where m.conversation_id = c.id and m.sender_id = p_user_id
    );

  -- Tombstone invite emails so the unique (coach_id, client_email) still holds.
  update public.coach_client_referrals
    set client_email = 'deleted+' || id::text || '@invalid.local',
        client_name = 'Former family',
        athlete_first_name = null,
        invite_token = gen_random_uuid()
    where client_email in (
      select email from auth.users where id = p_user_id
    )
    or athlete_id = v_athlete_id
    or (v_coach_id is not null and coach_id = v_coach_id and status in ('invited', 'pending_confirmation'));

  if v_athlete_id is not null then
    update public.athlete_profiles
      set user_id = null, full_name = 'Former athlete', phone_number = null, location = null,
          bio = null, profile_image_url = null, cover_image_urls = '{}', instagram_handle = null,
          high_school = null, season_goal = null, highlight_video_url = null, updated_at = now()
      where id = v_athlete_id;
  end if;
  if v_coach_id is not null then
    update public.coaches
      set status = 'hidden', name = 'Former coach', email = null, updated_at = now()
      where id = v_coach_id;
  end if;

  update public.package_purchases set user_id = null where user_id = p_user_id;
  update public.coach_slot_bookings set created_by = null where created_by = p_user_id;
  update public.slot_feedback_v2 set created_by = null where created_by = p_user_id;
  update public.slot_attendance_v2 set created_by = null where created_by = p_user_id;
  update public.session_feedback_v2 set created_by = null where created_by = p_user_id;
end;
$$;

revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;

-- Inject billing access into coach write RPCs (skips any that already call it).
do $$
declare
  r record;
  def text;
  new_def text;
  pos_tag integer;
  pos_begin integer;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prolang = (select oid from pg_language where lanname = 'plpgsql')
      and p.proname = any (array[
        'schedule_remove_session', 'schedule_clear_day', 'schedule_update_draft',
        'schedule_copy_groups', 'schedule_publish_groups', 'schedule_publish_groups_to',
        'schedule_offer_session', 'schedule_share_session', 'schedule_stop_series',
        'schedule_update_series', 'schedule_set_booking_rules', 'schedule_set_rules',
        'coach_book_athlete', 'coach_undo_booking', 'coach_move_session',
        'set_coach_athlete_note', 'set_coach_athlete_goal', 'set_coach_profile_services',
        'set_coach_coaching_video', 'attest_coach_referral', 'coach_fix_invite_email',
        'resend_coach_referral', 'save_organization_page', 'save_org_package',
        'create_coach_channel', 'save_my_intro_settings', 'update_group_offer',
        'confirm_offline_payment', 'remove_org_package', 'restore_org_package',
        'submit_session_feedback', 'set_session_note', 'coach_decline_note'
      ])
  loop
    def := pg_get_functiondef(r.oid);
    if position('require_coach_billing_access' in def) > 0 then
      continue;
    end if;
    pos_tag := position('$function$' in def);
    if pos_tag = 0 then
      pos_tag := position('$$' in def);
    end if;
    if pos_tag = 0 then
      continue;
    end if;
    pos_begin := position('BEGIN' in upper(substr(def, pos_tag)));
    if pos_begin = 0 then
      continue;
    end if;
    -- Insert immediately after the first BEGIN in the function body.
    pos_begin := pos_tag + pos_begin - 1 + length('BEGIN');
    new_def := substr(def, 1, pos_begin) || E'\n  perform public.require_coach_billing_access();' || substr(def, pos_begin + 1);
    execute new_def;
  end loop;
end $$;
