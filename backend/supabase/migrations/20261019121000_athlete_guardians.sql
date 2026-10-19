-- Second guardian (Account settings > Parent or guardian). Until now the card only saved to the
-- browser and showed "Invite sent" without sending anything. A guardian row is kept per athlete;
-- the guardian-invite function emails them, and booking confirmations copy them while
-- copy_receipts is on. Guardians don't sign in to the family account (no shared access yet).

create table if not exists public.athlete_guardians (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  email text not null check (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  relationship text not null default 'Parent' check (length(relationship) <= 40),
  copy_receipts boolean not null default true,
  invited_by uuid not null default auth.uid() references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  emailed_at timestamptz,
  unique (athlete_id, email)
);

create index if not exists athlete_guardians_athlete_idx on public.athlete_guardians (athlete_id);

alter table public.athlete_guardians enable row level security;

-- The account that owns the athlete profile manages its guardians.
drop policy if exists athlete_guardians_owner_all on public.athlete_guardians;
create policy athlete_guardians_owner_all on public.athlete_guardians
  for all to authenticated
  using (exists (select 1 from public.athlete_profiles a where a.id = athlete_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.athlete_profiles a where a.id = athlete_id and a.user_id = auth.uid()));

grant select, insert, update, delete on public.athlete_guardians to authenticated;
