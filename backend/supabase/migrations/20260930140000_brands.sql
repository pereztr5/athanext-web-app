-- ATH-56: brands with logos, linked to coaches.
-- Separate from the free-text coaches.company field, which still drives the academy filter.
-- Coaches create brands directly (live immediately); only the creator or an admin edits one.
-- Brands are publicly readable so a future Gear page can match Shopify vendors by name.

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  logo_url text,
  website text,
  created_by uuid default auth.uid() references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One brand per name, ignoring case and extra whitespace ("SetGK" = " setgk ").
create unique index if not exists brands_name_key
  on public.brands (lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));

create table if not exists public.coach_brands (
  coach_id uuid not null references public.coaches(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (coach_id, brand_id)
);

create index if not exists coach_brands_brand_id_idx
  on public.coach_brands (brand_id);

-- Same body as the existing helper on staging; defined here so the trigger doesn't depend on it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists brands_set_updated_at on public.brands;
create trigger brands_set_updated_at
  before update on public.brands
  for each row execute function public.set_updated_at();

alter table public.brands enable row level security;
alter table public.coach_brands enable row level security;

revoke all on public.brands from anon, authenticated;
revoke all on public.coach_brands from anon, authenticated;
grant select on public.brands to anon, authenticated;
grant insert, update on public.brands to authenticated;
grant select on public.coach_brands to anon, authenticated;
grant insert, update, delete on public.coach_brands to authenticated;

drop policy if exists "Anyone can read brands" on public.brands;
create policy "Anyone can read brands"
  on public.brands
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Coaches can create brands" on public.brands;
create policy "Coaches can create brands"
  on public.brands
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and up.coach_id is not null
    )
  );

drop policy if exists "Creator or admin can update brands" on public.brands;
create policy "Creator or admin can update brands"
  on public.brands
  for update
  to authenticated
  using (
    created_by = auth.uid()
    or public.has_role(_user_id := auth.uid(), _role := 'admin')
  )
  with check (
    created_by = auth.uid()
    or public.has_role(_user_id := auth.uid(), _role := 'admin')
  );

drop policy if exists "Anyone can read coach brands" on public.coach_brands;
create policy "Anyone can read coach brands"
  on public.coach_brands
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Coaches can add own brands" on public.coach_brands;
create policy "Coaches can add own brands"
  on public.coach_brands
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and up.coach_id = coach_brands.coach_id
    )
  );

drop policy if exists "Coaches can reorder own brands" on public.coach_brands;
create policy "Coaches can reorder own brands"
  on public.coach_brands
  for update
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and up.coach_id = coach_brands.coach_id
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and up.coach_id = coach_brands.coach_id
    )
  );

drop policy if exists "Coaches can remove own brands" on public.coach_brands;
create policy "Coaches can remove own brands"
  on public.coach_brands
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and up.coach_id = coach_brands.coach_id
    )
  );

-- Logo uploads. Staging's athalink-images bucket only has a public read policy,
-- so allow coaches to add new files under brands/ (no overwrite or delete).
drop policy if exists "Coaches can upload brand logos" on storage.objects;
create policy "Coaches can upload brand logos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'athalink-images'
    and (storage.foldername(name))[1] = 'brands'
    and exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and up.coach_id is not null
    )
  );
