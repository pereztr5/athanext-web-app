-- "Report an issue" on a family's session (My sessions and the session page).
--
-- session_issue_reports holds each report: the booking, who sent it, the athlete and coach,
-- the reason (safety, coach didn't show, payment, something else), what happened, and where
-- support is with it (new, in review, resolved).
-- * report_session_issue() is the only way in: it checks the caller is the family on that
--   booking, then saves the report. The report-session-issue edge function then emails
--   support@athanext.com right away (safety concerns marked URGENT) and sends the family a
--   confirmation, and stamps emailed_at.
-- * Families read their own reports. Admins read and update all of them (the admin portal).
-- Safe to run more than once.

create table if not exists public.session_issue_reports (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.coach_slot_bookings(id) on delete set null,
  occurrence_id uuid references public.coach_availability_slot_occurrences(id) on delete set null,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  athlete_id uuid references public.athlete_profiles(id) on delete set null,
  coach_id uuid references public.coaches(id) on delete set null,
  reason text not null check (reason in ('safety', 'coach_no_show', 'payment', 'other')),
  details text not null check (char_length(details) between 1 and 2000),
  status text not null default 'new' check (status in ('new', 'in_review', 'resolved')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 2000),
  emailed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists session_issue_reports_status_idx on public.session_issue_reports (status, created_at desc);
create index if not exists session_issue_reports_reporter_idx on public.session_issue_reports (reporter_id, created_at desc);
create index if not exists session_issue_reports_booking_idx on public.session_issue_reports (booking_id);

drop trigger if exists trg_session_issue_reports_updated_at on public.session_issue_reports;
create trigger trg_session_issue_reports_updated_at
  before update on public.session_issue_reports
  for each row execute function public.set_updated_at();

alter table public.session_issue_reports enable row level security;

drop policy if exists "Reporters read their reports" on public.session_issue_reports;
create policy "Reporters read their reports" on public.session_issue_reports
  for select to authenticated using (reporter_id = auth.uid());
drop policy if exists "Admins read issue reports" on public.session_issue_reports;
create policy "Admins read issue reports" on public.session_issue_reports
  for select to authenticated using (public.is_admin());
drop policy if exists "Admins update issue reports" on public.session_issue_reports;
create policy "Admins update issue reports" on public.session_issue_reports
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Inserts go through report_session_issue() only.
revoke all on public.session_issue_reports from anon;
revoke insert, delete on public.session_issue_reports from authenticated;
grant select, update on public.session_issue_reports to authenticated;

create or replace function public.report_session_issue(p_booking_id uuid, p_reason text, p_details text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_booking public.coach_slot_bookings;
  v_details text := trim(coalesce(p_details, ''));
  v_id uuid;
begin
  if v_me is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in ('safety', 'coach_no_show', 'payment', 'other') then
    raise exception 'Choose what the issue is about' using errcode = '22023';
  end if;
  if char_length(v_details) < 10 then
    raise exception 'Tell us a bit more about what happened' using errcode = '22023';
  end if;
  if char_length(v_details) > 2000 then
    raise exception 'Use 2000 characters or fewer' using errcode = '22023';
  end if;

  select * into v_booking from public.coach_slot_bookings where id = p_booking_id;
  -- The family on the booking: the account's athlete, an athlete profile this account owns,
  -- or the account that made the booking.
  if v_booking.id is null or not (
    v_booking.created_by = v_me
    or v_booking.athlete_id in (
      select profile.athlete_id from public.user_profiles as profile where profile.id = v_me and profile.athlete_id is not null
      union
      select athlete.id from public.athlete_profiles as athlete where athlete.user_id = v_me
    )
  ) then
    raise exception 'Session not found' using errcode = '42501';
  end if;

  if (
    select count(*) from public.session_issue_reports
    where reporter_id = v_me and created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception 'You''ve sent several reports today. Email support@athanext.com and we''ll help' using errcode = '22023';
  end if;

  insert into public.session_issue_reports (booking_id, occurrence_id, reporter_id, athlete_id, coach_id, reason, details)
  values (v_booking.id, v_booking.occurrence_id, v_me, v_booking.athlete_id, v_booking.coach_id, p_reason, v_details)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.report_session_issue(uuid, text, text) from public, anon;
grant execute on function public.report_session_issue(uuid, text, text) to authenticated;
