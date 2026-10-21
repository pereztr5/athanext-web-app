-- Coach photo uploads. The athalink-images bucket only let athletes write under
-- athlete-profiles/, so a coach saving a profile photo was refused.
--
-- The app writes photos as coach-profiles/<coach id>-<time>.<ext> and covers as
-- coach-profiles/covers/<coach id>-cover-<time>.<ext>. These policies let the signed-in
-- coach add, replace and remove only files whose name starts with their own coach id.
-- Reads stay public (athalink_images_public_read).

drop policy if exists "Coaches upload own photos" on storage.objects;
create policy "Coaches upload own photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'athalink-images'
    and (storage.foldername(name))[1] = 'coach-profiles'
    and exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and up.coach_id is not null
        and storage.filename(name) like up.coach_id::text || '-%'
    )
  );

drop policy if exists "Coaches replace own photos" on storage.objects;
create policy "Coaches replace own photos"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'athalink-images'
    and (storage.foldername(name))[1] = 'coach-profiles'
    and exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and up.coach_id is not null
        and storage.filename(name) like up.coach_id::text || '-%'
    )
  )
  with check (
    bucket_id = 'athalink-images'
    and (storage.foldername(name))[1] = 'coach-profiles'
    and exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and up.coach_id is not null
        and storage.filename(name) like up.coach_id::text || '-%'
    )
  );

drop policy if exists "Coaches remove own photos" on storage.objects;
create policy "Coaches remove own photos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'athalink-images'
    and (storage.foldername(name))[1] = 'coach-profiles'
    and exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and up.coach_id is not null
        and storage.filename(name) like up.coach_id::text || '-%'
    )
  );
