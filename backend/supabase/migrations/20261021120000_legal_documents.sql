-- Terms and Privacy live in the database (the app reads them in the sign-up box, the legal
-- overlay, Settings > Legal and /terms-and-conditions, /privacy-policy). The tables were made
-- in the dashboard; this captures them as they are live so a fresh database matches.
-- Idempotent: nothing changes where the tables already exist.
--
-- Versions: terms_and_conditions.version is the published terms version. privacy_policy has
-- no version column, so the app records its last_updated date as the accepted version.

create table if not exists public.terms_and_conditions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  version text,
  last_updated text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_terms_created_at on public.terms_and_conditions (created_at desc);
create index if not exists idx_terms_is_active on public.terms_and_conditions (is_active);

create table if not exists public.privacy_policy (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Privacy Policy',
  content text not null,
  last_updated text not null,
  is_published boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Edits stamp updated_at and last_updated (terms only, as live).
create or replace function public.set_terms_timestamps()
returns trigger
language plpgsql
as $$ begin new.updated_at = now(); new.last_updated = current_date; return new; end; $$;

drop trigger if exists trg_terms_timestamps on public.terms_and_conditions;
create trigger trg_terms_timestamps
  before update on public.terms_and_conditions
  for each row execute function public.set_terms_timestamps();

alter table public.terms_and_conditions enable row level security;
alter table public.privacy_policy enable row level security;

-- Anyone, signed in or not, reads the current documents. Admins manage them.
drop policy if exists "Allow public read active terms" on public.terms_and_conditions;
create policy "Allow public read active terms"
  on public.terms_and_conditions
  for select
  to public
  using (is_active = true);

drop policy if exists "Admins manage terms" on public.terms_and_conditions;
create policy "Admins manage terms"
  on public.terms_and_conditions
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Allow public read published content" on public.privacy_policy;
create policy "Allow public read published content"
  on public.privacy_policy
  for select
  to public
  using (is_published = true);

drop policy if exists "Admins manage privacy policy" on public.privacy_policy;
create policy "Admins manage privacy policy"
  on public.privacy_policy
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.terms_and_conditions to anon, authenticated;
grant select on public.privacy_policy to anon, authenticated;
