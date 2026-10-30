-- ATH-105: admins can add, remove and reorder the brands on any coach's profile
-- (public.coach_brands) from the admin portal's Edit coach page.
-- Until now only the coach's own account could change these rows; reads are already public.
-- Additive: one policy. Safe to run more than once.

drop policy if exists "Admin portal manages coach brands" on public.coach_brands;
create policy "Admin portal manages coach brands"
  on public.coach_brands
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- The admin Brands page: admins who aren't coaches can add brands, and can delete them.
drop policy if exists "Admin portal creates brands" on public.brands;
create policy "Admin portal creates brands"
  on public.brands
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admin portal deletes brands" on public.brands;
create policy "Admin portal deletes brands"
  on public.brands
  for delete
  to authenticated
  using (public.is_admin());
