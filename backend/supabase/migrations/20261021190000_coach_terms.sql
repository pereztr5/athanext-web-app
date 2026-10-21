-- Coach terms live in the database next to Terms and Privacy, so the in-app /coach-terms page
-- (and Settings > Legal for coaches) read the published copy instead of an external link.
-- Mirrors public.terms_and_conditions: same columns, same timestamp trigger, anyone reads the
-- active row, only admins write. Nothing is seeded; the page shows a "being updated" state
-- until an admin publishes a row. Idempotent.

create table if not exists public.coach_terms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  version text,
  last_updated text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_coach_terms_created_at on public.coach_terms (created_at desc);
create index if not exists idx_coach_terms_is_active on public.coach_terms (is_active);

-- Same stamping as terms (set_terms_timestamps, from 20261021120000): edits set updated_at
-- and last_updated.
drop trigger if exists trg_coach_terms_timestamps on public.coach_terms;
create trigger trg_coach_terms_timestamps
  before update on public.coach_terms
  for each row execute function public.set_terms_timestamps();

alter table public.coach_terms enable row level security;

drop policy if exists "Allow public read active coach terms" on public.coach_terms;
create policy "Allow public read active coach terms"
  on public.coach_terms
  for select
  to public
  using (is_active = true);

drop policy if exists "Admins manage coach terms" on public.coach_terms;
create policy "Admins manage coach terms"
  on public.coach_terms
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.coach_terms to anon, authenticated;
