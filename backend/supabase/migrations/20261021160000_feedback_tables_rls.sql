-- Tighten row level security on session feedback, attendance and per-athlete notes.
--
-- Before: any signed-in user could read, insert and update every row of session_feedback_v2,
-- slot_attendance_v2 and slot_feedback_v2 ("Enable ... for authenticated users", qual true).
-- After:
--   * the session's coach (the occurrence's coach_id = current_coach_id()) reads, inserts and
--     updates rows for their own sessions;
--   * families read: the session summary for sessions they have a booking on, and attendance
--     and notes only for their own athlete;
--   * admins keep the existing is_admin() policies on slot_feedback_v2 and get read access to
--     the other two (they had it through the old open policies).
-- The feedback RPCs (submit_session_feedback, set_session_note, upsert_*_v2, get_* screens)
-- are security definer and are not affected. No delete policies existed and none are added.
-- Safe to run more than once.

-- Helpers are security definer so the policies don't depend on RLS of the tables they read.
create or replace function public.coach_owns_occurrence(p_slot_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.current_coach_id() is not null and exists (
    select 1 from public.coach_availability_slot_occurrences o
    where o.id = p_slot_id and o.coach_id = public.current_coach_id()
  );
$$;

-- The athletes the signed-in family account looks after (the profile's athlete, or athletes
-- whose profile belongs to this user), the same two links bookings and invoices use.
create or replace function public.family_athlete_ids()
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select up.athlete_id from public.user_profiles up where up.id = auth.uid() and up.athlete_id is not null
  union
  select a.id from public.athlete_profiles a where a.user_id = auth.uid();
$$;

create or replace function public.family_booked_occurrence(p_slot_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.coach_slot_bookings b
    where b.occurrence_id = p_slot_id and b.athlete_id in (select public.family_athlete_ids())
  );
$$;

revoke execute on function public.coach_owns_occurrence(uuid) from anon;
revoke execute on function public.family_athlete_ids() from anon;
revoke execute on function public.family_booked_occurrence(uuid) from anon;

-- session_feedback_v2: one row per session (summary, no-show).
alter table public.session_feedback_v2 enable row level security;
drop policy if exists "Enable insert for authenticated users only" on public.session_feedback_v2;
drop policy if exists "Enable read access for all authenticated users" on public.session_feedback_v2;
drop policy if exists "Enable update for authenticated users only" on public.session_feedback_v2;
drop policy if exists "Coaches read feedback on their sessions" on public.session_feedback_v2;
drop policy if exists "Coaches add feedback on their sessions" on public.session_feedback_v2;
drop policy if exists "Coaches update feedback on their sessions" on public.session_feedback_v2;
drop policy if exists "Families read feedback on sessions they booked" on public.session_feedback_v2;
drop policy if exists "Admin portal reads session feedback" on public.session_feedback_v2;

create policy "Coaches read feedback on their sessions" on public.session_feedback_v2
  for select to authenticated using (public.coach_owns_occurrence(slot_id));
create policy "Coaches add feedback on their sessions" on public.session_feedback_v2
  for insert to authenticated
  with check (public.coach_owns_occurrence(slot_id) and (coach_id is null or coach_id = public.current_coach_id()));
create policy "Coaches update feedback on their sessions" on public.session_feedback_v2
  for update to authenticated
  using (public.coach_owns_occurrence(slot_id))
  with check (public.coach_owns_occurrence(slot_id) and (coach_id is null or coach_id = public.current_coach_id()));
create policy "Families read feedback on sessions they booked" on public.session_feedback_v2
  for select to authenticated using (public.family_booked_occurrence(slot_id));
create policy "Admin portal reads session feedback" on public.session_feedback_v2
  for select to authenticated using (public.is_admin());

-- slot_attendance_v2: one row per booking.
alter table public.slot_attendance_v2 enable row level security;
drop policy if exists "Enable insert for authenticated users only" on public.slot_attendance_v2;
drop policy if exists "Enable read access for all authenticated users" on public.slot_attendance_v2;
drop policy if exists "Enable update for authenticated users only" on public.slot_attendance_v2;
drop policy if exists "Coaches read attendance on their sessions" on public.slot_attendance_v2;
drop policy if exists "Coaches add attendance on their sessions" on public.slot_attendance_v2;
drop policy if exists "Coaches update attendance on their sessions" on public.slot_attendance_v2;
drop policy if exists "Families read their athlete's attendance" on public.slot_attendance_v2;
drop policy if exists "Admin portal reads attendance" on public.slot_attendance_v2;

create policy "Coaches read attendance on their sessions" on public.slot_attendance_v2
  for select to authenticated using (public.coach_owns_occurrence(slot_id));
create policy "Coaches add attendance on their sessions" on public.slot_attendance_v2
  for insert to authenticated with check (public.coach_owns_occurrence(slot_id));
create policy "Coaches update attendance on their sessions" on public.slot_attendance_v2
  for update to authenticated
  using (public.coach_owns_occurrence(slot_id))
  with check (public.coach_owns_occurrence(slot_id));
create policy "Families read their athlete's attendance" on public.slot_attendance_v2
  for select to authenticated using (athlete_id in (select public.family_athlete_ids()));
create policy "Admin portal reads attendance" on public.slot_attendance_v2
  for select to authenticated using (public.is_admin());

-- slot_feedback_v2: one row per booking (coach note, family rating). Admin policies stay.
alter table public.slot_feedback_v2 enable row level security;
drop policy if exists "Enable insert for authenticated users only" on public.slot_feedback_v2;
drop policy if exists "Enable read access for all authenticated users" on public.slot_feedback_v2;
drop policy if exists "Enable update for authenticated users only" on public.slot_feedback_v2;
drop policy if exists "Coaches read notes on their sessions" on public.slot_feedback_v2;
drop policy if exists "Coaches add notes on their sessions" on public.slot_feedback_v2;
drop policy if exists "Coaches update notes on their sessions" on public.slot_feedback_v2;
drop policy if exists "Families read their athlete's notes" on public.slot_feedback_v2;

create policy "Coaches read notes on their sessions" on public.slot_feedback_v2
  for select to authenticated using (public.coach_owns_occurrence(slot_id));
create policy "Coaches add notes on their sessions" on public.slot_feedback_v2
  for insert to authenticated
  with check (public.coach_owns_occurrence(slot_id) and (coach_id is null or coach_id = public.current_coach_id()));
create policy "Coaches update notes on their sessions" on public.slot_feedback_v2
  for update to authenticated
  using (public.coach_owns_occurrence(slot_id))
  with check (public.coach_owns_occurrence(slot_id) and (coach_id is null or coach_id = public.current_coach_id()));
create policy "Families read their athlete's notes" on public.slot_feedback_v2
  for select to authenticated using (athlete_id in (select public.family_athlete_ids()));
