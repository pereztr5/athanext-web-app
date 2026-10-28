-- Oct 27 tech sync: an unpaid Stripe Checkout no longer holds a spot. Families must be able to
-- leave Stripe and come back to pay, and another family's open Checkout never blocks booking.
-- Spot counts shown to families skip rows of an unfinished Checkout (hold_expires_at is set
-- until mark_checkout_paid clears it). When a payment fills a session, create-booking-payment
-- expires the other open Checkouts for it. get_group_offer also says when the viewer's own
-- pick is still unpaid, so the card can offer "Finish paying".

CREATE OR REPLACE FUNCTION public.get_group_offer(p_offer_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with viewer as (
    select coalesce(
      (select profile.athlete_id from public.user_profiles as profile where profile.id = auth.uid()),
      (select athlete.id from public.athlete_profiles as athlete where athlete.user_id = auth.uid() limit 1)
    ) as athlete_id,
    public.current_coach_id() as coach_id
  )
  select jsonb_build_object(
    'id', offer.id,
    'title', offer.title,
    'kind', offer.kind,
    'suggestion', offer.suggestion,
    'closes_at', offer.closes_at,
    'closed', offer.closes_at <= now(),
    'updated_at', offer.created_at,
    'coach_id', coach.id,
    'coach_name', coach.name,
    'coach_slug', coach.slug,
    'coach_pay_mode', coach.pay_mode,
    'coach_pay_note', coach.pay_note,
    'locations', case
      when viewer.coach_id is not null and viewer.coach_id = offer.coach_id then coalesce(
        (select array_agg(loc order by loc)
         from (
           select distinct nullif(trim(x), '') as loc
           from unnest(coalesce(coach.locations, '{}'::text[])) as x
           where nullif(trim(x), '') is not null
         ) as places),
        '{}'::text[]
      )
      else '{}'::text[]
    end,
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', occ.id,
        'date', occ.occurrence_date,
        'start_time', occ.start_time,
        'end_time', occ.end_time,
        'duration_minutes', occ.duration_minutes,
        'session_name', occ.session_name,
        'price', occ.price,
        'price_from', case
          when occ.details ? 'price_from' then (occ.details->>'price_from')::numeric
          else null
        end,
        'capacity', occ.max_bookings_per_slot,
        'location', occ.location,
        'place', occ.place,
        'details', occ.details,
        'cancelled', not occ.is_enabled,
        'cancel_refund', occ.cancel_refund,
        'is_new', coalesce((occ.details->>'pick_new')::boolean, false),
        'booked_count', (
          select count(*) from public.coach_slot_bookings as b
          where b.occurrence_id = occ.id and b.status in ('requested', 'pending_payment', 'booked', 'completed')
            and b.hold_expires_at is null
        ),
        'pending_confirm_count', (
          select count(*) from public.coach_slot_bookings as b
          where b.occurrence_id = occ.id and b.status in ('booked', 'pending_payment')
            and b.change_ask = 'pending'
        ),
        'my_unpaid', exists (
          select 1 from public.coach_slot_bookings as b, viewer
          where b.occurrence_id = occ.id and b.athlete_id = viewer.athlete_id
            and b.status = 'pending_payment' and b.hold_expires_at is not null
        ),
        'my_status', (
          select b.status from public.coach_slot_bookings as b, viewer
          where b.occurrence_id = occ.id and b.athlete_id = viewer.athlete_id
            and b.status in ('requested', 'pending_payment', 'booked', 'completed', 'canceled')
          order by b.created_at desc limit 1
        ),
        'my_booking_id', (
          select b.id from public.coach_slot_bookings as b, viewer
          where b.occurrence_id = occ.id and b.athlete_id = viewer.athlete_id
            and b.status in ('requested', 'pending_payment', 'booked', 'completed')
          order by b.created_at desc limit 1
        ),
        'my_paid_amount', (
          select (
            select sum(p.total_amount) from public.payments as p where p.booking_id = b.id
          )
          from public.coach_slot_bookings as b, viewer
          where b.occurrence_id = occ.id and b.athlete_id = viewer.athlete_id
            and b.status in ('requested', 'pending_payment', 'booked', 'completed', 'canceled')
          order by b.created_at desc limit 1
        ),
        'my_change_ask', (
          select b.change_ask from public.coach_slot_bookings as b, viewer
          where b.occurrence_id = occ.id and b.athlete_id = viewer.athlete_id
            and b.status in ('booked', 'pending_payment')
          order by b.created_at desc limit 1
        ),
        'change_from', (
          select b.change_from from public.coach_slot_bookings as b, viewer
          where b.occurrence_id = occ.id and b.athlete_id = viewer.athlete_id
            and b.status in ('booked', 'pending_payment')
            and b.change_ask is not null
          order by b.created_at desc limit 1
        ),
        'started', public.eastern_timestamp(occ.occurrence_date, occ.start_time) <= now()
      ) order by occ.occurrence_date, occ.start_time)
      from public.coach_availability_slot_occurrences as occ
      where occ.id = any(offer.occurrence_ids) and not occ.is_draft
        and (occ.is_enabled or occ.disabled_reason in ('removed', 'cancelled') or occ.canceled_at is not null)
    ), '[]'::jsonb)
  )
  from public.group_session_offers as offer
  join public.coaches as coach on coach.id = offer.coach_id
  cross join viewer
  where offer.id = p_offer_id;
$function$;

CREATE OR REPLACE FUNCTION public.visible_sessions(p_coach_id uuid, p_athlete_id uuid, p_from date, p_to date)
 RETURNS TABLE(id uuid, coach_id uuid, occurrence_date date, start_time time without time zone, end_time time without time zone, duration_minutes integer, session_type text, session_name text, price numeric, capacity integer, location text, place text, pillar text, "position" text, visibility text, details jsonb, booked_count integer, my_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select occ.id, occ.coach_id, occ.occurrence_date, occ.start_time, occ.end_time,
    occ.duration_minutes, occ.session_type, occ.session_name, occ.price,
    occ.max_bookings_per_slot, occ.location, occ.place, occ.pillar_slot, occ.position,
    occ.visibility, occ.details,
    (select count(*)::integer from public.coach_slot_bookings as b
      where b.occurrence_id = occ.id and b.status in ('requested', 'pending_payment', 'booked', 'completed')
        and b.hold_expires_at is null),
    (select b.status from public.coach_slot_bookings as b
      where b.occurrence_id = occ.id and b.athlete_id = p_athlete_id
        and b.status in ('requested', 'pending_payment', 'booked', 'completed')
      order by b.created_at desc limit 1)
  from public.coach_availability_slot_occurrences as occ
  where occ.coach_id = p_coach_id
    and occ.occurrence_date between p_from and p_to
    and occ.is_enabled
    and not occ.is_draft
    and occ.camp_id is null
    and public.eastern_timestamp(occ.occurrence_date, occ.start_time) > now()
    and not public.coach_is_busy(occ.coach_id, occ.occurrence_date, occ.start_time, occ.end_time)
    and (
      occ.visibility = 'open'
      or (occ.visibility = 'offered' and p_athlete_id = any(occ.offered_to))
      or (occ.visibility = 'clients' and (public.is_coach_client(occ.coach_id, p_athlete_id) or p_athlete_id = any(occ.offered_to)))
    );
$function$;

CREATE OR REPLACE FUNCTION public.get_session_for_booking(p_occurrence_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select (to_jsonb(occ) - 'offered_to') || jsonb_build_object(
    'coach_slug', coach.slug,
    'coach_name', coach.name,
    'booked_count', (
      select count(*) from public.coach_slot_bookings as b
      where b.occurrence_id = occ.id and b.status in ('requested', 'pending_payment', 'booked', 'completed')
            and b.hold_expires_at is null
    )
  )
  from public.coach_availability_slot_occurrences as occ
  join public.coaches as coach on coach.id = occ.coach_id
  where occ.id = p_occurrence_id
    and occ.is_enabled
    and not occ.is_draft
    and public.eastern_timestamp(occ.occurrence_date, occ.start_time) + interval '10 minutes' > now();
$function$;

CREATE OR REPLACE FUNCTION public.get_org_page_extras(p_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with org as (select * from public.organizations where slug = p_slug),
  shown as (
    select m.coach_id from public.organization_coaches m join org on org.id = m.organization_id
    join public.coaches c on c.id = m.coach_id
    where m.shown and c.deactivated_at is null
  )
  select jsonb_build_object(
    'owner_id', (select owner_coach_id from org),
    'owner_name', (select c.name from public.coaches c join org on c.id = org.owner_coach_id),
    'packages', coalesce((
      select jsonb_agg(public.org_package_json(p) order by p.price)
      from public.org_packages p join org on org.id = p.organization_id
      where p.is_active
    ), '[]'::jsonb),
    'coach_prices', coalesce((
      select jsonb_object_agg(c.id, c.hourly_rate)
      from public.coaches c join public.organization_coaches m on m.coach_id = c.id join org on org.id = m.organization_id
    ), '{}'::jsonb),
    'groups', coalesce((
      select jsonb_agg(g order by g->>'date', g->>'start_time')
      from (
        select jsonb_build_object(
          'id', occ.id,
          'coach_id', occ.coach_id,
          'coach_name', c.name,
          'title', occ.session_name,
          'date', occ.occurrence_date,
          'start_time', occ.start_time,
          'price', occ.price,
          'capacity', occ.max_bookings_per_slot,
          'booked', (
            select count(*) from public.coach_slot_bookings b
            where b.occurrence_id = occ.id and b.status in ('requested', 'pending_payment', 'booked', 'completed') and b.hold_expires_at is null
          )
        ) as g
        from public.coach_availability_slot_occurrences occ
        join public.coaches c on c.id = occ.coach_id
        where occ.coach_id in (select coach_id from shown)
          and occ.session_type = 'group' and occ.is_enabled and not occ.is_draft
          and occ.visibility <> 'offered'
          and public.eastern_timestamp(occ.occurrence_date, occ.start_time) > now()
        order by occ.occurrence_date, occ.start_time
        limit 4
      ) as upcoming
    ), '[]'::jsonb)
  );
$function$;

notify pgrst, 'reload schema';
