-- Storage rules for coach uploads in the athalink-images bucket.
--
-- 1. Camp cover photos upload to camps/<uuid>.<ext> and no rule allowed it, so every cover
--    upload failed with "new row violates row-level security policy". Coaches may now add files
--    there (insert only, like brand logos; names are random and uploads never overwrite).
-- 2. The coach photo rules compared storage.filename(up.name) (the coach's display name from
--    user_profiles) instead of the uploaded object's name, so coach photo uploads always failed.
--    They now check the object's own name: coach-profiles/<coach_id>-....

drop policy if exists "Coaches upload camp covers" on storage.objects;
create policy "Coaches upload camp covers" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'athalink-images'
    and (storage.foldername(objects.name))[1] = 'camps'
    and exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.coach_id is not null)
  );

drop policy if exists "Coaches upload own photos" on storage.objects;
create policy "Coaches upload own photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'athalink-images'
    and (storage.foldername(objects.name))[1] = 'coach-profiles'
    and exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.coach_id is not null
        and storage.filename(objects.name) like up.coach_id::text || '-%'
    )
  );

drop policy if exists "Coaches replace own photos" on storage.objects;
create policy "Coaches replace own photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'athalink-images'
    and (storage.foldername(objects.name))[1] = 'coach-profiles'
    and exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.coach_id is not null
        and storage.filename(objects.name) like up.coach_id::text || '-%'
    )
  );

drop policy if exists "Coaches remove own photos" on storage.objects;
create policy "Coaches remove own photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'athalink-images'
    and (storage.foldername(objects.name))[1] = 'coach-profiles'
    and exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.coach_id is not null
        and storage.filename(objects.name) like up.coach_id::text || '-%'
    )
  );
