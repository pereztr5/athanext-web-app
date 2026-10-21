-- Athlete and parent photo uploads. The athalink-images bucket only had a public read policy
-- (plus brand logos), so every athlete photo upload was refused.
--
-- The app writes photos as athlete-profiles/<user id>-<time>.<ext> and covers as
-- athlete-profiles/covers/<user id>-cover-<time>-<n>.<ext>. These policies let a signed-in
-- person add, replace and remove only files under athlete-profiles/ whose name starts with
-- their own user id. Reads stay public (athalink_images_public_read).

drop policy if exists "Athletes upload own photos" on storage.objects;
create policy "Athletes upload own photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'athalink-images'
    and (storage.foldername(name))[1] = 'athlete-profiles'
    and storage.filename(name) like auth.uid()::text || '-%'
  );

drop policy if exists "Athletes replace own photos" on storage.objects;
create policy "Athletes replace own photos"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'athalink-images'
    and (storage.foldername(name))[1] = 'athlete-profiles'
    and storage.filename(name) like auth.uid()::text || '-%'
  )
  with check (
    bucket_id = 'athalink-images'
    and (storage.foldername(name))[1] = 'athlete-profiles'
    and storage.filename(name) like auth.uid()::text || '-%'
  );

drop policy if exists "Athletes remove own photos" on storage.objects;
create policy "Athletes remove own photos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'athalink-images'
    and (storage.foldername(name))[1] = 'athlete-profiles'
    and storage.filename(name) like auth.uid()::text || '-%'
  );
