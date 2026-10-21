-- A coach's video-call link (Zoom, Meet, Teams). Kept off public.coaches so the
-- marketplace listing never includes it. The coach reads and writes their own row.
-- A family can read it only after they have a booking with that coach. Idempotent.

create table if not exists public.coach_meeting_links (
  coach_id uuid primary key references public.coaches (id) on delete cascade,
  meeting_url text not null,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint coach_meeting_links_https check (
    char_length(meeting_url) between 12 and 500
    and meeting_url ~ '^https://'
    and meeting_url !~ '[[:space:]]'
  )
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
      select 1 from public.coach_slot_bookings b
      where b.coach_id = coach_meeting_links.coach_id
        and b.athlete_id in (select public.family_athlete_ids())
    )
  );

grant select, insert, update, delete on public.coach_meeting_links to authenticated;
