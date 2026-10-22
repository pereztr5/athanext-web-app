-- A coach's video-call link (Zoom, Meet, Teams). Kept off public.coaches so the
-- marketplace listing never includes it. The coach reads and writes their own row.
-- A family can read it only while they have a live booking with that coach (booked or
-- awaiting payment) for a session that is upcoming or ended less than a day ago. Idempotent.

create table if not exists public.coach_meeting_links (
  coach_id uuid primary key references public.coaches (id) on delete cascade,
  meeting_url text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

-- The same rule as frontend/src/utils/meetingUrl.ts (MEETING_URL_PATTERN, MEETING_URL_MAX);
-- meetingUrl.test.ts checks this file uses the identical pattern. https only, a host with a
-- dot, no user:password@, no spaces, 500 characters at most.
alter table public.coach_meeting_links drop constraint if exists coach_meeting_links_https;
alter table public.coach_meeting_links add constraint coach_meeting_links_https check (
  char_length(meeting_url) <= 500
  and meeting_url ~ '^https://[^/?#@\s]+\.[^/?#@\s]+([/?#]\S*)?$'
);

alter table public.coach_meeting_links enable row level security;

drop policy if exists "Coaches manage their meeting link" on public.coach_meeting_links;
create policy "Coaches manage their meeting link"
  on public.coach_meeting_links
  for all
  to authenticated
  using (coach_id = public.current_coach_id())
  with check (coach_id = public.current_coach_id());

drop policy if exists "Booked families read the meeting link" on public.coach_meeting_links;
create policy "Booked families read the meeting link"
  on public.coach_meeting_links
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.coach_slot_bookings b
      join public.coach_availability_slot_occurrences o on o.id = b.occurrence_id
      where b.coach_id = coach_meeting_links.coach_id
        and b.athlete_id in (select public.family_athlete_ids())
        and b.status in ('booked', 'pending_payment')
        and public.eastern_timestamp(o.occurrence_date, coalesce(o.end_time, o.start_time)) > now() - interval '1 day'
    )
  );

grant select, insert, update, delete on public.coach_meeting_links to authenticated;
