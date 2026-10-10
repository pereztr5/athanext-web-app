-- Staging demo seed for Riley Example + Casey Synthetic and a small supporting cast.
-- Idempotent. Safe to re-run. Does not create auth users or touch Stripe.

begin;

-- Known accounts (already on staging)
-- Riley: user b2222222-2222-4222-8222-222222222222  coach a1111111-1111-4111-8111-111111111111
-- Casey: user b1111111-1111-4111-8111-111111111111  athlete b3333333-3333-4333-8333-333333333333
-- Availability window: f1111111-1111-4111-8111-111111111111

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

update public.athlete_profiles
set
  full_name = 'Casey Synthetic',
  sport = 'soccer',
  position = 'Goalkeeper',
  date_of_birth = '2009-03-18',
  high_school = 'Riverside FC U17',
  graduation_year = '2028',
  pathway_tags = array['Elite']::text[],
  season_goal = 'Earn the starting keeper spot and keep a clean sheet in the spring showcase.',
  highlight_video_url = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  bio = 'U17 goalkeeper. Working on distribution and starting from the back.',
  profile_completed = true,
  updated_at = now()
where id = 'b3333333-3333-4333-8333-333333333333';

update public.coaches
set
  bio = 'Former college keeper. I coach players aged 10 to 19 on shot stopping, distribution and the habits that carry into games. Every session ends with notes for the family.',
  hourly_rate = 85,
  specialties = array['Goalkeeping', 'Shot stopping', 'Distribution']::text[],
  locations = array['Riverside turf', 'Video call']::text[],
  company = 'Riley Soccer Academy',
  cancel_notice_hours = 24,
  booking_window_weeks = 4,
  travel_miles = 15,
  travel_zip = '10001',
  group_min = 2,
  age_min = 10,
  age_max = 19,
  intro_enabled = true,
  intro_minutes = 20,
  intro_format = 'video',
  coaching_video_url = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  profile_services = '[
    {"id":"individual","name":"Individual session","format":"individual","minutes":60,"where":"In person","price":85,"on":true},
    {"id":"small","name":"Small group","format":"group","minutes":60,"where":"In person, 2 to 4 athletes","price":45,"on":true}
  ]'::jsonb,
  profile_faqs = '[
    {"id":"faq-bring","question":"What should my athlete bring?","answer":"Ball, water, cleats and shin guards. I bring cones, bibs and a portable goal."},
    {"id":"faq-pack","question":"Do you offer packages?","answer":"Yes. 8 individual sessions are $640, or $80 a session. Credits last 90 days."}
  ]'::jsonb,
  affiliate_links = '[
    {"brand":"Nike","url":"https://www.nike.com","code":"RILEY10"},
    {"brand":"Adidas","url":"https://www.adidas.com","code":"RILEY15"}
  ]'::jsonb,
  deals_enabled = true,
  listed = true,
  updated_at = now()
where id = 'a1111111-1111-4111-8111-111111111111';

update public.organizations
set
  name = 'Riley Soccer Academy',
  line = 'Riverside · Goalkeeper training',
  about = 'Small-group and 1-on-1 keeper sessions. Notes after every session, and a written progress check every 8 weeks.',
  updated_at = now()
where owner_coach_id = 'a1111111-1111-4111-8111-111111111111';

update public.coach_availability
set end_date = '2026-12-31', updated_at = now()
where id = 'f1111111-1111-4111-8111-111111111111';

insert into public.coach_certifications (
  id, coach_id, certification_name, issuing_organization, issue_date
) values
  ('c0de0005-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', 'USSF C License', 'U.S. Soccer', '2021-06-01'),
  ('c0de0005-0000-4000-8000-000000000002', 'a1111111-1111-4111-8111-111111111111', 'Background check', 'Verified', '2026-08-03')
on conflict (id) do update
set certification_name = excluded.certification_name,
    issuing_organization = excluded.issuing_organization,
    issue_date = excluded.issue_date,
    updated_at = now();

insert into public.coach_packages (
  id, coach_id, package_name, description, session_count, duration_minutes,
  total_price, validity_days, is_active, display_order
) values (
  'c0de0006-0000-4000-8000-000000000001',
  'a1111111-1111-4111-8111-111111111111',
  '8 individual sessions',
  'Eight 60-minute 1-on-1s. Credits last 90 days.',
  8, 60, 640, 90, true, 1
)
on conflict (id) do update
set package_name = excluded.package_name,
    description = excluded.description,
    session_count = excluded.session_count,
    total_price = excluded.total_price,
    is_active = true,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- Supporting athletes (no logins) and invites
-- ---------------------------------------------------------------------------

insert into public.athlete_profiles (
  id, user_id, full_name, sport, position, date_of_birth, high_school,
  tags, cover_image_urls, pathway_tags, profile_completed
) values
  ('c0de0002-0000-4000-8000-000000000001', null, 'Maya Reed', 'soccer', 'Winger', '2013-05-02', 'Lakeline SC U14', '{}', '{}', '{Development}', true),
  ('c0de0002-0000-4000-8000-000000000002', null, 'Eli Park', 'soccer', 'Center back', '2012-09-20', 'Westlake FC U15', '{}', '{}', '{Club}', true),
  ('c0de0002-0000-4000-8000-000000000003', null, 'Emma Lopez', 'soccer', 'Midfielder', '2013-01-11', 'Hill Country SC U14', '{}', '{}', '{Club}', true)
on conflict (id) do update
set full_name = excluded.full_name,
    position = excluded.position,
    high_school = excluded.high_school,
    pathway_tags = excluded.pathway_tags,
    updated_at = now();

insert into public.coach_client_referrals (
  id, coach_id, client_email, athlete_id, initiated_by, relationship_source,
  status, confirmed_at, client_name, athlete_first_name, invited_via
) values
  ('c0de0003-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', 'athlete.synthetic@example.com',
   'b3333333-3333-4333-8333-333333333333', 'coach', 'offline', 'confirmed', now(), 'Casey Synthetic', 'Casey', 'email'),
  ('c0de0003-0000-4000-8000-000000000002', 'a1111111-1111-4111-8111-111111111111', 'dana.reed.demo@example.com',
   'c0de0002-0000-4000-8000-000000000001', 'coach', 'offline', 'confirmed', now(), 'Dana Reed', 'Maya', 'email'),
  ('c0de0003-0000-4000-8000-000000000003', 'a1111111-1111-4111-8111-111111111111', 'eli.park.demo@example.com',
   'c0de0002-0000-4000-8000-000000000002', 'athlete', 'platform', 'confirmed', now(), 'Eli Park', 'Eli', 'link'),
  ('c0de0003-0000-4000-8000-000000000004', 'a1111111-1111-4111-8111-111111111111', 'priya.shah.demo@example.com',
   null, 'coach', null, 'invited', null, 'Priya Shah', 'Aarav', 'email'),
  ('c0de0003-0000-4000-8000-000000000005', 'a1111111-1111-4111-8111-111111111111', 'chris.long.demo@example.com',
   null, 'athlete', null, 'pending_confirmation', null, 'Chris Long', 'Sam', 'link')
on conflict (coach_id, client_email) do update
set athlete_id = excluded.athlete_id,
    status = excluded.status,
    relationship_source = excluded.relationship_source,
    confirmed_at = excluded.confirmed_at,
    client_name = excluded.client_name,
    athlete_first_name = excluded.athlete_first_name,
    invited_via = excluded.invited_via,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- Sessions (dates relative to America/New_York)
-- ---------------------------------------------------------------------------

do $$
declare
  v_coach uuid := 'a1111111-1111-4111-8111-111111111111';
  v_avail uuid := 'f1111111-1111-4111-8111-111111111111';
  v_weekly uuid := 'f2222222-2222-4222-8222-222222222222';
  v_casey uuid := 'b3333333-3333-4333-8333-333333333333';
  v_maya uuid := 'c0de0002-0000-4000-8000-000000000001';
  v_eli uuid := 'c0de0002-0000-4000-8000-000000000002';
  v_emma uuid := 'c0de0002-0000-4000-8000-000000000003';
  v_tz text := 'America/New_York';
  v_now timestamp := timezone(v_tz, now());
  v_today date := v_now::date;
  v_tue date;
  v_sat date;
  v_wed date;
  v_thu date;
  v_open date;
  n int;
begin
  -- Next Tuesday / Wednesday / Saturday from today
  v_tue := v_today + ((2 - extract(dow from v_today)::int + 7) % 7);
  if v_tue = v_today then v_tue := v_today + 7; end if;
  v_wed := v_today + ((3 - extract(dow from v_today)::int + 7) % 7);
  if v_wed = v_today then v_wed := v_today + 7; end if;
  v_sat := v_today + ((6 - extract(dow from v_today)::int + 7) % 7);
  if v_sat = v_today then v_sat := v_today + 7; end if;
  v_thu := v_today + ((4 - extract(dow from v_today)::int + 7) % 7);
  if v_thu = v_today then v_thu := v_today + 7; end if;

  -- Existing past rows: rename + mark the Oct 6 session completed (notes still due)
  update public.coach_availability_slot_occurrences
  set session_name = 'On-field training', pillar_slot = 'On-field training', place = 'Riverside turf',
      position = 'Goalkeeper', updated_at = now()
  where coach_id = v_coach and id in (
    'f3333333-3333-4333-8333-333333333331',
    (select occurrence_id from public.coach_slot_bookings where id = '8ad71899-d26b-4046-a8d3-894783a34068'),
    (select occurrence_id from public.coach_slot_bookings where id = 'def9e8cf-a741-48d0-8af0-6d02b9ef8a99')
  );

  update public.coach_slot_bookings
  set status = 'completed', updated_at = now()
  where id = 'def9e8cf-a741-48d0-8af0-6d02b9ef8a99' and status = 'booked';

  -- Helper to upsert an occurrence
  perform 1; -- keep declare block valid before inserts

  insert into public.coach_availability_slot_occurrences (
    id, weekly_slot_id, availability_id, coach_id, occurrence_date, session_name, price,
    duration_minutes, start_time, end_time, session_type, location, pillar_slot, is_enabled,
    max_bookings_per_slot, place, position, visibility, offered_to, details, is_draft
  ) values
    -- In progress / today
    ('c0de0001-0000-4000-8000-000000000010', v_weekly, v_avail, v_coach, v_today,
     'On-field training', 85, 60,
     greatest((v_now - interval '20 minutes')::time, time '00:00'),
     least((v_now + interval '40 minutes')::time, time '23:59:59'),
     'individual', 'in-person', 'On-field training', true, 1, 'Riverside turf', 'Goalkeeper', 'open', '{}', '{}', false),
    -- Upcoming 1-on-1
    ('c0de0001-0000-4000-8000-000000000011', v_weekly, v_avail, v_coach, v_tue,
     'On-field training', 85, 60, '16:00', '17:00', 'individual', 'in-person', 'On-field training',
     true, 1, 'Riverside turf', 'Goalkeeper', 'open', '{}', '{}', false),
    -- Upcoming group
    ('c0de0001-0000-4000-8000-000000000012', null, v_avail, v_coach, v_sat,
     'U17 keeper group', 45, 60, '10:00', '11:00', 'group', 'in-person', 'On-field training',
     true, 6, 'Riverside turf', 'Goalkeeper', 'open', '{}',
     '{"about":["Handling and distribution","1v1 from the top of the box"],"ages":"14 to 18","bring":"Gloves, water"}', false),
    -- Casey request
    ('c0de0001-0000-4000-8000-000000000013', v_weekly, v_avail, v_coach, v_wed,
     'On-field training', 85, 60, '16:00', '17:00', 'individual', 'in-person', 'On-field training',
     true, 1, 'Riverside turf', 'Goalkeeper', 'open', '{}', '{}', false),
    -- Marketplace request (Emma)
    ('c0de0001-0000-4000-8000-000000000017', v_weekly, v_avail, v_coach, v_wed + 7,
     'On-field training', 85, 60, '17:00', '18:00', 'individual', 'in-person', 'On-field training',
     true, 1, 'Riverside turf', 'Field player', 'open', '{}', '{}', false),
    -- Cancelled by family
    ('c0de0001-0000-4000-8000-000000000014', v_weekly, v_avail, v_coach, v_today - 12,
     'On-field training', 85, 60, '16:00', '17:00', 'individual', 'in-person', 'On-field training',
     false, 1, 'Riverside turf', 'Goalkeeper', 'open', '{}', '{}', false),
    -- Cancelled by coach
    ('c0de0001-0000-4000-8000-000000000015', v_weekly, v_avail, v_coach, v_today - 19,
     'On-field training', 85, 60, '16:00', '17:00', 'individual', 'in-person', 'On-field training',
     false, 1, 'Riverside turf', 'Goalkeeper', 'open', '{}', '{}', false),
    -- No-show
    ('c0de0001-0000-4000-8000-000000000016', v_weekly, v_avail, v_coach, v_today - 26,
     'On-field training', 85, 60, '16:00', '17:00', 'individual', 'in-person', 'On-field training',
     true, 1, 'Riverside turf', 'Goalkeeper', 'open', '{}', '{}', false),
    -- Published empty group (next week)
    ('c0de0001-0000-4000-8000-000000000030', null, v_avail, v_coach, v_sat + 7,
     'Finishing clinic', 35, 75, '10:00', '11:15', 'group', 'in-person', 'On-field training',
     true, 8, 'Riverside turf', 'Both', 'open', '{}',
     '{"about":["Finishing from wide angles"],"ages":"12 to 16","bring":"Ball, water"}', false)
  on conflict (id) do update
  set occurrence_date = excluded.occurrence_date,
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      session_name = excluded.session_name,
      pillar_slot = excluded.pillar_slot,
      place = excluded.place,
      is_enabled = excluded.is_enabled,
      max_bookings_per_slot = excluded.max_bookings_per_slot,
      details = excluded.details,
      updated_at = now();

  update public.coach_availability_slot_occurrences
  set canceled_at = now() - interval '20 days',
      cancel_reason = 'Weather',
      cancel_refund = 'Refunded as 1 session credit',
      disabled_reason = 'removed',
      is_enabled = false
  where id = 'c0de0001-0000-4000-8000-000000000015';

  -- Open 1-on-1s for Book (next 3 Tuesdays and Thursdays, skip the booked Tuesday)
  n := 0;
  for i in 0..2 loop
    v_open := v_tue + (i * 7);
    if i > 0 then
      n := n + 1;
      insert into public.coach_availability_slot_occurrences (
        id, weekly_slot_id, availability_id, coach_id, occurrence_date, session_name, price,
        duration_minutes, start_time, end_time, session_type, location, pillar_slot, is_enabled,
        max_bookings_per_slot, place, position, visibility, offered_to, details, is_draft
      ) values (
        ('c0de0001-0000-4000-8000-00000000002' || n)::uuid,
        v_weekly, v_avail, v_coach, v_open, 'On-field training', 85, 60, '16:00', '17:00',
        'individual', 'in-person', 'On-field training', true, 1, 'Riverside turf', 'Goalkeeper',
        'open', '{}', '{}', false
      )
      on conflict (id) do update set occurrence_date = excluded.occurrence_date, updated_at = now();
    end if;
    n := n + 1;
    insert into public.coach_availability_slot_occurrences (
      id, weekly_slot_id, availability_id, coach_id, occurrence_date, session_name, price,
      duration_minutes, start_time, end_time, session_type, location, pillar_slot, is_enabled,
      max_bookings_per_slot, place, position, visibility, offered_to, details, is_draft
    ) values (
      ('c0de0001-0000-4000-8000-00000000003' || n)::uuid,
      null, v_avail, v_coach, v_thu + (i * 7), 'On-field training', 85, 60, '16:00', '17:00',
      'individual', 'in-person', 'On-field training', true, 1, 'Riverside turf', 'Goalkeeper',
      'open', '{}', '{}', false
    )
    on conflict (id) do update set occurrence_date = excluded.occurrence_date, updated_at = now();
  end loop;

  insert into public.coach_slot_bookings (
    id, occurrence_id, weekly_slot_id, availability_id, coach_id, athlete_id,
    status, payment_status, notes, canceled_at, cancellation_reason, created_by
  ) values
    ('c0de0004-0000-4000-8000-000000000010', 'c0de0001-0000-4000-8000-000000000010', v_weekly, v_avail, v_coach, v_casey,
     'booked', 'paid', null, null, null, 'b1111111-1111-4111-8111-111111111111'),
    ('c0de0004-0000-4000-8000-000000000011', 'c0de0001-0000-4000-8000-000000000011', v_weekly, v_avail, v_coach, v_casey,
     'booked', 'credit', null, null, null, 'b1111111-1111-4111-8111-111111111111'),
    ('c0de0004-0000-4000-8000-000000000012', 'c0de0001-0000-4000-8000-000000000012', null, v_avail, v_coach, v_casey,
     'booked', 'paid', null, null, null, 'b1111111-1111-4111-8111-111111111111'),
    ('c0de0004-0000-4000-8000-000000000018', 'c0de0001-0000-4000-8000-000000000012', null, v_avail, v_coach, v_maya,
     'booked', 'paid', null, null, null, null),
    ('c0de0004-0000-4000-8000-000000000019', 'c0de0001-0000-4000-8000-000000000012', null, v_avail, v_coach, v_eli,
     'booked', 'paid', null, null, null, null),
    ('c0de0004-0000-4000-8000-000000000013', 'c0de0001-0000-4000-8000-000000000013', v_weekly, v_avail, v_coach, v_casey,
     'requested', 'unpaid', 'Wants extra handling work before the showcase.', null, null, 'b1111111-1111-4111-8111-111111111111'),
    ('c0de0004-0000-4000-8000-000000000017', 'c0de0001-0000-4000-8000-000000000017', v_weekly, v_avail, v_coach, v_emma,
     'requested', 'unpaid', 'New family from the marketplace. Emma plays midfield.', null, null, null),
    ('c0de0004-0000-4000-8000-000000000014', 'c0de0001-0000-4000-8000-000000000014', v_weekly, v_avail, v_coach, v_casey,
     'canceled', 'refunded', null, now() - interval '13 days', 'Family travel', 'b1111111-1111-4111-8111-111111111111'),
    ('c0de0004-0000-4000-8000-000000000015', 'c0de0001-0000-4000-8000-000000000015', v_weekly, v_avail, v_coach, v_casey,
     'canceled', 'credit', null, now() - interval '20 days', 'Weather', 'b2222222-2222-4222-8222-222222222222'),
    ('c0de0004-0000-4000-8000-000000000016', 'c0de0001-0000-4000-8000-000000000016', v_weekly, v_avail, v_coach, v_casey,
     'no_show', 'paid', null, null, null, 'b1111111-1111-4111-8111-111111111111')
  on conflict (id) do update
  set status = excluded.status,
      payment_status = excluded.payment_status,
      notes = excluded.notes,
      canceled_at = excluded.canceled_at,
      cancellation_reason = excluded.cancellation_reason,
      updated_at = now();
end $$;

-- ---------------------------------------------------------------------------
-- Notes / reviews
-- ---------------------------------------------------------------------------

update public.slot_feedback_v2
set
  feedback_to_athlete = 'Cleaner on the right foot. Next time: left-foot first touch into space.',
  comment = 'Riley sends notes after every session, so we always know what to work on.',
  rating = 5,
  coach_reply = 'Thanks Casey. Your work rate makes it easy.',
  coach_reply_at = now() - interval '40 days',
  updated_at = now()
where booking_id = 'e533c121-0770-4444-8856-db558be4c76f';

update public.slot_feedback_v2
set
  feedback_to_athlete = 'Distribution from the back is sharper. Keep scanning before you receive.',
  updated_at = now()
where booking_id = '8ad71899-d26b-4046-a8d3-894783a34068';

-- ---------------------------------------------------------------------------
-- Money
-- ---------------------------------------------------------------------------

insert into public.package_purchases (
  id, user_id, coach_id, package_id, sessions_remaining, sessions_total,
  purchase_date, expiry_date, status, source, total_amount
) values (
  'c0de0006-0000-4000-8000-000000000010',
  'b1111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'c0de0006-0000-4000-8000-000000000001',
  5, 8, now() - interval '20 days', now() + interval '70 days', 'active', 'package', 640
)
on conflict (id) do update
set sessions_remaining = excluded.sessions_remaining,
    status = 'active',
    updated_at = now();

update public.coach_slot_bookings
set credit_purchase_id = 'c0de0006-0000-4000-8000-000000000010'
where id = 'c0de0004-0000-4000-8000-000000000011';

insert into public.coach_invoices (
  id, coach_id, athlete_id, family_name, athlete_name, service, amount, due_date, status, reminders
) values
  ('c0de0007-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111',
   'b3333333-3333-4333-8333-333333333333', 'Casey Synthetic', 'Casey Synthetic',
   'Individual session', 85, (current_date - 8), 'open', 1),
  ('c0de0007-0000-4000-8000-000000000002', 'a1111111-1111-4111-8111-111111111111',
   'c0de0002-0000-4000-8000-000000000001', 'Dana Reed', 'Maya Reed',
   '8-session package', 640, (current_date + 10), 'open', 0),
  ('c0de0007-0000-4000-8000-000000000003', 'a1111111-1111-4111-8111-111111111111',
   'b3333333-3333-4333-8333-333333333333', 'Casey Synthetic', 'Casey Synthetic',
   '8-session package', 640, (current_date - 20), 'paid', 0)
on conflict (id) do update
set amount = excluded.amount, due_date = excluded.due_date, status = excluded.status, reminders = excluded.reminders;

update public.coach_invoices
set paid_at = now() - interval '20 days', paid_method = 'outside'
where id = 'c0de0007-0000-4000-8000-000000000003';

insert into public.payments (
  id, booking_id, slot_id, transaction_time, coach_offer_amount, platform_fee_amount,
  stripe_price_amount, total_amount, currency, type
)
select x.id, x.booking_id, b.occurrence_id, coalesce(o.occurrence_date, current_date)::timestamptz,
       85, 0, 85, 85, 'usd', 'booking'
from (values
  ('c0de0008-0000-4000-8000-000000000001'::uuid, 'e533c121-0770-4444-8856-db558be4c76f'::uuid),
  ('c0de0008-0000-4000-8000-000000000002'::uuid, '8ad71899-d26b-4046-a8d3-894783a34068'::uuid),
  ('c0de0008-0000-4000-8000-000000000003'::uuid, 'def9e8cf-a741-48d0-8af0-6d02b9ef8a99'::uuid),
  ('c0de0008-0000-4000-8000-000000000010'::uuid, 'c0de0004-0000-4000-8000-000000000010'::uuid),
  ('c0de0008-0000-4000-8000-000000000012'::uuid, 'c0de0004-0000-4000-8000-000000000012'::uuid)
) as x(id, booking_id)
join public.coach_slot_bookings b on b.id = x.booking_id
join public.coach_availability_slot_occurrences o on o.id = b.occurrence_id
on conflict (booking_id) do update
set coach_offer_amount = excluded.coach_offer_amount, total_amount = excluded.total_amount;

insert into public.payout_transfers (id, booking_id, kind, coach_id, amount, currency, status, sent_at)
values
  ('c0de0009-0000-4000-8000-000000000001', 'e533c121-0770-4444-8856-db558be4c76f', 'coach',
   'a1111111-1111-4111-8111-111111111111', 85, 'usd', 'sent', now() - interval '50 days'),
  ('c0de0009-0000-4000-8000-000000000002', '8ad71899-d26b-4046-a8d3-894783a34068', 'coach',
   'a1111111-1111-4111-8111-111111111111', 85, 'usd', 'waiting', null)
on conflict (id) do update set status = excluded.status, amount = excluded.amount;

-- ---------------------------------------------------------------------------
-- Schedule extras, intro, messages
-- ---------------------------------------------------------------------------

insert into public.coach_time_off (id, coach_id, off_date, note)
values (
  'c0de000a-0000-4000-8000-000000000001',
  'a1111111-1111-4111-8111-111111111111',
  (timezone('America/New_York', now())::date + 5),
  'Tournament'
)
on conflict (id) do update set off_date = excluded.off_date, note = excluded.note;

insert into public.coach_busy_blocks (id, coach_id, starts_at, ends_at, source)
values (
  'c0de000a-0000-4000-8000-000000000002',
  'a1111111-1111-4111-8111-111111111111',
  timezone('America/New_York', (timezone('America/New_York', now())::date + 3)::timestamp + time '11:00'),
  timezone('America/New_York', (timezone('America/New_York', now())::date + 3)::timestamp + time '12:30'),
  'manual'
)
on conflict (id) do update set starts_at = excluded.starts_at, ends_at = excluded.ends_at;

insert into public.coach_intro_calls (
  id, coach_id, athlete_id, family_user_id, starts_at, minutes, format, status, answers
) values (
  'c0de000b-0000-4000-8000-000000000001',
  'a1111111-1111-4111-8111-111111111111',
  'b3333333-3333-4333-8333-333333333333',
  'b1111111-1111-4111-8111-111111111111',
  timezone('America/New_York', (timezone('America/New_York', now())::date + 4)::timestamp + time '18:00'),
  20, 'video', 'booked',
  '[{"q":"What is Casey working on?","a":"Starting from the back and claiming crosses."}]'::jsonb
)
on conflict (id) do update
set starts_at = excluded.starts_at, status = 'booked', answers = excluded.answers;

-- Extra channel (not the main community). Direct inserts need the RPC flag.
select set_config('app.coach_channel_rpc', 'on', true);

insert into public.conversations (
  id, created_by, is_group, title, last_message_text, last_message_at, owner_coach_id,
  channel_primary, channel_description
) values (
  'c0de000c-0000-4000-8000-000000000001',
  'b2222222-2222-4222-8222-222222222222',
  true, 'U17 keepers', 'Saturday is at Riverside turf.', now(),
  'a1111111-1111-4111-8111-111111111111', false,
  'Group sessions and updates for older keepers'
)
on conflict (id) do update
set title = excluded.title, channel_description = excluded.channel_description, last_message_at = now();

insert into public.conversation_participants (id, conversation_id, user_id, role)
values
  ('c0de000c-0000-4000-8000-000000000011', 'c0de000c-0000-4000-8000-000000000001',
   'b2222222-2222-4222-8222-222222222222', 'owner')
on conflict (conversation_id, user_id) do nothing;

insert into public.messages (id, conversation_id, sender_id, body, created_at)
values
  ('c0de000c-0000-4000-8000-000000000021', 'c5555555-5555-4555-8555-555555555555',
   'b2222222-2222-4222-8222-222222222222',
   'Monday is on Riverside turf, same time. Field 4 is closed for reseeding.', now() - interval '2 days'),
  ('c0de000c-0000-4000-8000-000000000022', 'c5555555-5555-4555-8555-555555555555',
   'b1111111-1111-4111-8111-111111111111',
   'Got it. I will be there at 3:50.', now() - interval '2 days' + interval '20 minutes'),
  ('c0de000c-0000-4000-8000-000000000023', 'c5555555-5555-4555-8555-555555555555',
   'b1111111-1111-4111-8111-111111111111',
   'Anything I should practice at home before Tuesday?', now() - interval '3 hours'),
  ('c0de000c-0000-4000-8000-000000000024', 'c0de000c-0000-4000-8000-000000000001',
   'b2222222-2222-4222-8222-222222222222',
   'Saturday is at Riverside turf. Handling and distribution.', now() - interval '1 day')
on conflict (id) do update set body = excluded.body;

update public.conversations
set last_message_text = 'Anything I should practice at home before Tuesday?',
    last_message_at = now() - interval '3 hours'
where id = 'c5555555-5555-4555-8555-555555555555';
