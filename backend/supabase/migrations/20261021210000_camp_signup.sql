-- Camp sign-up (groups, registrations without an account, card or direct pay, camp days on
-- My schedule). Camps stay coach_packages rows with kind = 'camp'.
--
-- Data
--   coach_packages     + camp_slug, camp_published_at, camp_cover_url, camp_included,
--                        camp_pay_direct, camp_linked_coach_id, camp_tags
--   camp_groups        1 to 4 per camp: name, description, time (half hours, 07:00-21:00), spots 1-60
--   camp_signups       one per form submit (siblings share it): payment and follow-up state
--   camp_registrations one per athlete: parent contact, athlete, group, status
--   package_purchases  + camp_signup_id: a paid camp Checkout is recorded as a package purchase
--                        so coach payouts (plan_package_transfers) work unchanged
--   coach_availability_slot_occurrences + camp_id, camp_group_id, camp_day_index: one group
--                        session per group per camp day, hidden from single-session booking
--
-- Capacity: camp_reserve() locks the camp row and the group rows (select ... for update) and
-- counts paid + held + unexpired pending_payment rows. Every insert path uses it. Legacy camp
-- purchases from the profile (create-package-payment, no group) still count against the camp's
-- total capacity.
--
-- Status: pending_payment (card Checkout open, hold_expires_at = Checkout expiry), held (pay the
-- coach directly: 7 days for families, no expiry when the coach added the athlete), paid,
-- cancelled (by the coach), expired (Checkout lapsed, superseded, or hold ran out).
--
-- Existing camps keep their purchase flow and fee; the backfill at the end gives each one a
-- slug and one group, and marks active ones published. Their schedule days are created the
-- next time the coach saves or publishes the camp.
-- Idempotent: safe to run more than once.

-- ---------------------------------------------------------------------------
-- 0. Objects from the first draft of this migration (never applied anywhere)
-- ---------------------------------------------------------------------------
drop function if exists public.hold_camp_registration(uuid, uuid, text, integer, text, text, text, text, boolean, text);
drop function if exists public.confirm_camp_registration(uuid);
drop function if exists public.list_camp_registrations(uuid);
drop function if exists public.mark_camp_registration(uuid, text);
drop function if exists public.add_camp_athlete(uuid, uuid, text, integer, text, boolean);
drop function if exists public.save_camp_groups(uuid, jsonb);
drop function if exists public.camp_registration_counts(text, timestamptz);
drop table if exists public.camp_days;
alter table public.coach_packages drop column if exists camp_direct;

-- ---------------------------------------------------------------------------
-- 1. Camp fields on coach_packages
-- ---------------------------------------------------------------------------
alter table public.coach_packages
  add column if not exists camp_slug text,
  add column if not exists camp_published_at timestamptz,
  add column if not exists camp_cover_url text,
  add column if not exists camp_included jsonb not null default '[]'::jsonb,
  add column if not exists camp_pay_direct boolean not null default false,
  add column if not exists camp_linked_coach_id uuid references public.coaches (id) on delete set null,
  add column if not exists camp_tags text[] not null default '{}';

alter table public.coach_packages drop constraint if exists coach_packages_camp_slug_check;
alter table public.coach_packages
  add constraint coach_packages_camp_slug_check
  check (camp_slug is null or (camp_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(camp_slug) <= 80));

alter table public.coach_packages drop constraint if exists coach_packages_camp_cover_check;
alter table public.coach_packages
  add constraint coach_packages_camp_cover_check
  check (camp_cover_url is null or (camp_cover_url ~ '^https://' and char_length(camp_cover_url) <= 1000));

alter table public.coach_packages drop constraint if exists coach_packages_camp_included_check;
alter table public.coach_packages
  add constraint coach_packages_camp_included_check
  check (case when jsonb_typeof(camp_included) = 'array' then jsonb_array_length(camp_included) <= 12 else false end);

alter table public.coach_packages drop constraint if exists coach_packages_camp_tags_check;
alter table public.coach_packages
  add constraint coach_packages_camp_tags_check
  check (cardinality(camp_tags) <= 6);

drop index if exists public.coach_packages_camp_slug_key;
create unique index coach_packages_camp_slug_key
  on public.coach_packages (coach_id, camp_slug)
  where camp_slug is not null;

comment on column public.coach_packages.camp_slug is 'Camp link: /camps/<coach slug>/<camp_slug>. Kept when the camp is renamed.';
comment on column public.coach_packages.camp_published_at is 'Set by publish_camp; null = draft or unpublished. The public page needs this and is_active.';
comment on column public.coach_packages.camp_pay_direct is 'Families from the coach''s own link (or his clients) may pay him directly; their spot is held until he marks it paid.';
comment on column public.coach_packages.camp_linked_coach_id is 'Another AthaNext coach shown on the camp page (for example a nutrition coach).';

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.camp_groups (
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references public.coach_packages (id) on delete cascade,
  name text not null,
  description text,
  start_time time not null,
  end_time time not null,
  spots integer not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint camp_groups_name_len check (char_length(btrim(name)) between 1 and 60),
  constraint camp_groups_description_len check (description is null or char_length(description) <= 280),
  constraint camp_groups_spots check (spots between 1 and 60),
  constraint camp_groups_times check (
    start_time >= time '07:00' and end_time <= time '21:00' and end_time > start_time
    and extract(second from start_time) = 0 and extract(second from end_time) = 0
    and extract(minute from start_time) in (0, 30) and extract(minute from end_time) in (0, 30)
  )
);

create index if not exists camp_groups_camp_idx on public.camp_groups (camp_id, sort_order);

create table if not exists public.camp_signups (
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references public.coach_packages (id) on delete cascade,
  coach_id uuid not null references public.coaches (id) on delete cascade,
  source text not null,
  pay_method text not null,
  parent_email text,
  ip_hash text,
  platform_waived boolean not null default false,
  stripe_session_id text,
  stripe_payment_intent text,
  checkout_expires_at timestamptz,
  amount_total_cents integer,
  purchase_id uuid references public.package_purchases (id) on delete set null,
  paid_at timestamptz,
  followup_at timestamptz,
  followup_claimed_at timestamptz,
  receipt_sent_at timestamptz,
  coach_notified_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint camp_signups_source check (source in ('link', 'marketplace', 'coach')),
  constraint camp_signups_pay check (pay_method in ('card', 'direct', 'outside')),
  constraint camp_signups_ip_len check (ip_hash is null or char_length(ip_hash) <= 128)
);

create unique index if not exists camp_signups_session_key
  on public.camp_signups (stripe_session_id) where stripe_session_id is not null;
create index if not exists camp_signups_ip_idx on public.camp_signups (ip_hash, created_at) where ip_hash is not null;
create index if not exists camp_signups_email_idx on public.camp_signups (lower(parent_email), created_at) where parent_email is not null;
create index if not exists camp_signups_followup_idx on public.camp_signups (paid_at) where paid_at is not null and followup_at is null;

comment on table public.camp_signups is
  'One camp sign-up form (siblings share it). Card Checkout, payment and the receipt/coach email follow-up state.';

create table if not exists public.camp_registrations (
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references public.coach_packages (id) on delete cascade,
  group_id uuid references public.camp_groups (id) on delete set null,
  signup_id uuid not null references public.camp_signups (id) on delete cascade,
  coach_id uuid not null references public.coaches (id) on delete cascade,
  parent_name text,
  parent_email text,
  parent_phone text,
  athlete_first_name text not null,
  athlete_last_name text not null default '',
  birth_year integer,
  note text,
  waiver_accepted_at timestamptz,
  photo_consent boolean not null default false,
  source text not null,
  pay_method text not null,
  status text not null,
  hold_expires_at timestamptz,
  stripe_session_id text,
  purchase_id uuid references public.package_purchases (id) on delete set null,
  price_cents integer not null,
  paid_at timestamptz,
  cancelled_at timestamptz,
  user_id uuid references auth.users (id) on delete set null,
  athlete_id uuid references public.athlete_profiles (id) on delete set null,
  finish_emailed_at timestamptz,
  details_emailed_at timestamptz,
  cancel_reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint camp_registrations_source check (source in ('link', 'marketplace', 'coach')),
  constraint camp_registrations_pay check (pay_method in ('card', 'direct', 'outside')),
  constraint camp_registrations_status check (status in ('pending_payment', 'held', 'paid', 'cancelled', 'expired')),
  constraint camp_registrations_first_len check (char_length(btrim(athlete_first_name)) between 1 and 60),
  constraint camp_registrations_last_len check (
    char_length(athlete_last_name) <= 60 and (source = 'coach' or char_length(btrim(athlete_last_name)) >= 1)
  ),
  constraint camp_registrations_parent_name_len check (parent_name is null or char_length(parent_name) between 1 and 120),
  constraint camp_registrations_email check (
    parent_email is null or (char_length(parent_email) <= 254 and parent_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  ),
  constraint camp_registrations_phone_len check (parent_phone is null or char_length(parent_phone) <= 30),
  constraint camp_registrations_note_len check (note is null or char_length(note) <= 500),
  constraint camp_registrations_birth_year check (birth_year is null or birth_year between 1940 and 2035),
  constraint camp_registrations_price check (price_cents >= 0),
  constraint camp_registrations_family_fields check (
    source = 'coach' or (parent_name is not null and parent_email is not null and waiver_accepted_at is not null and birth_year is not null)
  ),
  constraint camp_registrations_pending check (status <> 'pending_payment' or (pay_method = 'card' and hold_expires_at is not null))
);

alter table public.camp_registrations add column if not exists cancel_reason text;
alter table public.camp_registrations drop constraint if exists camp_registrations_cancel_reason;
alter table public.camp_registrations
  add constraint camp_registrations_cancel_reason check (cancel_reason is null or cancel_reason in ('coach', 'refunded', 'disputed'));
alter table public.camp_signups
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_status text,
  add column if not exists reversal_notified_at timestamptz;

create index if not exists camp_registrations_camp_idx on public.camp_registrations (camp_id, status);
create index if not exists camp_registrations_group_idx on public.camp_registrations (group_id, status);
create index if not exists camp_registrations_signup_idx on public.camp_registrations (signup_id);
create index if not exists camp_registrations_session_idx on public.camp_registrations (stripe_session_id) where stripe_session_id is not null;
create index if not exists camp_registrations_user_idx on public.camp_registrations (user_id) where user_id is not null;
create index if not exists camp_registrations_email_idx on public.camp_registrations (lower(parent_email)) where parent_email is not null;
create index if not exists camp_registrations_hold_idx
  on public.camp_registrations (hold_expires_at) where status in ('pending_payment', 'held') and hold_expires_at is not null;

-- One active spot per athlete per camp. Siblings (same parent email, different names) are fine.
drop index if exists public.camp_registrations_one_email;
create unique index if not exists camp_registrations_one_athlete
  on public.camp_registrations (camp_id, lower(parent_email), lower(btrim(athlete_first_name)), lower(btrim(athlete_last_name)))
  where parent_email is not null and status in ('pending_payment', 'held', 'paid');
create unique index if not exists camp_registrations_one_profile
  on public.camp_registrations (camp_id, athlete_id)
  where athlete_id is not null and status in ('pending_payment', 'held', 'paid');

alter table public.package_purchases
  add column if not exists camp_signup_id uuid references public.camp_signups (id) on delete set null;
comment on column public.package_purchases.camp_signup_id is
  'Set for camp sign-up Checkouts (camp-signup). Null for packages and for camps bought from the profile.';

drop trigger if exists camp_groups_updated_at on public.camp_groups;
create trigger camp_groups_updated_at before update on public.camp_groups
  for each row execute function public.set_updated_at();
drop trigger if exists camp_registrations_updated_at on public.camp_registrations;
create trigger camp_registrations_updated_at before update on public.camp_registrations
  for each row execute function public.set_updated_at();

alter table public.camp_groups enable row level security;
alter table public.camp_signups enable row level security;
alter table public.camp_registrations enable row level security;

-- Writes only go through the functions below.
revoke all on public.camp_groups from anon, authenticated;
revoke all on public.camp_signups from anon, authenticated;
revoke all on public.camp_registrations from anon, authenticated;
grant select on public.camp_groups to authenticated;
grant select on public.camp_registrations to authenticated;

drop policy if exists "Coaches manage their camp groups" on public.camp_groups;
drop policy if exists "Coaches read their camp groups" on public.camp_groups;
create policy "Coaches read their camp groups"
  on public.camp_groups for select to authenticated
  using (exists (
    select 1 from public.coach_packages as pkg
    where pkg.id = camp_id and pkg.coach_id = public.current_coach_id()
  ));

drop policy if exists "Coaches read their camp registrations" on public.camp_registrations;
create policy "Coaches read their camp registrations"
  on public.camp_registrations for select to authenticated
  using (coach_id = public.current_coach_id());

drop policy if exists "Families read their camp registrations" on public.camp_registrations;
create policy "Families read their camp registrations"
  on public.camp_registrations for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------
-- Camps run on Eastern time, like the rest of the schedule.
create or replace function public.camp_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/New_York')::date;
$$;

-- Does this registration take a spot right now?
create or replace function public.camp_reg_holds_spot(p_status text, p_hold_expires_at timestamptz)
returns boolean
language sql
stable
as $$
  select p_status = 'paid'
    or (p_status in ('held', 'pending_payment') and (p_hold_expires_at is null or p_hold_expires_at > now()));
$$;

create or replace function public.camp_group_taken(p_group_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.camp_registrations as reg
  where reg.group_id = p_group_id
    and public.camp_reg_holds_spot(reg.status, reg.hold_expires_at);
$$;

-- Spots taken in the whole camp: registrations plus camps bought from the profile
-- (create-package-payment) before or outside the sign-up page.
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
      and purchase.status in ('active', 'expired', 'completed')
  );
$$;

-- Null when the camp has no capacity. Used by create-package-payment's profile flow.
create or replace function public.camp_spots_left(p_camp_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when pkg.camp_capacity is null then null
    else greatest(0, pkg.camp_capacity - public.camp_taken(pkg.id))
  end
  from public.coach_packages as pkg
  where pkg.id = p_camp_id;
$$;

-- Takes one spot per entry of p_group_ids (a group listed twice takes two), or raises.
-- Locks the camp row first, then the groups in id order, so concurrent sign-ups queue.
create or replace function public.camp_reserve(p_camp_id uuid, p_group_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity integer;
  v_need record;
  v_group public.camp_groups%rowtype;
begin
  select pkg.camp_capacity into v_capacity
  from public.coach_packages as pkg
  where pkg.id = p_camp_id and pkg.kind = 'camp'
  for update;
  if not found then
    raise exception 'Camp not found' using errcode = 'P0002', hint = 'camp_missing';
  end if;
  if coalesce(cardinality(p_group_ids), 0) = 0 then
    return;
  end if;

  for v_need in
    select gid, count(*)::integer as n
    from unnest(p_group_ids) as gid
    group by gid
    order by gid
  loop
    select * into v_group
    from public.camp_groups
    where id = v_need.gid and camp_id = p_camp_id
    for update;
    if not found then
      raise exception 'Pick a group for each athlete' using errcode = '22023', hint = 'group_missing';
    end if;
    if public.camp_group_taken(v_group.id) + v_need.n > v_group.spots then
      raise exception '% is fully booked', v_group.name using errcode = 'P0001', hint = 'group_full';
    end if;
  end loop;

  if v_capacity is not null and public.camp_taken(p_camp_id) + cardinality(p_group_ids) > v_capacity then
    raise exception 'This camp is fully booked' using errcode = 'P0001', hint = 'camp_full';
  end if;
end;
$$;

create or replace function public.camp_slugify(p_text text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      btrim(left(
        btrim(
          regexp_replace(
            lower(translate(coalesce(p_text, ''),
              'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝýÿÑñÇç',
              'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOOooooooUUUUuuuuYyyNnCc')),
            '[^a-z0-9]+', '-', 'g'),
          '-'),
        60), '-'),
      ''),
    'camp');
$$;

-- A slug not used by the coach's other camps: name, name-2, name-3...
create or replace function public.camp_unique_slug(p_coach_id uuid, p_text text, p_camp_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_base text := btrim(public.camp_slugify(p_text), '-');
  v_slug text;
  v_n integer := 1;
begin
  if v_base = '' then
    v_base := 'camp';
  end if;
  v_slug := v_base;
  while exists (
    select 1 from public.coach_packages
    where coach_id = p_coach_id and camp_slug = v_slug and id is distinct from p_camp_id
  ) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  return v_slug;
end;
$$;

-- An email counts as the coach's client: a confirmed referral, an account whose athlete has
-- booked with him, or a family that already paid for one of his camps from his link or him.
create or replace function public.camp_email_is_client(p_coach_id uuid, p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(btrim(p_email), '') <> '' and (
    exists (
      select 1 from public.coach_client_referrals as r
      where r.coach_id = p_coach_id and lower(r.client_email) = lower(btrim(p_email)) and r.status = 'confirmed'
    )
    or exists (
      select 1
      from public.user_profiles as up
      join public.athlete_profiles as athlete on athlete.id = up.athlete_id or athlete.user_id = up.id
      where lower(up.email) = lower(btrim(p_email))
        and public.is_coach_client(p_coach_id, athlete.id)
    )
    or exists (
      select 1 from public.camp_registrations as reg
      where reg.coach_id = p_coach_id and lower(reg.parent_email) = lower(btrim(p_email))
        and reg.status = 'paid' and reg.source in ('link', 'coach')
    )
  );
$$;

-- Something happened on this schedule row (bookings, roll call, feedback, scores).
create or replace function public.camp_occurrence_has_history(p_occurrence_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.slot_attendance_v2 where slot_id = p_occurrence_id)
    or exists (select 1 from public.slot_feedback_v2 where slot_id = p_occurrence_id)
    or exists (select 1 from public.session_feedback_v2 where slot_id = p_occurrence_id)
    or exists (select 1 from public.session_scores where slot_id = p_occurrence_id)
    or exists (select 1 from public.coach_slot_bookings where occurrence_id = p_occurrence_id)
    or exists (select 1 from public.payments where slot_id = p_occurrence_id);
$$;

-- Read the camp-shaped JSON every coach view uses.
create or replace function public.camp_json(p_camp_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', pkg.id,
    'coach_id', pkg.coach_id,
    'name', pkg.package_name,
    'description', pkg.description,
    'price_cents', pkg.total_price,
    'starts_on', pkg.camp_starts_on,
    'ends_on', pkg.camp_ends_on,
    'days', case when pkg.camp_starts_on is null or pkg.camp_ends_on is null then null
                 else pkg.camp_ends_on - pkg.camp_starts_on + 1 end,
    'location', pkg.camp_location,
    'capacity', pkg.camp_capacity,
    'taken', public.camp_taken(pkg.id),
    'slug', pkg.camp_slug,
    'coach_slug', coach.slug,
    'cover_url', pkg.camp_cover_url,
    'included', pkg.camp_included,
    'tags', to_jsonb(pkg.camp_tags),
    'pay_direct', pkg.camp_pay_direct,
    'linked_coach', case when linked.id is null then null else jsonb_build_object(
      'id', linked.id, 'name', linked.name, 'slug', linked.slug,
      'photo_url', nullif(btrim(coalesce(linked.profile_image_url, linked.image_url, '')), '')
    ) end,
    'co_coach_ids', to_jsonb(pkg.co_coach_ids),
    'age_min', pkg.camp_age_min,
    'age_max', pkg.camp_age_max,
    'is_active', pkg.is_active,
    'published', pkg.camp_published_at is not null and pkg.is_active,
    'published_at', pkg.camp_published_at,
    'created_at', pkg.created_at,
    'updated_at', pkg.updated_at,
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', grp.id,
        'name', grp.name,
        'description', grp.description,
        'start_time', to_char(grp.start_time, 'HH24:MI'),
        'end_time', to_char(grp.end_time, 'HH24:MI'),
        'spots', grp.spots,
        'taken', public.camp_group_taken(grp.id),
        'sort_order', grp.sort_order
      ) order by grp.sort_order, grp.created_at)
      from public.camp_groups as grp
      where grp.camp_id = pkg.id
    ), '[]'::jsonb)
  )
  from public.coach_packages as pkg
  join public.coaches as coach on coach.id = pkg.coach_id
  left join public.coaches as linked on linked.id = pkg.camp_linked_coach_id and linked.deactivated_at is null
  where pkg.id = p_camp_id and pkg.kind = 'camp';
$$;

revoke all on function public.camp_today() from public;
revoke all on function public.camp_reg_holds_spot(text, timestamptz) from public;
revoke all on function public.camp_group_taken(uuid) from public, anon, authenticated;
revoke all on function public.camp_taken(uuid) from public, anon, authenticated;
revoke all on function public.camp_spots_left(uuid) from public, anon, authenticated;
grant execute on function public.camp_spots_left(uuid) to service_role;
revoke all on function public.camp_reserve(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.camp_unique_slug(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.camp_email_is_client(uuid, text) from public, anon, authenticated;
revoke all on function public.camp_occurrence_has_history(uuid) from public, anon, authenticated;
revoke all on function public.camp_json(uuid) from public, anon, authenticated;
grant execute on function public.camp_today() to anon, authenticated, service_role;
grant execute on function public.camp_reg_holds_spot(text, timestamptz) to anon, authenticated, service_role;

-- A group with athletes holding a spot can't be deleted (deleting the whole camp still can).
create or replace function public.camp_groups_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.camp_groups where camp_id = new.camp_id) >= 4 then
      raise exception 'A camp can have up to 4 groups' using errcode = '22023', hint = 'too_many_groups';
    end if;
    return new;
  end if;
  -- A cascade from deleting the camp: the camp row is already gone.
  if not exists (select 1 from public.coach_packages where id = old.camp_id) then
    return old;
  end if;
  if exists (
    select 1 from public.camp_registrations as reg
    where reg.group_id = old.id and public.camp_reg_holds_spot(reg.status, reg.hold_expires_at)
  ) then
    raise exception '% has athletes signed up. Move or cancel them first.', old.name
      using errcode = '23503', hint = 'group_has_athletes';
  end if;
  return old;
end;
$$;

revoke all on function public.camp_groups_guard() from public, anon, authenticated;

drop trigger if exists camp_groups_guard on public.camp_groups;
create trigger camp_groups_guard
  before insert or delete on public.camp_groups
  for each row execute function public.camp_groups_guard();

-- ---------------------------------------------------------------------------
-- 4. Public camp page (no login)
-- ---------------------------------------------------------------------------
-- Published and active camps only. Works for unlisted coaches (it is their own link).
-- Never returns other families' data: only counts.
create or replace function public.get_camp_page(p_coach_slug text, p_camp_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', pkg.id,
    'name', pkg.package_name,
    'description', pkg.description,
    'tags', to_jsonb(pkg.camp_tags),
    'cover_url', coalesce(pkg.camp_cover_url, nullif(btrim(coalesce(coach.profile_image_url, coach.image_url, '')), '')),
    'cover_is_coach_photo', pkg.camp_cover_url is null,
    'price_cents', pkg.total_price,
    'days', pkg.camp_ends_on - pkg.camp_starts_on + 1,
    'per_day_cents', round(pkg.total_price::numeric / greatest(1, pkg.camp_ends_on - pkg.camp_starts_on + 1))::integer,
    'starts_on', pkg.camp_starts_on,
    'ends_on', pkg.camp_ends_on,
    'location', pkg.camp_location,
    'included', pkg.camp_included,
    'age_min', pkg.camp_age_min,
    'age_max', pkg.camp_age_max,
    'pay_direct', pkg.camp_pay_direct,
    'open', pkg.camp_ends_on >= public.camp_today(),
    'spots_left', case when pkg.camp_capacity is null then null
                       else greatest(0, pkg.camp_capacity - public.camp_taken(pkg.id)) end,
    'coach', jsonb_build_object(
      'id', coach.id,
      'name', coach.name,
      'slug', coach.slug,
      'photo_url', nullif(btrim(coalesce(coach.profile_image_url, coach.image_url, '')), ''),
      'bio', coach.bio,
      'years_experience', coach.years_experience,
      'rating', coach.rating,
      'total_reviews', coach.total_reviews,
      'cancellation_policy', coach.cancellation_policy
    ),
    'linked_coach', case when linked.id is null then null else jsonb_build_object(
      'id', linked.id,
      'name', linked.name,
      'slug', linked.slug,
      'photo_url', nullif(btrim(coalesce(linked.profile_image_url, linked.image_url, '')), '')
    ) end,
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'description', g.description,
        'start_time', to_char(g.start_time, 'HH24:MI'),
        'end_time', to_char(g.end_time, 'HH24:MI'),
        'spots', g.spots,
        'spots_left', g.spots_left,
        'full', g.spots_left <= 0
      ) order by g.sort_order, g.created_at)
      from (
        select grp.*,
          least(
            greatest(0, grp.spots - public.camp_group_taken(grp.id)),
            case when pkg.camp_capacity is null then grp.spots
                 else greatest(0, pkg.camp_capacity - public.camp_taken(pkg.id)) end
          ) as spots_left
        from public.camp_groups as grp
        where grp.camp_id = pkg.id
      ) as g
    ), '[]'::jsonb)
  )
  from public.coaches as coach
  join public.coach_packages as pkg on pkg.coach_id = coach.id
  left join public.coaches as linked on linked.id = pkg.camp_linked_coach_id and linked.deactivated_at is null
  where coach.slug = p_coach_slug
    and coach.deactivated_at is null
    and pkg.kind = 'camp'
    and pkg.camp_slug = p_camp_slug
    and pkg.is_active
    and pkg.camp_published_at is not null
    and pkg.camp_starts_on is not null
    and pkg.camp_ends_on is not null
  limit 1;
$$;

revoke all on function public.get_camp_page(text, text) from public;
grant execute on function public.get_camp_page(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Family sign-up (called by the camp-signup edge function with the service role)
-- ---------------------------------------------------------------------------
-- p: { camp_id, source: link|marketplace, pay_method: card|direct, ip_hash,
--      parent: { name, email, phone }, note, waiver: true, photo_consent,
--      athletes: [{ first_name, last_name, birth_year, group_id, note? }] (1 to 6),
--      hold_minutes (card: until the Checkout is created, default 40),
--      limits: { per_ip_hour, per_email_hour, direct_per_email } }
-- Card: rows are pending_payment with a short hold. Direct: rows are held for 7 days.
-- Errors carry a hint the edge function maps to a status code.
create or replace function public.camp_signup_start(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_camp public.coach_packages%rowtype;
  v_coach public.coaches%rowtype;
  v_source text := p->>'source';
  v_pay text := p->>'pay_method';
  v_parent_name text := btrim(coalesce(p->'parent'->>'name', ''));
  v_email text := lower(btrim(coalesce(p->'parent'->>'email', '')));
  v_phone text := nullif(btrim(coalesce(p->'parent'->>'phone', '')), '');
  v_note text := nullif(btrim(coalesce(p->>'note', '')), '');
  v_ip text := nullif(btrim(coalesce(p->>'ip_hash', '')), '');
  v_hold_minutes integer := 40;
  v_per_ip integer := 5;
  v_per_email integer := 5;
  v_direct_per_email integer := 3;
  v_year integer := extract(year from now())::integer;
  v_athletes jsonb := p->'athletes';
  v_athlete jsonb;
  v_first text;
  v_last text;
  v_year_txt text;
  v_group uuid;
  v_groups uuid[] := '{}';
  v_names text[] := '{}';
  v_key text;
  v_is_client boolean;
  v_waived boolean;
  v_superseded text[];
  v_signup uuid;
  v_status text;
  v_hold timestamptz;
  v_ids uuid[] := '{}';
  v_id uuid;
begin
  if v_source is null or v_source not in ('link', 'marketplace') then
    raise exception 'Unknown sign-up source' using errcode = '22023', hint = 'invalid';
  end if;
  if v_pay is null or v_pay not in ('card', 'direct') then
    raise exception 'Choose how to pay' using errcode = '22023', hint = 'invalid';
  end if;
  if coalesce(p->>'hold_minutes', '') ~ '^\d{1,3}$' then
    v_hold_minutes := least(60, greatest(31, (p->>'hold_minutes')::integer));
  end if;
  if coalesce(p->'limits'->>'per_ip_hour', '') ~ '^\d{1,3}$' then
    v_per_ip := (p->'limits'->>'per_ip_hour')::integer;
  end if;
  if coalesce(p->'limits'->>'per_email_hour', '') ~ '^\d{1,3}$' then
    v_per_email := (p->'limits'->>'per_email_hour')::integer;
  end if;
  if coalesce(p->'limits'->>'direct_per_email', '') ~ '^\d{1,3}$' then
    v_direct_per_email := (p->'limits'->>'direct_per_email')::integer;
  end if;

  if char_length(v_parent_name) not between 1 and 120 then
    raise exception 'Add your name' using errcode = '22023', hint = 'invalid';
  end if;
  if char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Add an email we can send the receipt to' using errcode = '22023', hint = 'invalid';
  end if;
  if v_phone is not null and v_phone !~ '^[0-9+()\-. ]{7,30}$' then
    raise exception 'Add a phone number, like 555 123 4567' using errcode = '22023', hint = 'invalid';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Keep the note under 500 characters' using errcode = '22023', hint = 'invalid';
  end if;
  if coalesce((p->>'waiver')::boolean, false) is not true then
    raise exception 'Agree to the waiver to continue' using errcode = '22023', hint = 'invalid';
  end if;
  if (case when jsonb_typeof(v_athletes) = 'array' then jsonb_array_length(v_athletes) else 0 end) not between 1 and 6 then
    raise exception 'Add between 1 and 6 athletes' using errcode = '22023', hint = 'invalid';
  end if;

  for v_athlete in select value from jsonb_array_elements(v_athletes) loop
    v_first := btrim(coalesce(v_athlete->>'first_name', ''));
    v_last := btrim(coalesce(v_athlete->>'last_name', ''));
    v_year_txt := btrim(coalesce(v_athlete->>'birth_year', ''));
    if char_length(v_first) not between 1 and 60 then
      raise exception 'Add a first name' using errcode = '22023', hint = 'invalid';
    end if;
    if char_length(v_last) not between 1 and 60 then
      raise exception 'Add a last name' using errcode = '22023', hint = 'invalid';
    end if;
    if v_year_txt !~ '^\d{4}$' or v_year_txt::integer not between v_year - 80 and v_year - 2 then
      raise exception 'Add a birth year, like 2013' using errcode = '22023', hint = 'invalid';
    end if;
    if coalesce(v_athlete->>'note', '') <> '' and char_length(v_athlete->>'note') > 500 then
      raise exception 'Keep the note under 500 characters' using errcode = '22023', hint = 'invalid';
    end if;
    v_group := case
      when coalesce(v_athlete->>'group_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (v_athlete->>'group_id')::uuid
    end;
    if v_group is null then
      raise exception 'Pick a group for each athlete' using errcode = '22023', hint = 'invalid';
    end if;
    v_key := lower(v_first) || ' ' || lower(v_last);
    if v_key = any (v_names) then
      raise exception '% is on the form twice', v_first using errcode = '22023', hint = 'invalid';
    end if;
    v_names := v_names || v_key;
    v_groups := v_groups || v_group;
  end loop;

  -- Lock the camp: sign-ups for one camp run one at a time from here.
  if coalesce(p->>'camp_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into v_camp from public.coach_packages
    where id = (p->>'camp_id')::uuid and kind = 'camp'
    for update;
  end if;
  if v_camp.id is null then
    raise exception 'This camp is not taking sign-ups' using errcode = 'P0002', hint = 'closed';
  end if;
  select * into v_coach from public.coaches where id = v_camp.coach_id;
  if not v_camp.is_active or v_camp.camp_published_at is null or v_coach.deactivated_at is not null
     or v_camp.camp_ends_on is null or v_camp.camp_ends_on < public.camp_today() then
    raise exception 'This camp is not taking sign-ups' using errcode = 'P0002', hint = 'closed';
  end if;

  -- Tidy this camp's lapsed holds so they don't block the unique index below.
  update public.camp_registrations
    set status = 'expired'
    where camp_id = v_camp.id and status in ('pending_payment', 'held')
      and hold_expires_at is not null and hold_expires_at <= now();

  -- Rate limits.
  if v_ip is not null and (
    select count(*) from public.camp_signups
    where ip_hash = v_ip and created_at > now() - interval '1 hour' and source in ('link', 'marketplace')
  ) >= v_per_ip then
    raise exception 'Too many sign-ups from this device. Try again in an hour.' using errcode = 'P0001', hint = 'rate_ip';
  end if;
  if (
    select count(*) from public.camp_signups
    where lower(parent_email) = v_email and created_at > now() - interval '1 hour' and source in ('link', 'marketplace')
  ) >= v_per_email then
    raise exception 'Too many sign-ups for this email. Try again in an hour.' using errcode = 'P0001', hint = 'rate_email';
  end if;

  v_is_client := public.camp_email_is_client(v_camp.coach_id, v_email);
  v_waived := v_source = 'link' or v_is_client;

  if v_pay = 'direct' then
    if not v_camp.camp_pay_direct or not v_waived then
      raise exception 'Pay by card to hold this spot' using errcode = '22023', hint = 'direct_not_allowed';
    end if;
    if (
      select count(distinct reg.signup_id) from public.camp_registrations as reg
      where reg.camp_id = v_camp.id and lower(reg.parent_email) = v_email
        and reg.status = 'held' and reg.pay_method = 'direct'
    ) >= v_direct_per_email then
      raise exception 'This email already has spots waiting for payment. Pay the coach for those first.'
        using errcode = 'P0001', hint = 'rate_direct';
    end if;
  end if;

  -- A new attempt replaces this family's unpaid Checkout for the same camp.
  with superseded as (
    update public.camp_registrations
      set status = 'expired'
      where camp_id = v_camp.id and lower(parent_email) = v_email and status = 'pending_payment'
      returning stripe_session_id
  )
  select coalesce(array_agg(distinct stripe_session_id) filter (where stripe_session_id is not null), '{}')
    into v_superseded from superseded;

  perform public.camp_reserve(v_camp.id, v_groups);

  if v_pay = 'card' then
    v_status := 'pending_payment';
    v_hold := now() + make_interval(mins => v_hold_minutes);
  else
    v_status := 'held';
    v_hold := now() + interval '7 days';
  end if;

  insert into public.camp_signups (camp_id, coach_id, source, pay_method, parent_email, ip_hash, platform_waived)
  values (v_camp.id, v_camp.coach_id, v_source, v_pay, v_email, v_ip, v_waived)
  returning id into v_signup;

  begin
    for v_athlete in select value from jsonb_array_elements(v_athletes) loop
      insert into public.camp_registrations (
        camp_id, group_id, signup_id, coach_id, parent_name, parent_email, parent_phone,
        athlete_first_name, athlete_last_name, birth_year, note, waiver_accepted_at, photo_consent,
        source, pay_method, status, hold_expires_at, price_cents
      ) values (
        v_camp.id, (v_athlete->>'group_id')::uuid, v_signup, v_camp.coach_id, v_parent_name, v_email, v_phone,
        btrim(v_athlete->>'first_name'), btrim(v_athlete->>'last_name'), (v_athlete->>'birth_year')::integer,
        coalesce(nullif(btrim(coalesce(v_athlete->>'note', '')), ''), v_note), now(),
        coalesce((p->>'photo_consent')::boolean, false),
        v_source, v_pay, v_status, v_hold, v_camp.total_price
      )
      returning id into v_id;
      v_ids := v_ids || v_id;
    end loop;
  exception when unique_violation then
    raise exception 'One of these athletes already has a spot at this camp' using errcode = '23505', hint = 'duplicate';
  end;

  return jsonb_build_object(
    'signup_id', v_signup,
    'registration_ids', to_jsonb(v_ids),
    'status', v_status,
    'hold_expires_at', v_hold,
    'platform_waived', v_waived,
    'is_client', v_is_client,
    'superseded_sessions', to_jsonb(v_superseded),
    'camp', jsonb_build_object(
      'id', v_camp.id,
      'name', v_camp.package_name,
      'price_cents', v_camp.total_price,
      'starts_on', v_camp.camp_starts_on,
      'ends_on', v_camp.camp_ends_on,
      'location', v_camp.camp_location,
      'slug', v_camp.camp_slug,
      'coach_id', v_coach.id,
      'coach_name', v_coach.name,
      'coach_slug', v_coach.slug,
      'coach_email', v_coach.email
    ),
    'athletes', (
      select jsonb_agg(jsonb_build_object(
        'id', reg.id, 'first_name', reg.athlete_first_name, 'last_name', reg.athlete_last_name,
        'group_name', grp.name, 'start_time', to_char(grp.start_time, 'HH24:MI'), 'end_time', to_char(grp.end_time, 'HH24:MI')
      ) order by reg.created_at, reg.id)
      from public.camp_registrations as reg
      left join public.camp_groups as grp on grp.id = reg.group_id
      where reg.signup_id = v_signup
    )
  );
end;
$$;

-- The Checkout exists: the hold now lasts until it expires (plus 2 minutes for clock drift).
create or replace function public.camp_signup_attach_session(p_signup_id uuid, p_session_id text, p_expires_at timestamptz)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  update public.camp_signups
    set stripe_session_id = p_session_id, checkout_expires_at = p_expires_at
    where id = p_signup_id;
  update public.camp_registrations
    set stripe_session_id = p_session_id, hold_expires_at = p_expires_at + interval '2 minutes'
    where signup_id = p_signup_id and status = 'pending_payment';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- The Checkout could not be created: give the spots back.
create or replace function public.camp_signup_release(p_signup_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  update public.camp_registrations
    set status = 'expired'
    where signup_id = p_signup_id and status = 'pending_payment';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Paid Checkout (webhook checkout.session.completed, or the "You're in" page checking Stripe).
-- Marks exactly the registrations of this sign-up paid, in one transaction, and records the
-- payment as one package_purchases row (camp_signup_id set) so the coach's payout is planned
-- like a package. Safe to repeat. A registration whose hold already lapsed gets its spot back
-- when there is room; otherwise it is listed in without_spot (refund by hand).
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

  -- Same lock order as sign-up: camp row first.
  select * into v_camp from public.coach_packages where id = v_signup.camp_id for update;

  update public.camp_signups
    set stripe_session_id = coalesce(stripe_session_id, p_session_id),
        stripe_payment_intent = coalesce(nullif(p_payment_intent, ''), stripe_payment_intent),
        amount_total_cents = coalesce(p_amount_total_cents, amount_total_cents),
        paid_at = coalesce(paid_at, now())
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
    -- Hold lapsed (or the Checkout was superseded): take a spot again if there is one.
    -- Cancelled by the coach: never re-activated.
    if v_reg.status in ('pending_payment', 'expired') and v_reg.group_id is not null then
      begin
        perform public.camp_reserve(v_camp.id, array[v_reg.group_id]);
        update public.camp_registrations
          set status = 'paid', paid_at = now(), hold_expires_at = null, stripe_session_id = p_session_id
          where id = v_reg.id;
        v_newly := v_newly || v_reg.id;
        continue;
      exception when others then
        null;
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

  select id into v_purchase from public.package_purchases where stripe_session_id = p_session_id;
  if v_purchase is null and v_paid_count > 0 then
    insert into public.package_purchases (
      coach_id, package_id, user_id, source, sessions_total, sessions_remaining, status,
      purchase_date, expiry_date, total_amount, stripe_session_id, stripe_payment_intent,
      payment_intent_id, camp_signup_id
    ) values (
      v_camp.coach_id, v_camp.id, null, 'package', 1, 0, 'active',
      now(), coalesce((v_camp.camp_ends_on + 1)::timestamptz, now() + interval '1 year'),
      -- Payouts use the list price; platform and card fees stay with AthaNext.
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

-- A camp charge fully refunded or disputed (webhook charge.refunded / charge.dispute.*):
-- the sign-up's paid card registrations are cancelled (cancel_reason refunded or disputed), which
-- frees their spots, and the coach's planned payout is voided, or marked reversing when it was
-- already sent (stripe-payouts reverses those), the same way bookings are. Partial refunds change
-- nothing here. Safe to repeat: newly = false after the first call.
create or replace function public.camp_charge_reversed(p_payment_intent text, p_charge_id text, p_status text, p_full boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_signup public.camp_signups%rowtype;
  v_cancelled integer := 0;
  v_voided integer := 0;
  v_reversing integer := 0;
  v_newly boolean;
begin
  if p_status not in ('refunded', 'disputed') then
    raise exception 'Unknown reverse status' using errcode = '22023';
  end if;
  select s.* into v_signup
  from public.camp_signups as s
  left join public.package_purchases as purchase on purchase.id = s.purchase_id
  where (coalesce(p_payment_intent, '') <> '' and s.stripe_payment_intent = p_payment_intent)
     or (coalesce(p_charge_id, '') <> '' and purchase.stripe_charge_id = p_charge_id)
  limit 1;
  if not found then
    return jsonb_build_object('found', false);
  end if;
  if not p_full then
    return jsonb_build_object('found', true, 'partial', true, 'signup_id', v_signup.id, 'camp_id', v_signup.camp_id);
  end if;

  perform 1 from public.coach_packages where id = v_signup.camp_id for update;
  select * into v_signup from public.camp_signups where id = v_signup.id for update;
  v_newly := v_signup.reversed_at is null;

  update public.camp_registrations
    set status = 'cancelled', cancelled_at = now(), hold_expires_at = null, cancel_reason = p_status
    where signup_id = v_signup.id and pay_method = 'card' and status = 'paid';
  get diagnostics v_cancelled = row_count;

  if v_signup.purchase_id is not null then
    update public.payout_transfers
      set status = 'void', error = null
      where package_purchase_id = v_signup.purchase_id and status in ('held', 'waiting', 'failed');
    get diagnostics v_voided = row_count;
    update public.payout_transfers
      set status = 'reversing', error = null
      where package_purchase_id = v_signup.purchase_id and status = 'sent' and stripe_transfer_id is not null;
    get diagnostics v_reversing = row_count;
    update public.package_purchases
      set revoked_at = coalesce(revoked_at, now()),
          admin_note = coalesce(admin_note, 'Camp charge ' || p_status)
      where id = v_signup.purchase_id;
  end if;

  update public.camp_signups
    set reversed_at = coalesce(reversed_at, now()), reversed_status = coalesce(reversed_status, p_status)
    where id = v_signup.id;

  return jsonb_build_object(
    'found', true,
    'partial', false,
    'newly', v_newly,
    'signup_id', v_signup.id,
    'camp_id', v_signup.camp_id,
    'coach_id', v_signup.coach_id,
    'cancelled', v_cancelled,
    'voided_transfers', v_voided,
    'reversing_transfers', v_reversing,
    'coach_notified', v_signup.reversal_notified_at is not null
  );
end;
$$;

-- Checkout expired (webhook checkout.session.expired): free its spots.
create or replace function public.camp_release_checkout(p_session_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  update public.camp_registrations
    set status = 'expired'
    where stripe_session_id = p_session_id and status = 'pending_payment';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Every 10 minutes: unpaid Checkouts 15 minutes past their expiry, and direct-pay holds the
-- coach never marked paid. Spots already stopped counting at hold_expires_at; this tidies status.
create or replace function public.release_stale_camp_holds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
  v_m integer;
begin
  update public.camp_registrations
    set status = 'expired'
    where status = 'pending_payment' and hold_expires_at < now() - interval '15 minutes';
  get diagnostics v_n = row_count;
  update public.camp_registrations
    set status = 'expired'
    where status = 'held' and hold_expires_at is not null and hold_expires_at < now();
  get diagnostics v_m = row_count;
  return v_n + v_m;
end;
$$;

-- For the "You're in" page: the sign-up id is the secret from the family's own redirect.
create or replace function public.camp_signup_status(p_signup_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'signup_id', s.id,
    'pay_method', s.pay_method,
    'stripe_session_id', s.stripe_session_id,
    'parent_email', s.parent_email,
    'account_exists', exists (select 1 from public.user_profiles as up where lower(up.email) = lower(s.parent_email)),
    'camp', jsonb_build_object(
      'id', pkg.id, 'name', pkg.package_name, 'starts_on', pkg.camp_starts_on, 'ends_on', pkg.camp_ends_on,
      'location', pkg.camp_location, 'slug', pkg.camp_slug, 'included', pkg.camp_included,
      'coach_name', coach.name, 'coach_slug', coach.slug
    ),
    'athletes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', reg.id, 'first_name', reg.athlete_first_name, 'status', reg.status,
        'group_name', grp.name, 'start_time', to_char(grp.start_time, 'HH24:MI'), 'end_time', to_char(grp.end_time, 'HH24:MI')
      ) order by reg.created_at, reg.id)
      from public.camp_registrations as reg
      left join public.camp_groups as grp on grp.id = reg.group_id
      where reg.signup_id = s.id
    ), '[]'::jsonb),
    'all_paid', not exists (select 1 from public.camp_registrations where signup_id = s.id and status <> 'paid'),
    'any_pending', exists (
      select 1 from public.camp_registrations
      where signup_id = s.id and status = 'pending_payment' and hold_expires_at > now()
    )
  )
  from public.camp_signups as s
  join public.coach_packages as pkg on pkg.id = s.camp_id
  join public.coaches as coach on coach.id = pkg.coach_id
  where s.id = p_signup_id and s.source in ('link', 'marketplace');
$$;

-- Review step: the price for the link the family came from (coach's link or marketplace).
-- It never looks at the email, so it can't tell anyone who the coach's clients are; a client's
-- lower price is worked out at sign-up and shown on the Checkout.
drop function if exists public.camp_quote(uuid, text, text);
create or replace function public.camp_quote(p_camp_id uuid, p_source text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'camp_id', pkg.id,
    'price_cents', pkg.total_price,
    'platform_waived', w.waived,
    'direct_allowed', pkg.camp_pay_direct and w.waived
  )
  from public.coach_packages as pkg
  cross join lateral (
    select p_source = 'link' as waived
  ) as w
  where pkg.id = p_camp_id and pkg.kind = 'camp' and pkg.is_active and pkg.camp_published_at is not null;
$$;

revoke all on function public.camp_signup_start(jsonb) from public, anon, authenticated;
revoke all on function public.camp_quote(uuid, text) from public, anon, authenticated;
grant execute on function public.camp_quote(uuid, text) to service_role;
revoke all on function public.camp_signup_attach_session(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.camp_signup_release(uuid) from public, anon, authenticated;
revoke all on function public.camp_checkout_paid(text, text, uuid, uuid[], integer) from public, anon, authenticated;
revoke all on function public.camp_release_checkout(text) from public, anon, authenticated;
revoke all on function public.camp_charge_reversed(text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.camp_charge_reversed(text, text, text, boolean) to service_role;
revoke all on function public.release_stale_camp_holds() from public, anon, authenticated;
revoke all on function public.camp_signup_status(uuid) from public, anon, authenticated;
grant execute on function public.camp_signup_start(jsonb) to service_role;
grant execute on function public.camp_signup_attach_session(uuid, text, timestamptz) to service_role;
grant execute on function public.camp_signup_release(uuid) to service_role;
grant execute on function public.camp_checkout_paid(text, text, uuid, uuid[], integer) to service_role;
grant execute on function public.camp_release_checkout(text) to service_role;
grant execute on function public.release_stale_camp_holds() to service_role;
grant execute on function public.camp_signup_status(uuid) to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'release-camp-holds';
select cron.schedule('release-camp-holds', '*/10 * * * *', $$select public.release_stale_camp_holds()$$);

-- ---------------------------------------------------------------------------
-- 6. Family account linking and portal
-- ---------------------------------------------------------------------------
-- After sign-up or sign-in: links registrations whose parent email is the caller's CONFIRMED
-- sign-in email, and links (or creates) an athlete profile on this account for each athlete.
create or replace function public.claim_camp_registrations()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_reg record;
  v_athlete uuid;
  v_full text;
  v_claimed integer := 0;
  v_created integer := 0;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  select lower(u.email) into v_email
  from auth.users as u
  where u.id = v_uid and u.email_confirmed_at is not null;
  if v_email is null then
    return jsonb_build_object('claimed', 0, 'athletes_created', 0, 'email_confirmed', false);
  end if;

  update public.camp_registrations
    set user_id = v_uid
    where user_id is null and parent_email is not null and lower(parent_email) = v_email
      and status in ('pending_payment', 'held', 'paid');
  get diagnostics v_claimed = row_count;

  for v_reg in
    select reg.id, reg.athlete_first_name, reg.athlete_last_name, reg.birth_year
    from public.camp_registrations as reg
    where reg.user_id = v_uid and reg.athlete_id is null and reg.status in ('held', 'paid')
    order by reg.created_at
  loop
    v_full := btrim(v_reg.athlete_first_name || ' ' || v_reg.athlete_last_name);
    select athlete.id into v_athlete
    from public.athlete_profiles as athlete
    where athlete.user_id = v_uid and lower(btrim(athlete.full_name)) = lower(v_full)
    order by athlete.created_at
    limit 1;
    if v_athlete is null then
      -- Only the birth year is known; the family completes the profile later.
      insert into public.athlete_profiles (user_id, full_name, sport, date_of_birth, profile_completed)
      values (v_uid, v_full, 'Soccer', make_date(coalesce(v_reg.birth_year, extract(year from now())::integer - 10), 1, 1), false)
      returning id into v_athlete;
      v_created := v_created + 1;
    end if;
    begin
      update public.camp_registrations set athlete_id = v_athlete where id = v_reg.id;
    exception when unique_violation then
      null; -- that profile already has a spot at this camp
    end;
  end loop;

  return jsonb_build_object('claimed', v_claimed, 'athletes_created', v_created, 'email_confirmed', true);
end;
$$;

revoke all on function public.claim_camp_registrations() from public, anon;
grant execute on function public.claim_camp_registrations() to authenticated;

-- Family portal: the caller's camps with each athlete's group and status.
create or replace function public.get_my_camps()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(camp order by (camp->>'starts_on') nulls last, camp->>'name'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'camp_id', pkg.id,
      'name', pkg.package_name,
      'description', pkg.description,
      'starts_on', pkg.camp_starts_on,
      'ends_on', pkg.camp_ends_on,
      'location', pkg.camp_location,
      'included', pkg.camp_included,
      'cover_url', coalesce(pkg.camp_cover_url, nullif(btrim(coalesce(coach.profile_image_url, coach.image_url, '')), '')),
      'slug', pkg.camp_slug,
      'coach', jsonb_build_object(
        'id', coach.id, 'name', coach.name, 'slug', coach.slug,
        'photo_url', nullif(btrim(coalesce(coach.profile_image_url, coach.image_url, '')), '')
      ),
      'athletes', jsonb_agg(jsonb_build_object(
        'registration_id', reg.id,
        'athlete_id', reg.athlete_id,
        'first_name', reg.athlete_first_name,
        'last_name', reg.athlete_last_name,
        'group_name', grp.name,
        'start_time', to_char(grp.start_time, 'HH24:MI'),
        'end_time', to_char(grp.end_time, 'HH24:MI'),
        'status', reg.status,
        'pay_method', reg.pay_method
      ) order by reg.created_at)
    ) as camp
    from public.camp_registrations as reg
    join public.coach_packages as pkg on pkg.id = reg.camp_id
    join public.coaches as coach on coach.id = pkg.coach_id
    left join public.camp_groups as grp on grp.id = reg.group_id
    where reg.user_id = auth.uid()
      and auth.uid() is not null
      and public.camp_reg_holds_spot(reg.status, reg.hold_expires_at)
    group by pkg.id, coach.id
  ) as rows;
$$;

revoke all on function public.get_my_camps() from public, anon;
grant execute on function public.get_my_camps() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Camp days on My schedule
-- ---------------------------------------------------------------------------
alter table public.coach_availability_slot_occurrences
  add column if not exists camp_id uuid references public.coach_packages (id) on delete set null,
  add column if not exists camp_group_id uuid references public.camp_groups (id) on delete set null,
  add column if not exists camp_day_index smallint;

create unique index if not exists slot_occ_camp_group_date_key
  on public.coach_availability_slot_occurrences (camp_group_id, occurrence_date)
  where camp_group_id is not null;
create index if not exists slot_occ_camp_idx
  on public.coach_availability_slot_occurrences (camp_id) where camp_id is not null;

comment on column public.coach_availability_slot_occurrences.camp_id is
  'Camp day (one group session per camp group per day). Never bookable as a single session.';

-- Removes one camp schedule row: deleted, or switched off when it already has a history.
create or replace function public.camp_drop_occurrence(p_occurrence_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.camp_occurrence_has_history(p_occurrence_id) then
    update public.coach_availability_slot_occurrences
      set is_enabled = false, disabled_reason = 'removed'
      where id = p_occurrence_id and is_enabled;
  else
    delete from public.coach_availability_slot_occurrences where id = p_occurrence_id;
  end if;
end;
$$;

-- One group session per group per camp day from today on, matching the camp as saved.
-- Past days are left alone. Rows that no longer match are removed (or switched off when they
-- have attendance). Raises a readable error when a camp day overlaps another session.
create or replace function public.camp_sync_schedule(p_camp_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_camp public.coach_packages%rowtype;
  v_group public.camp_groups%rowtype;
  v_today date := public.camp_today();
  v_day date;
  v_days integer;
  v_groups integer;
  v_occ uuid;
  v_live boolean;
  v_n integer := 0;
begin
  select * into v_camp from public.coach_packages where id = p_camp_id and kind = 'camp';
  if not found then
    return 0;
  end if;
  v_live := v_camp.is_active and v_camp.camp_published_at is not null
    and v_camp.camp_starts_on is not null and v_camp.camp_ends_on is not null;

  for v_occ in
    select occ.id
    from public.coach_availability_slot_occurrences as occ
    where occ.camp_id = p_camp_id
      and occ.occurrence_date >= v_today
      and (
        not v_live
        or occ.camp_group_id is null
        or occ.occurrence_date not between v_camp.camp_starts_on and v_camp.camp_ends_on
        or not exists (select 1 from public.camp_groups as g where g.id = occ.camp_group_id and g.camp_id = p_camp_id)
      )
  loop
    perform public.camp_drop_occurrence(v_occ);
  end loop;

  if not v_live then
    return 0;
  end if;

  v_days := v_camp.camp_ends_on - v_camp.camp_starts_on + 1;
  select count(*) into v_groups from public.camp_groups where camp_id = p_camp_id;

  for v_group in select * from public.camp_groups where camp_id = p_camp_id order by sort_order, created_at loop
    for v_day in
      select d::date from generate_series(greatest(v_camp.camp_starts_on, v_today), v_camp.camp_ends_on, interval '1 day') as d
    loop
      begin
        insert into public.coach_availability_slot_occurrences as occ (
          coach_id, occurrence_date, session_name, price, duration_minutes, start_time, end_time,
          session_type, location, place, visibility, offered_to, details, is_draft, is_enabled,
          max_bookings_per_slot, camp_id, camp_group_id, camp_day_index
        ) values (
          v_camp.coach_id, v_day,
          left(v_camp.package_name || case when v_groups > 1 then ' · ' || v_group.name else '' end, 160),
          round(v_camp.total_price / 100.0, 2),
          (extract(epoch from (v_group.end_time - v_group.start_time)) / 60)::integer,
          v_group.start_time, v_group.end_time,
          -- 'offered' to nobody: no family list shows it even where camp_id isn't checked.
          'group', 'in-person', v_camp.camp_location, 'offered', '{}',
          jsonb_build_object(
            'camp_id', v_camp.id, 'camp_group_id', v_group.id,
            'day_index', v_day - v_camp.camp_starts_on + 1, 'days_total', v_days
          ),
          false, true, v_group.spots, v_camp.id, v_group.id, (v_day - v_camp.camp_starts_on + 1)::smallint
        )
        on conflict (camp_group_id, occurrence_date) where camp_group_id is not null do update
          set session_name = excluded.session_name,
              price = excluded.price,
              duration_minutes = excluded.duration_minutes,
              start_time = excluded.start_time,
              end_time = excluded.end_time,
              place = excluded.place,
              visibility = 'offered',
              offered_to = '{}',
              details = excluded.details,
              is_draft = false,
              is_enabled = true,
              disabled_reason = null,
              max_bookings_per_slot = excluded.max_bookings_per_slot,
              camp_id = excluded.camp_id,
              camp_day_index = excluded.camp_day_index;
      exception when raise_exception then
        raise exception 'You already have a session on % that overlaps % (% to %). Move it, then try again.',
          to_char(v_day, 'Mon FMDD'), v_group.name, to_char(v_group.start_time, 'FMHH12:MI AM'),
          to_char(v_group.end_time, 'FMHH12:MI AM')
          using errcode = '23P01', hint = 'schedule_clash';
      end;
      v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end;
$$;

revoke all on function public.camp_drop_occurrence(uuid) from public, anon, authenticated;
revoke all on function public.camp_sync_schedule(uuid) from public, anon, authenticated;

-- Deleting a camp (admins only) takes its future schedule rows with it.
create or replace function public.camp_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_occ uuid;
begin
  if old.kind = 'camp' then
    for v_occ in
      select id from public.coach_availability_slot_occurrences where camp_id = old.id
    loop
      perform public.camp_drop_occurrence(v_occ);
    end loop;
  end if;
  return old;
end;
$$;

revoke all on function public.camp_before_delete() from public, anon, authenticated;

drop trigger if exists camp_before_delete on public.coach_packages;
create trigger camp_before_delete
  before delete on public.coach_packages
  for each row execute function public.camp_before_delete();

-- Camp days are only joined through the camp sign-up, never booked as a session.
create or replace function public.camp_block_session_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.occurrence_id is not null and exists (
    select 1 from public.coach_availability_slot_occurrences
    where id = new.occurrence_id and camp_id is not null
  ) then
    raise exception 'Camp days are joined through the camp sign-up, not booked one by one'
      using errcode = '22023', hint = 'camp_day';
  end if;
  return new;
end;
$$;

revoke all on function public.camp_block_session_booking() from public, anon, authenticated;

drop trigger if exists camp_block_session_booking on public.coach_slot_bookings;
create trigger camp_block_session_booking
  before insert or update of occurrence_id on public.coach_slot_bookings
  for each row execute function public.camp_block_session_booking();

-- ---------------------------------------------------------------------------
-- 8. Coach: camps, editor, save, publish
-- ---------------------------------------------------------------------------
-- The signed-in coach's camps for the profile row and My schedule.
create or replace function public.get_coach_camps()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(public.camp_json(pkg.id) || jsonb_build_object(
    'paid_count', (select count(*) from public.camp_registrations r where r.camp_id = pkg.id and r.status = 'paid'),
    'waiting_count', (select count(*) from public.camp_registrations r
                      where r.camp_id = pkg.id and r.status = 'held' and public.camp_reg_holds_spot(r.status, r.hold_expires_at))
  ) order by pkg.camp_starts_on desc nulls first, pkg.created_at desc), '[]'::jsonb)
  from public.coach_packages as pkg
  where pkg.kind = 'camp'
    and pkg.coach_id = public.current_coach_id()
    and public.current_coach_id() is not null;
$$;

create or replace function public.get_camp_editor(p_camp_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.coach_packages
    where id = p_camp_id and kind = 'camp' and coach_id = public.current_coach_id()
  ) then
    raise exception 'Camp not found' using errcode = 'P0002';
  end if;
  return public.camp_json(p_camp_id);
end;
$$;

-- "Run a camp again": the coach's two most recent camps, everything but the dates.
create or replace function public.get_camp_run_again()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
    public.camp_json(recent.id) || jsonb_build_object('starts_on', null, 'ends_on', null, 'days', null)
    order by recent.created_at desc
  ), '[]'::jsonb)
  from (
    select pkg.id, pkg.created_at
    from public.coach_packages as pkg
    where pkg.kind = 'camp' and pkg.coach_id = public.current_coach_id() and public.current_coach_id() is not null
    order by pkg.created_at desc
    limit 2
  ) as recent;
$$;

-- Saves the camp and its groups in one transaction.
-- p_camp:   { name, description, price_cents, starts_on, ends_on, location, cover_url,
--             included: [text], tags: [text], pay_direct, linked_coach_id, age_min, age_max,
--             co_coach_ids?: [uuid], slug? }
-- p_groups: the full list, 1 to 4: [{ id?, name, description, start_time 'HH:MI', end_time, spots }].
--           Required: a missing or empty list is an error, never "delete every group".
--           A saved group left out is deleted, unless athletes hold a spot in it.
-- p_expected_updated_at: the updated_at the editor loaded; a newer row means another tab
--           saved in between, and nothing is written.
-- Published camps get their schedule days rebuilt. Returns the camp (camp_json).
create or replace function public.save_camp(
  p_camp_id uuid,
  p_camp jsonb,
  p_groups jsonb,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_camp public.coach_packages%rowtype;
  v_today date := public.camp_today();
  v_name text := btrim(coalesce(p_camp->>'name', ''));
  v_desc text := nullif(btrim(coalesce(p_camp->>'description', '')), '');
  v_location text := nullif(btrim(coalesce(p_camp->>'location', '')), '');
  v_cover text := nullif(btrim(coalesce(p_camp->>'cover_url', '')), '');
  v_price integer;
  v_starts date;
  v_ends date;
  v_included jsonb := '[]'::jsonb;
  v_tags text[] := '{}';
  v_pay_direct boolean := coalesce((p_camp->>'pay_direct')::boolean, false);
  v_linked uuid;
  v_age_min integer;
  v_age_max integer;
  v_item jsonb;
  v_text text;
  v_count integer;
  v_row jsonb;
  v_gid uuid;
  v_gname text;
  v_gdesc text;
  v_gstart time;
  v_gend time;
  v_gspots integer;
  v_taken integer;
  v_keep uuid[] := '{}';
  v_names text[] := '{}';
  v_i integer := 0;
  v_total integer := 0;
  v_min_start time;
  v_max_end time;
  v_max_minutes integer := 0;
  v_days integer;
  v_old record;
  v_uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if v_coach is null then
    raise exception 'Only coaches can save camps' using errcode = '42501';
  end if;
  if jsonb_typeof(p_camp) is distinct from 'object' then
    raise exception 'Send the camp details' using errcode = '22023';
  end if;
  if (case when jsonb_typeof(p_groups) = 'array' then jsonb_array_length(p_groups) else 0 end) = 0 then
    raise exception 'Add at least one group' using errcode = '22023', hint = 'groups_required';
  end if;
  v_count := jsonb_array_length(p_groups);
  if v_count > 4 then
    raise exception 'A camp can have up to 4 groups' using errcode = '22023', hint = 'too_many_groups';
  end if;

  -- Camp fields.
  if char_length(v_name) not between 1 and 100 then
    raise exception 'Add a camp name' using errcode = '22023';
  end if;
  if v_desc is not null and char_length(v_desc) > 500 then
    raise exception 'Keep the description under 500 characters' using errcode = '22023';
  end if;
  if coalesce(p_camp->>'price_cents', '') !~ '^\d{1,7}$' or (p_camp->>'price_cents')::integer not between 100 and 1000000 then
    raise exception 'Add a price per athlete' using errcode = '22023';
  end if;
  v_price := (p_camp->>'price_cents')::integer;
  if coalesce(p_camp->>'starts_on', '') <> '' then
    if p_camp->>'starts_on' !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Pick a start date' using errcode = '22023';
    end if;
    v_starts := (p_camp->>'starts_on')::date;
  end if;
  if coalesce(p_camp->>'ends_on', '') <> '' then
    if p_camp->>'ends_on' !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Pick an end date' using errcode = '22023';
    end if;
    v_ends := (p_camp->>'ends_on')::date;
  end if;
  if v_starts is not null and v_ends is null then
    v_ends := v_starts; -- same day twice = a one-day camp
  end if;
  if v_ends is not null and v_starts is null then
    raise exception 'Pick a start date' using errcode = '22023';
  end if;
  if v_starts is not null and v_ends < v_starts then
    raise exception 'The camp ends before it starts' using errcode = '22023';
  end if;
  if v_starts is not null and v_ends - v_starts + 1 > 60 then
    raise exception 'A camp can last up to 60 days' using errcode = '22023';
  end if;
  if v_location is not null and char_length(v_location) > 200 then
    raise exception 'Keep the location under 200 characters' using errcode = '22023';
  end if;
  if v_cover is not null and (v_cover !~ '^https://' or char_length(v_cover) > 1000) then
    raise exception 'Upload the cover photo again' using errcode = '22023';
  end if;
  if p_camp ? 'included' and jsonb_typeof(p_camp->'included') = 'array' then
    for v_item in select value from jsonb_array_elements(p_camp->'included') loop
      v_text := btrim(coalesce(v_item #>> '{}', ''));
      continue when v_text = '';
      if char_length(v_text) > 120 then
        raise exception 'Keep each included item under 120 characters' using errcode = '22023';
      end if;
      v_included := v_included || to_jsonb(v_text);
    end loop;
    if jsonb_array_length(v_included) > 12 then
      raise exception 'List up to 12 included items' using errcode = '22023';
    end if;
  end if;
  if p_camp ? 'tags' and jsonb_typeof(p_camp->'tags') = 'array' then
    for v_item in select value from jsonb_array_elements(p_camp->'tags') loop
      v_text := btrim(coalesce(v_item #>> '{}', ''));
      continue when v_text = '' or v_text = any (v_tags);
      if char_length(v_text) > 30 then
        raise exception 'Keep each tag under 30 characters' using errcode = '22023';
      end if;
      v_tags := v_tags || v_text;
    end loop;
    if cardinality(v_tags) > 6 then
      raise exception 'Add up to 6 tags' using errcode = '22023';
    end if;
  end if;
  if coalesce(p_camp->>'linked_coach_id', '') <> '' then
    if p_camp->>'linked_coach_id' !~* v_uuid_re then
      raise exception 'Pick the coach to link again' using errcode = '22023';
    end if;
    v_linked := (p_camp->>'linked_coach_id')::uuid;
    if v_linked = v_coach then
      raise exception 'You are already the coach for this camp' using errcode = '22023';
    end if;
    if not exists (select 1 from public.coaches where id = v_linked and deactivated_at is null) then
      raise exception 'That coach is not on AthaNext anymore' using errcode = '22023';
    end if;
  end if;
  if coalesce(p_camp->>'age_min', '') ~ '^\d{1,2}$' then
    v_age_min := (p_camp->>'age_min')::integer;
  end if;
  if coalesce(p_camp->>'age_max', '') ~ '^\d{1,2}$' then
    v_age_max := (p_camp->>'age_max')::integer;
  end if;
  if (v_age_min is not null and v_age_min not between 1 and 99) or (v_age_max is not null and v_age_max not between 1 and 99) then
    raise exception 'Ages must be between 1 and 99' using errcode = '22023';
  end if;
  if v_age_min is not null and v_age_max is not null and v_age_max < v_age_min then
    raise exception 'The oldest age is below the youngest age' using errcode = '22023';
  end if;

  -- Groups: validate everything before writing anything.
  for v_row in select value from jsonb_array_elements(p_groups) loop
    if jsonb_typeof(v_row) is distinct from 'object' then
      raise exception 'Send each group as an object' using errcode = '22023';
    end if;
    v_gname := btrim(coalesce(v_row->>'name', ''));
    if v_gname = '' then
      if v_count > 1 then
        raise exception 'Name each group' using errcode = '22023';
      end if;
      v_gname := 'All athletes';
    end if;
    if char_length(v_gname) > 60 then
      raise exception 'Keep group names under 60 characters' using errcode = '22023';
    end if;
    if lower(v_gname) = any (v_names) then
      raise exception 'Two groups are called %', v_gname using errcode = '22023';
    end if;
    v_names := v_names || lower(v_gname);
    if coalesce(v_row->>'description', '') <> '' and char_length(btrim(v_row->>'description')) > 280 then
      raise exception 'Keep group descriptions under 280 characters' using errcode = '22023';
    end if;
    if coalesce(v_row->>'start_time', '') !~ '^([01]\d|2[0-1]):(00|30)$'
       or coalesce(v_row->>'end_time', '') !~ '^([01]\d|2[0-1]):(00|30)$' then
      raise exception 'Pick % times in half hours between 7am and 9pm', v_gname using errcode = '22023';
    end if;
    v_gstart := (v_row->>'start_time')::time;
    v_gend := (v_row->>'end_time')::time;
    if v_gstart < time '07:00' or v_gend > time '21:00' or v_gend <= v_gstart then
      raise exception 'Pick % times in half hours between 7am and 9pm', v_gname using errcode = '22023';
    end if;
    if coalesce(v_row->>'spots', '') !~ '^\d{1,2}$' or (v_row->>'spots')::integer not between 1 and 60 then
      raise exception 'Give % between 1 and 60 spots', v_gname using errcode = '22023';
    end if;
    if coalesce(v_row->>'id', '') <> '' and v_row->>'id' !~* v_uuid_re then
      raise exception 'Reload the camp and try again' using errcode = '22023';
    end if;
  end loop;

  -- Camp row (locked, so sign-ups wait for this save).
  if p_camp_id is null then
    if v_starts is not null and v_starts < v_today then
      raise exception 'Pick a start date from today on' using errcode = '22023';
    end if;
    insert into public.coach_packages (
      coach_id, kind, package_name, description, session_count, duration_minutes, total_price,
      price_per_session, validity_days, features, is_active, camp_slug
    ) values (
      v_coach, 'camp', v_name, v_desc, 1, 60, v_price, v_price, 1, '[]'::jsonb, false,
      public.camp_unique_slug(v_coach, coalesce(nullif(p_camp->>'slug', ''), v_name), null)
    )
    returning * into v_camp;
  else
    select * into v_camp from public.coach_packages
    where id = p_camp_id and kind = 'camp' and coach_id = v_coach
    for update;
    if not found then
      raise exception 'Camp not found' using errcode = 'P0002';
    end if;
    if p_expected_updated_at is not null and v_camp.updated_at is distinct from p_expected_updated_at then
      raise exception 'This camp was changed somewhere else. Reload it and try again.'
        using errcode = '40001', hint = 'stale';
    end if;
    if v_starts is not null and v_starts is distinct from v_camp.camp_starts_on and v_starts < v_today then
      raise exception 'Pick a start date from today on' using errcode = '22023';
    end if;
  end if;

  -- Groups left out of the list: delete (the guard trigger refuses groups with athletes).
  for v_old in
    select grp.id, grp.name from public.camp_groups as grp
    where grp.camp_id = v_camp.id
      and grp.id not in (
        select (value->>'id')::uuid from jsonb_array_elements(p_groups)
        where coalesce(value->>'id', '') <> ''
      )
    for update
  loop
    if public.camp_group_taken(v_old.id) > 0 then
      raise exception '% has athletes signed up. Move or cancel them first.', v_old.name
        using errcode = '23503', hint = 'group_has_athletes';
    end if;
    delete from public.camp_groups where id = v_old.id;
  end loop;

  for v_row in select value from jsonb_array_elements(p_groups) loop
    v_gname := coalesce(nullif(btrim(coalesce(v_row->>'name', '')), ''), 'All athletes');
    v_gdesc := nullif(btrim(coalesce(v_row->>'description', '')), '');
    v_gstart := (v_row->>'start_time')::time;
    v_gend := (v_row->>'end_time')::time;
    v_gspots := (v_row->>'spots')::integer;
    v_gid := null;
    if coalesce(v_row->>'id', '') <> '' then
      select id into v_gid from public.camp_groups
      where id = (v_row->>'id')::uuid and camp_id = v_camp.id
      for update;
      if v_gid is null then
        raise exception 'Reload the camp and try again' using errcode = 'P0002', hint = 'stale';
      end if;
      v_taken := public.camp_group_taken(v_gid);
      if v_gspots < v_taken then
        raise exception '% already has % athletes. Give it at least % spots.', v_gname, v_taken, v_taken
          using errcode = '22023', hint = 'spots_below_taken';
      end if;
      update public.camp_groups
        set name = v_gname, description = v_gdesc, start_time = v_gstart, end_time = v_gend,
            spots = v_gspots, sort_order = v_i
        where id = v_gid;
    else
      insert into public.camp_groups (camp_id, name, description, start_time, end_time, spots, sort_order)
      values (v_camp.id, v_gname, v_gdesc, v_gstart, v_gend, v_gspots, v_i)
      returning id into v_gid;
    end if;
    v_keep := v_keep || v_gid;
    v_total := v_total + v_gspots;
    v_min_start := least(coalesce(v_min_start, v_gstart), v_gstart);
    v_max_end := greatest(coalesce(v_max_end, v_gend), v_gend);
    v_max_minutes := greatest(v_max_minutes, (extract(epoch from (v_gend - v_gstart)) / 60)::integer);
    v_i := v_i + 1;
  end loop;

  -- Camp capacity is the sum of the groups, never below what is already taken.
  v_taken := public.camp_taken(v_camp.id);
  if v_total < v_taken then
    raise exception '% athletes already have a spot. Add spots so the groups hold at least %.', v_taken, v_taken
      using errcode = '22023', hint = 'spots_below_taken';
  end if;

  v_days := case when v_starts is null then 1 else v_ends - v_starts + 1 end;
  update public.coach_packages
    set package_name = v_name,
        updated_at = now(),
        description = v_desc,
        total_price = v_price,
        price_per_session = round(v_price::numeric / v_days)::integer,
        session_count = v_days,
        duration_minutes = greatest(1, v_max_minutes),
        validity_days = greatest(1, coalesce(v_ends - v_today + 1, 1)),
        features = v_included,
        camp_starts_on = v_starts,
        camp_ends_on = v_ends,
        camp_daily_start = v_min_start,
        camp_daily_end = v_max_end,
        camp_location = v_location,
        camp_capacity = v_total,
        camp_age_min = v_age_min,
        camp_age_max = v_age_max,
        camp_cover_url = v_cover,
        camp_included = v_included,
        camp_tags = v_tags,
        camp_pay_direct = v_pay_direct,
        camp_linked_coach_id = v_linked,
        co_coach_ids = case
          when p_camp ? 'co_coach_ids' and jsonb_typeof(p_camp->'co_coach_ids') = 'array' then coalesce((
            select array_agg(distinct (value #>> '{}')::uuid)
            from jsonb_array_elements(p_camp->'co_coach_ids')
            where (value #>> '{}') ~* v_uuid_re
          ), '{}'::uuid[])
          else co_coach_ids
        end
    where id = v_camp.id;

  if v_camp.camp_published_at is not null then
    if v_starts is null or v_location is null then
      raise exception 'A published camp needs its dates and location' using errcode = '22023';
    end if;
    perform public.camp_sync_schedule(v_camp.id);
  end if;

  return public.camp_json(v_camp.id);
end;
$$;

-- Publish: live at /camps/<coach slug>/<camp slug>, and one group session per group per day.
create or replace function public.publish_camp(p_camp_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_camp public.coach_packages%rowtype;
  v_missing text[] := '{}';
  v_sessions integer;
begin
  select * into v_camp from public.coach_packages
  where id = p_camp_id and kind = 'camp' and coach_id = public.current_coach_id()
  for update;
  if not found then
    raise exception 'Camp not found' using errcode = 'P0002';
  end if;
  if v_camp.camp_starts_on is null or v_camp.camp_ends_on is null then
    v_missing := v_missing || 'dates'::text;
  end if;
  if v_camp.camp_location is null then
    v_missing := v_missing || 'location'::text;
  end if;
  if not exists (select 1 from public.camp_groups where camp_id = v_camp.id) then
    v_missing := v_missing || 'groups'::text;
  end if;
  if cardinality(v_missing) > 0 then
    raise exception 'Add the camp''s %', array_to_string(v_missing, ', ') using errcode = '22023', hint = 'incomplete';
  end if;
  if v_camp.camp_ends_on < public.camp_today() then
    raise exception 'This camp has already ended' using errcode = '22023';
  end if;
  if v_camp.camp_slug is null then
    update public.coach_packages
      set camp_slug = public.camp_unique_slug(v_camp.coach_id, v_camp.package_name, v_camp.id)
      where id = v_camp.id;
  end if;
  update public.coach_packages
    set camp_published_at = coalesce(camp_published_at, now()), is_active = true
    where id = v_camp.id;
  v_sessions := public.camp_sync_schedule(v_camp.id);
  return public.camp_json(v_camp.id) || jsonb_build_object('schedule_sessions', v_sessions);
end;
$$;

-- Unpublish: the link stops working and future camp days leave the schedule. Registrations stay.
create or replace function public.unpublish_camp(p_camp_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.coach_packages
    set camp_published_at = null, is_active = false
    where id = p_camp_id and kind = 'camp' and coach_id = public.current_coach_id();
  if not found then
    raise exception 'Camp not found' using errcode = 'P0002';
  end if;
  perform public.camp_sync_schedule(p_camp_id);
  return public.camp_json(p_camp_id);
end;
$$;

revoke all on function public.get_coach_camps() from public, anon;
revoke all on function public.get_camp_editor(uuid) from public, anon;
revoke all on function public.get_camp_run_again() from public, anon;
revoke all on function public.save_camp(uuid, jsonb, jsonb, timestamptz) from public, anon;
revoke all on function public.publish_camp(uuid) from public, anon;
revoke all on function public.unpublish_camp(uuid) from public, anon;
grant execute on function public.get_coach_camps() to authenticated;
grant execute on function public.get_camp_editor(uuid) to authenticated;
grant execute on function public.get_camp_run_again() to authenticated;
grant execute on function public.save_camp(uuid, jsonb, jsonb, timestamptz) to authenticated;
grant execute on function public.publish_camp(uuid) to authenticated;
grant execute on function public.unpublish_camp(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Coach: registrations
-- ---------------------------------------------------------------------------
-- Everyone holding a spot, per-group counts, money paid so far and still to collect.
-- display_status: paid_in_app | paid_outside | waiting | paying (card Checkout open)
-- account: joined | not_finished | no_email.  invite: latest family invite for the parent email.
create or replace function public.get_camp_registrations(p_camp_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
begin
  if v_coach is null or not exists (
    select 1 from public.coach_packages where id = p_camp_id and kind = 'camp' and coach_id = v_coach
  ) then
    raise exception 'Camp not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'camp', public.camp_json(p_camp_id),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', grp.id,
        'name', grp.name,
        'start_time', to_char(grp.start_time, 'HH24:MI'),
        'end_time', to_char(grp.end_time, 'HH24:MI'),
        'spots', grp.spots,
        'taken', public.camp_group_taken(grp.id),
        'paid', (select count(*) from public.camp_registrations r where r.group_id = grp.id and r.status = 'paid'),
        'waiting', (select count(*) from public.camp_registrations r
                    where r.group_id = grp.id and r.status = 'held' and public.camp_reg_holds_spot(r.status, r.hold_expires_at))
      ) order by grp.sort_order, grp.created_at)
      from public.camp_groups as grp
      where grp.camp_id = p_camp_id
    ), '[]'::jsonb),
    'legacy_purchases', (
      select count(*) from public.package_purchases as purchase
      where purchase.package_id = p_camp_id and purchase.camp_signup_id is null
        and purchase.status in ('active', 'expired', 'completed')
    ),
    'paid_cents', coalesce((
      select sum(reg.price_cents) from public.camp_registrations as reg
      where reg.camp_id = p_camp_id and reg.status = 'paid'
    ), 0),
    'to_collect_cents', coalesce((
      select sum(reg.price_cents) from public.camp_registrations as reg
      where reg.camp_id = p_camp_id and reg.status = 'held' and public.camp_reg_holds_spot(reg.status, reg.hold_expires_at)
    ), 0),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', reg.id,
        'signup_id', reg.signup_id,
        'group_id', reg.group_id,
        'group_name', grp.name,
        'athlete_first_name', reg.athlete_first_name,
        'athlete_last_name', reg.athlete_last_name,
        'athlete_id', reg.athlete_id,
        'birth_year', reg.birth_year,
        'parent_name', reg.parent_name,
        'parent_email', reg.parent_email,
        'parent_phone', reg.parent_phone,
        'note', reg.note,
        'waiver_accepted_at', reg.waiver_accepted_at,
        'photo_consent', reg.photo_consent,
        'source', reg.source,
        'pay_method', reg.pay_method,
        'status', reg.status,
        'display_status', case
          when reg.status = 'paid' and reg.pay_method = 'card' then 'paid_in_app'
          when reg.status = 'paid' then 'paid_outside'
          when reg.status = 'held' then 'waiting'
          else 'paying'
        end,
        'price_cents', reg.price_cents,
        'paid_at', reg.paid_at,
        'hold_expires_at', reg.hold_expires_at,
        'created_at', reg.created_at,
        'account', case
          when reg.user_id is not null then 'joined'
          when reg.parent_email is null then 'no_email'
          when exists (select 1 from public.user_profiles as up where lower(up.email) = lower(reg.parent_email)) then 'joined'
          else 'not_finished'
        end,
        'finish_emailed_at', reg.finish_emailed_at,
        'invite', (
          select jsonb_build_object(
            'id', ref.id,
            'status', case
              when ref.status = 'confirmed' then 'joined'
              when ref.opened_at is not null then 'opened'
              else 'sent'
            end,
            'sent_at', coalesce(ref.updated_at, ref.created_at),
            'opened_at', ref.opened_at,
            'resend_count', ref.resend_count
          )
          from public.coach_client_referrals as ref
          where ref.coach_id = reg.coach_id and reg.parent_email is not null
            and lower(ref.client_email) = lower(reg.parent_email)
          order by ref.created_at desc
          limit 1
        )
      ) order by grp.sort_order nulls last, reg.created_at)
      from public.camp_registrations as reg
      left join public.camp_groups as grp on grp.id = reg.group_id
      where reg.camp_id = p_camp_id
        and public.camp_reg_holds_spot(reg.status, reg.hold_expires_at)
    ), '[]'::jsonb)
  );
end;
$$;

-- Mark paid: only rows paid to the coach (direct or outside). Card rows are confirmed by Stripe.
-- A lapsed or cancelled row takes a spot again only when its group has room.
create or replace function public.mark_camp_registration_paid(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.camp_registrations%rowtype;
begin
  select * into v_reg from public.camp_registrations
  where id = p_id and coach_id = public.current_coach_id();
  if not found then
    raise exception 'Registration not found' using errcode = 'P0002';
  end if;
  if v_reg.pay_method = 'card' then
    raise exception 'Card payments are confirmed by Stripe' using errcode = '22023', hint = 'card';
  end if;
  -- Camp row first (same lock order as sign-up), then the registration.
  perform 1 from public.coach_packages where id = v_reg.camp_id for update;
  select * into v_reg from public.camp_registrations where id = p_id for update;
  if v_reg.status = 'paid' then
    return jsonb_build_object('id', v_reg.id, 'status', 'paid');
  end if;
  if not public.camp_reg_holds_spot(v_reg.status, v_reg.hold_expires_at) then
    if v_reg.group_id is null then
      raise exception 'Pick a group for this athlete first' using errcode = '22023', hint = 'group_missing';
    end if;
    perform public.camp_reserve(v_reg.camp_id, array[v_reg.group_id]);
  end if;
  begin
    update public.camp_registrations
      set status = 'paid', paid_at = now(), hold_expires_at = null, cancelled_at = null, cancel_reason = null
      where id = v_reg.id;
  exception when unique_violation then
    raise exception 'This athlete already has a spot at this camp' using errcode = '23505', hint = 'duplicate';
  end;
  return jsonb_build_object('id', v_reg.id, 'status', 'paid');
end;
$$;

-- Cancel frees the spot. A card payment is refunded from Payments first.
create or replace function public.cancel_camp_registration(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.camp_registrations%rowtype;
begin
  select * into v_reg from public.camp_registrations
  where id = p_id and coach_id = public.current_coach_id()
  for update;
  if not found then
    raise exception 'Registration not found' using errcode = 'P0002';
  end if;
  if v_reg.status = 'paid' and v_reg.pay_method = 'card' then
    raise exception 'Refund the card payment from Payments first' using errcode = '22023', hint = 'card_paid';
  end if;
  if v_reg.status in ('cancelled', 'expired') then
    return jsonb_build_object('id', v_reg.id, 'status', v_reg.status);
  end if;
  update public.camp_registrations
    set status = 'cancelled', cancelled_at = now(), hold_expires_at = null, cancel_reason = 'coach'
    where id = v_reg.id;
  return jsonb_build_object('id', v_reg.id, 'status', 'cancelled');
end;
$$;

-- Coach adds an athlete who signed up and paid (or will pay) him outside the app.
-- p_athlete_id: from My athletes (names, birth year and parent come from the profile), or null
-- with p_first_name/p_last_name for someone new. Group required. Takes a spot: paid now
-- (Paid outside) or held with no expiry (Waiting) until he marks it paid.
-- invite_needed: there is a parent email with no account and no family invite yet; the
-- camp-signup function then sends the usual family invite (add-client-referral).
create or replace function public.add_camp_athlete(
  p_camp_id uuid,
  p_group_id uuid,
  p_athlete_id uuid,
  p_first_name text,
  p_last_name text,
  p_birth_year integer,
  p_parent_email text,
  p_parent_name text,
  p_paid boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_camp public.coach_packages%rowtype;
  v_first text := btrim(coalesce(p_first_name, ''));
  v_last text := btrim(coalesce(p_last_name, ''));
  v_email text := nullif(lower(btrim(coalesce(p_parent_email, ''))), '');
  v_parent text := nullif(btrim(coalesce(p_parent_name, '')), '');
  v_birth integer := p_birth_year;
  v_user uuid;
  v_full text;
  v_dob date;
  v_signup uuid;
  v_id uuid;
  v_year integer := extract(year from now())::integer;
begin
  if v_coach is null then
    raise exception 'Only coaches can add athletes' using errcode = '42501';
  end if;
  select * into v_camp from public.coach_packages
  where id = p_camp_id and kind = 'camp' and coach_id = v_coach
  for update;
  if not found then
    raise exception 'Camp not found' using errcode = 'P0002';
  end if;
  if p_group_id is null then
    raise exception 'Pick a group' using errcode = '22023', hint = 'group_missing';
  end if;

  if p_athlete_id is not null then
    if not (
      public.is_coach_client(v_coach, p_athlete_id)
      or exists (select 1 from public.coach_slot_bookings where coach_id = v_coach and athlete_id = p_athlete_id)
      or exists (select 1 from public.coach_client_referrals where coach_id = v_coach and athlete_id = p_athlete_id)
    ) then
      raise exception 'That athlete is not in My athletes' using errcode = '42501';
    end if;
    select athlete.full_name, athlete.date_of_birth, athlete.user_id
      into v_full, v_dob, v_user
    from public.athlete_profiles as athlete where athlete.id = p_athlete_id;
    v_full := btrim(coalesce(v_full, ''));
    if v_first = '' then
      v_first := split_part(v_full, ' ', 1);
      v_last := btrim(substr(v_full, char_length(split_part(v_full, ' ', 1)) + 1));
    end if;
    v_birth := coalesce(v_birth, extract(year from v_dob)::integer);
    if v_user is not null then
      select coalesce(v_email, lower(up.email)), coalesce(v_parent, up.name)
        into v_email, v_parent
      from public.user_profiles as up where up.id = v_user;
    end if;
  end if;

  if char_length(v_first) not between 1 and 60 then
    raise exception 'Add a first name' using errcode = '22023';
  end if;
  if char_length(v_last) > 60 then
    raise exception 'Keep the last name under 60 characters' using errcode = '22023';
  end if;
  if v_birth is not null and v_birth not between v_year - 80 and v_year - 2 then
    raise exception 'Add a birth year, like 2013' using errcode = '22023';
  end if;
  if v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'Add a real email address' using errcode = '22023';
  end if;
  if v_parent is not null and char_length(v_parent) > 120 then
    v_parent := left(v_parent, 120);
  end if;

  perform public.camp_reserve(v_camp.id, array[p_group_id]);

  insert into public.camp_signups (camp_id, coach_id, source, pay_method, parent_email, platform_waived, created_by,
                                   paid_at)
  values (v_camp.id, v_coach, 'coach', 'outside', v_email, true, auth.uid(), case when p_paid then now() end)
  returning id into v_signup;

  begin
    insert into public.camp_registrations (
      camp_id, group_id, signup_id, coach_id, parent_name, parent_email, athlete_first_name, athlete_last_name,
      birth_year, source, pay_method, status, hold_expires_at, price_cents, paid_at, user_id, athlete_id, created_by
    ) values (
      v_camp.id, p_group_id, v_signup, v_coach, v_parent, v_email, v_first, v_last,
      v_birth, 'coach', 'outside', case when p_paid then 'paid' else 'held' end, null, v_camp.total_price,
      case when p_paid then now() end, v_user, p_athlete_id, auth.uid()
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception '% already has a spot at this camp', v_first using errcode = '23505', hint = 'duplicate';
  end;

  return jsonb_build_object(
    'id', v_id,
    'signup_id', v_signup,
    'status', case when p_paid then 'paid' else 'held' end,
    'athlete_first_name', v_first,
    'parent_email', v_email,
    'parent_name', v_parent,
    'has_account', v_user is not null
      or (v_email is not null and exists (select 1 from public.user_profiles where lower(email) = v_email)),
    'invite_needed', v_email is not null
      and v_user is null
      and not exists (select 1 from public.user_profiles where lower(email) = v_email)
      and not exists (
        select 1 from public.coach_client_referrals
        where coach_id = v_coach and lower(client_email) = v_email
      )
  );
end;
$$;

-- For the camp-signup function's coach emails: checks the coach owns the row, throttles, stamps
-- the send, and returns what the email needs. p_kind: 'finish' (finish your account link) or
-- 'details' (camp details for a coach-added athlete).
create or replace function public.camp_registration_contact(p_id uuid, p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.camp_registrations%rowtype;
  v_last timestamptz;
begin
  if p_kind not in ('finish', 'details') then
    raise exception 'Unknown email' using errcode = '22023';
  end if;
  select * into v_reg from public.camp_registrations
  where id = p_id and coach_id = public.current_coach_id()
  for update;
  if not found then
    raise exception 'Registration not found' using errcode = 'P0002';
  end if;
  if v_reg.parent_email is null then
    raise exception 'Add the parent''s email first' using errcode = '22023', hint = 'no_email';
  end if;
  v_last := case when p_kind = 'finish' then v_reg.finish_emailed_at else v_reg.details_emailed_at end;
  if v_last is not null and v_last > now() - interval '10 minutes' then
    raise exception 'Sent a few minutes ago. Try again later.' using errcode = 'P0001', hint = 'throttled';
  end if;
  if p_kind = 'finish' then
    update public.camp_registrations set finish_emailed_at = now() where id = p_id;
  else
    update public.camp_registrations set details_emailed_at = now() where id = p_id;
  end if;

  return (
    select jsonb_build_object(
      'registration_id', reg.id,
      'signup_id', reg.signup_id,
      'status', reg.status,
      'parent_email', reg.parent_email,
      'parent_name', reg.parent_name,
      'athlete_first_name', reg.athlete_first_name,
      'has_account', reg.user_id is not null
        or exists (select 1 from public.user_profiles as up where lower(up.email) = lower(reg.parent_email)),
      'group_name', grp.name,
      'start_time', to_char(grp.start_time, 'HH24:MI'),
      'end_time', to_char(grp.end_time, 'HH24:MI'),
      'camp', jsonb_build_object(
        'id', pkg.id, 'name', pkg.package_name, 'starts_on', pkg.camp_starts_on, 'ends_on', pkg.camp_ends_on,
        'location', pkg.camp_location, 'included', pkg.camp_included, 'slug', pkg.camp_slug,
        'coach_name', coach.name, 'coach_slug', coach.slug
      )
    )
    from public.camp_registrations as reg
    join public.coach_packages as pkg on pkg.id = reg.camp_id
    join public.coaches as coach on coach.id = pkg.coach_id
    left join public.camp_groups as grp on grp.id = reg.group_id
    where reg.id = p_id
  );
end;
$$;

revoke all on function public.get_camp_registrations(uuid) from public, anon;
revoke all on function public.mark_camp_registration_paid(uuid) from public, anon;
revoke all on function public.cancel_camp_registration(uuid) from public, anon;
revoke all on function public.add_camp_athlete(uuid, uuid, uuid, text, text, integer, text, text, boolean) from public, anon;
revoke all on function public.camp_registration_contact(uuid, text) from public, anon;
grant execute on function public.get_camp_registrations(uuid) to authenticated;
grant execute on function public.mark_camp_registration_paid(uuid) to authenticated;
grant execute on function public.cancel_camp_registration(uuid) to authenticated;
grant execute on function public.add_camp_athlete(uuid, uuid, uuid, text, text, integer, text, text, boolean) to authenticated;
grant execute on function public.camp_registration_contact(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Existing schedule functions, copied from their live definitions (same as the repo's
--     latest migration for each); only the camp lines are new.
-- ---------------------------------------------------------------------------
-- Overlap check (live-only trigger function): camp groups of the same camp may run at the same time.
create or replace function public.ensure_no_occurrence_overlap()
returns trigger
language plpgsql
as $$
declare
  conflict_count integer;
begin
  if coalesce(new.is_enabled, true) = false then
    return new;
  end if;
  select count(*) into conflict_count
  from public.coach_availability_slot_occurrences o
  where o.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000')
    and o.coach_id = new.coach_id
    and o.occurrence_date = new.occurrence_date
    and coalesce(o.is_enabled, true) = true
    and o.start_time < new.end_time
    and new.start_time < o.end_time
    and not (new.camp_id is not null and o.camp_id = new.camp_id);
  if conflict_count > 0 then
    raise exception 'Coach % already has an overlapping occurrence on %', new.coach_id, new.occurrence_date;
  end if;
  return new;
end;
$$;

-- Families' bookable sessions: camp days are never single sessions.
create or replace function public.visible_sessions(p_coach_id uuid, p_athlete_id uuid, p_from date, p_to date)
returns table(
  id uuid, coach_id uuid, occurrence_date date, start_time time, end_time time,
  duration_minutes integer, session_type text, session_name text, price numeric,
  capacity integer, location text, place text, pillar text, "position" text,
  visibility text, details jsonb, booked_count integer, my_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select occ.id, occ.coach_id, occ.occurrence_date, occ.start_time, occ.end_time,
    occ.duration_minutes, occ.session_type, occ.session_name, occ.price,
    occ.max_bookings_per_slot, occ.location, occ.place, occ.pillar_slot, occ.position,
    occ.visibility, occ.details,
    (select count(*)::integer from public.coach_slot_bookings as b
      where b.occurrence_id = occ.id and b.status in ('requested', 'pending_payment', 'booked', 'completed')),
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
$$;
revoke all on function public.visible_sessions(uuid, uuid, date, date) from public, anon, authenticated;

-- My schedule: camp days carry the camp, the group and which day of the camp it is.
create or replace function public.get_coach_schedule(p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_coach_id uuid := public.current_coach_id();
begin
  if v_coach_id is null then
    raise exception 'Only coaches have a schedule' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 62 then
    raise exception 'Pick a range of up to 62 days' using errcode = '22023';
  end if;

  perform public.expire_booking_requests(v_coach_id);

  return jsonb_build_object(
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', occ.id,
        'date', occ.occurrence_date,
        'start_time', occ.start_time,
        'end_time', occ.end_time,
        'duration_minutes', occ.duration_minutes,
        'session_type', occ.session_type,
        'session_name', occ.session_name,
        'price', occ.price,
        'capacity', occ.max_bookings_per_slot,
        'location', occ.location,
        'place', occ.place,
        'pillar', occ.pillar_slot,
        'position', occ.position,
        'visibility', occ.visibility,
        'offered_to', occ.offered_to,
        'offered_names', coalesce((
          select jsonb_agg(athlete.full_name order by athlete.full_name)
          from public.athlete_profiles as athlete
          where athlete.id = any(occ.offered_to)
        ), '[]'::jsonb),
        'details', occ.details,
        'is_draft', occ.is_draft,
        'series_id', occ.series_id,
        'camp_id', occ.camp_id,
        'camp_group_id', occ.camp_group_id,
        'camp_day_index', occ.camp_day_index,
        'camp', case when occ.camp_id is null then null else (
          select jsonb_build_object(
            'id', camp.id,
            'name', camp.package_name,
            'slug', camp.camp_slug,
            'days_total', camp.camp_ends_on - camp.camp_starts_on + 1,
            'group_name', grp.name,
            'group_spots', grp.spots,
            'signed_up', public.camp_group_taken(grp.id)
          )
          from public.coach_packages as camp
          left join public.camp_groups as grp on grp.id = occ.camp_group_id
          where camp.id = occ.camp_id
        ) end,
        'bookings', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', b.id,
            'athlete_id', b.athlete_id,
            'athlete_name', athlete.full_name,
            'status', b.status,
            'payment_status', b.payment_status,
            'expires_at', b.expires_at,
            'notes', b.notes,
            'created_at', b.created_at
          ) order by b.created_at)
          from public.coach_slot_bookings as b
          left join public.athlete_profiles as athlete on athlete.id = b.athlete_id
          where b.occurrence_id = occ.id
            and b.status in ('requested', 'pending_payment', 'booked', 'completed', 'no_show')
        ), '[]'::jsonb)
      ) order by occ.occurrence_date, occ.start_time)
      from public.coach_availability_slot_occurrences as occ
      where occ.coach_id = v_coach_id
        and occ.is_enabled
        and occ.occurrence_date between p_from and p_to
    ), '[]'::jsonb),
    'busy', coalesce((
      select jsonb_agg(jsonb_build_object('starts_at', busy.starts_at, 'ends_at', busy.ends_at) order by busy.starts_at)
      from public.coach_busy_blocks as busy
      where busy.coach_id = v_coach_id
        and busy.ends_at > public.eastern_timestamp(p_from, '00:00')
        and busy.starts_at < public.eastern_timestamp(p_to + 1, '00:00')
    ), '[]'::jsonb),
    'time_off', coalesce((
      select jsonb_agg(jsonb_build_object('date', off.off_date, 'note', off.note) order by off.off_date)
      from public.coach_time_off as off
      where off.coach_id = v_coach_id and off.off_date between p_from and p_to
    ), '[]'::jsonb),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', series.id,
        'session_type', series.session_type,
        'day_of_week', series.day_of_week,
        'start_time', series.start_time,
        'duration_minutes', series.duration_minutes,
        'location', series.location,
        'place', series.place,
        'ends_on', series.ends_on
      ))
      from public.coach_session_series as series
      where series.coach_id = v_coach_id and series.is_active
    ), '[]'::jsonb),
    'rules', (
      select jsonb_build_object(
        'new_family_booking', coach.new_family_booking,
        'booking_window_weeks', coach.booking_window_weeks,
        'locations', coalesce(to_jsonb(coach.locations), '[]'::jsonb),
        'hourly_rate', coach.hourly_rate,
        'slug', coach.slug
      )
      from public.coaches as coach where coach.id = v_coach_id
    ),
    'calendar', (
      select jsonb_build_object(
        'connected', true,
        'account_email', conn.account_email,
        'last_synced_at', conn.last_synced_at,
        'sync_error', conn.sync_error,
        'can_write', conn.can_write
      )
      from public.coach_calendar_connections as conn where conn.coach_id = v_coach_id
    )
  );
end;
$function$

;


-- Copy groups to another week: camp days are not copied.
create or replace function public.schedule_copy_groups(p_from date, p_to date, p_days integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := public.current_coach_id();
  v_src record;
  v_date date;
  v_count integer := 0;
begin
  if v_coach_id is null then
    raise exception 'Only coaches can copy sessions' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 6 or p_days not between 1 and 28 then
    raise exception 'Pick a day or a week to copy into' using errcode = '22023';
  end if;

  for v_src in
    select occ.*
    from public.coach_availability_slot_occurrences as occ
    where occ.coach_id = v_coach_id and occ.is_enabled and occ.session_type = 'group'
      and occ.camp_id is null
      and occ.occurrence_date between p_from - p_days and p_to - p_days
    order by occ.occurrence_date, occ.start_time
  loop
    v_date := v_src.occurrence_date + p_days;
    if public.eastern_timestamp(v_date, v_src.start_time) <= now() then
      continue;
    end if;
    if exists (
      select 1 from public.coach_availability_slot_occurrences as other
      where other.coach_id = v_coach_id and other.is_enabled and other.occurrence_date = v_date
        and other.start_time < v_src.end_time and v_src.start_time < other.end_time
    ) then
      continue;
    end if;
    insert into public.coach_availability_slot_occurrences (
      coach_id, occurrence_date, session_name, price, duration_minutes, start_time, end_time,
      session_type, location, place, pillar_slot, position, visibility, details, is_draft,
      is_enabled, max_bookings_per_slot
    ) values (
      v_coach_id, v_date, v_src.session_name, v_src.price, v_src.duration_minutes, v_src.start_time,
      v_src.end_time, 'group', v_src.location, v_src.place, v_src.pillar_slot, v_src.position,
      v_src.visibility, v_src.details, true, true, v_src.max_bookings_per_slot
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.schedule_copy_groups(date, date, integer) from public, anon;
grant execute on function public.schedule_copy_groups(date, date, integer) to authenticated;

-- Publish a week of groups: camp days are not put on the pick-and-pay card.
create or replace function public.schedule_publish_groups(
  p_from date,
  p_to date,
  p_title text,
  p_closes_at timestamptz,
  p_post_to_channel boolean,
  p_message text,
  p_link_base text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := public.current_coach_id();
  v_ids uuid[];
  v_offer_id uuid;
  v_conversation_id uuid;
  v_body text;
begin
  if v_coach_id is null then
    raise exception 'Only coaches can publish sessions' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 6 then
    raise exception 'Publish a day or a week at a time' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.coach_availability_slot_occurrences
    where coach_id = v_coach_id and is_draft and is_enabled and occurrence_date between p_from and p_to
  ) then
    raise exception 'There are no drafts to publish' using errcode = '22023';
  end if;

  update public.coach_availability_slot_occurrences
    set is_draft = false
    where coach_id = v_coach_id and is_draft and is_enabled and occurrence_date between p_from and p_to;

  select array_agg(id order by occurrence_date, start_time) into v_ids
  from public.coach_availability_slot_occurrences
  where coach_id = v_coach_id and is_enabled and not is_draft and session_type = 'group'
    and camp_id is null
    and occurrence_date between p_from and p_to
    and public.eastern_timestamp(occurrence_date, start_time) > now();

  insert into public.group_session_offers (coach_id, title, occurrence_ids, closes_at)
    values (v_coach_id, left(coalesce(nullif(trim(p_title), ''), 'Group sessions'), 120), v_ids, p_closes_at)
    returning id into v_offer_id;

  if p_post_to_channel then
    v_body := replace(left(trim(coalesce(p_message, '')), 900), '{link}', coalesce(p_link_base, '') || v_offer_id::text);
    if char_length(v_body) = 0 then
      v_body := 'New group sessions are up.';
    end if;
    v_conversation_id := public.get_or_create_my_coach_channel();
    insert into public.messages (conversation_id, sender_id, body, offer_id)
      values (v_conversation_id, auth.uid(), v_body, v_offer_id);
    update public.conversations
      set last_message_at = now(), last_message_text = left(v_body, 200)
      where id = v_conversation_id;
  end if;

  return v_offer_id;
end;
$$;
revoke all on function public.schedule_publish_groups(date, date, text, timestamptz, boolean, text, text) from public, anon;
grant execute on function public.schedule_publish_groups(date, date, text, timestamptz, boolean, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Existing camps (for example the Thanksgiving camp sold from the profile)
-- ---------------------------------------------------------------------------
-- Each gets a slug, its included list, and one group holding its current capacity and times;
-- active ones count as published. camp_capacity is not changed, and their profile purchase
-- flow (create-package-payment) and fee stay as they are. Schedule days are created the next
-- time the coach saves or publishes the camp (doing it here could clash with sessions he
-- already has).
do $$
declare
  v_camp record;
  v_start time;
  v_end time;
begin
  for v_camp in
    select * from public.coach_packages where kind = 'camp' order by created_at
  loop
  begin
    if v_camp.camp_slug is null then
      update public.coach_packages
        set camp_slug = public.camp_unique_slug(v_camp.coach_id, v_camp.package_name, v_camp.id)
        where id = v_camp.id;
    end if;

    if jsonb_array_length(coalesce(v_camp.camp_included, '[]'::jsonb)) = 0
       and (case when jsonb_typeof(v_camp.features) = 'array' then jsonb_array_length(v_camp.features) else 0 end) between 1 and 12 then
      update public.coach_packages
        set camp_included = (
          select coalesce(jsonb_agg(to_jsonb(left(btrim(value #>> '{}'), 120))), '[]'::jsonb)
          from jsonb_array_elements(v_camp.features)
          where btrim(coalesce(value #>> '{}', '')) <> ''
        )
        where id = v_camp.id;
    end if;

    if not exists (select 1 from public.camp_groups where camp_id = v_camp.id) then
      v_start := v_camp.camp_daily_start;
      v_end := v_camp.camp_daily_end;
      -- Group times are half hours between 07:00 and 21:00; anything else becomes 09:00-15:00
      -- and the coach adjusts it in the editor.
      if v_start is null or v_end is null or v_start < time '07:00' or v_end > time '21:00' or v_end <= v_start
         or extract(minute from v_start) not in (0, 30) or extract(minute from v_end) not in (0, 30)
         or extract(second from v_start) <> 0 or extract(second from v_end) <> 0 then
        v_start := time '09:00';
        v_end := time '15:00';
      end if;
      insert into public.camp_groups (camp_id, name, start_time, end_time, spots, sort_order)
      values (
        v_camp.id, 'All athletes', v_start, v_end,
        least(60, greatest(1, coalesce(v_camp.camp_capacity, 60))), 0
      );
    end if;

    if v_camp.is_active and v_camp.camp_published_at is null then
      update public.coach_packages set camp_published_at = now() where id = v_camp.id;
    end if;
  exception when others then
    -- For example co-coaches who left the organization (coach_packages_validate_camp): leave this
    -- camp as it was; the coach finishes it in the editor.
    raise warning 'Camp % not backfilled: %', v_camp.id, sqlerrm;
  end;
  end loop;
end;
$$;
