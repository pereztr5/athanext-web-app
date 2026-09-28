-- Allow owning coaches to insert/update their own coach_packages rows.
-- Staging currently only allows admin writes + public read of is_active packages.
-- Ownership is via user_profiles.coach_id (user_profiles.id = auth.uid()).

-- Owning coaches can read their packages (including inactive) for editing.
drop policy if exists "Coaches can select own packages" on public.coach_packages;
create policy "Coaches can select own packages"
  on public.coach_packages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_profiles up
      where up.id = auth.uid()
        and up.coach_id = coach_packages.coach_id
    )
  );

-- Owning coaches can insert packages for themselves.
drop policy if exists "Coaches can insert own packages" on public.coach_packages;
create policy "Coaches can insert own packages"
  on public.coach_packages
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.user_profiles up
      where up.id = auth.uid()
        and up.coach_id = coach_packages.coach_id
    )
  );

-- Owning coaches can update their own packages.
drop policy if exists "Coaches can update own packages" on public.coach_packages;
create policy "Coaches can update own packages"
  on public.coach_packages
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.user_profiles up
      where up.id = auth.uid()
        and up.coach_id = coach_packages.coach_id
    )
  )
  with check (
    exists (
      select 1
      from public.user_profiles up
      where up.id = auth.uid()
        and up.coach_id = coach_packages.coach_id
    )
  );
