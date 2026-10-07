-- Scheduled account deletion (ATH-91 follow-up). Families ask to delete their account in
-- Account Settings (user_profiles.deletion_requested_at); 14 days later this daily job runs
-- the shared clean-up (also used by the admin delete, which failed for athletes with past
-- sessions), clears the athlete's personal details and deletes the account. Coaches keep
-- their session records without the family's details.
-- Undo before then clears deletion_requested_at and nothing happens.
-- Financial records stay: paid bookings, payments and package purchases are kept, linked to
-- an anonymised athlete row with no login, so the login link becomes optional.

alter table public.athlete_profiles alter column user_id drop not null;
alter table public.athlete_profiles drop constraint if exists athlete_profiles_user_id_fkey;
alter table public.athlete_profiles
  add constraint athlete_profiles_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;

alter table public.package_purchases alter column user_id drop not null;
alter table public.package_purchases drop constraint if exists package_purchases_user_id_fkey;
alter table public.package_purchases
  add constraint package_purchases_user_id_fkey foreign key (user_id) references public.user_profiles(id) on delete set null;

-- The clean-up before an account is deleted, shared by the daily job and the admin delete.
-- Upcoming bookings are cancelled, a coach leaves the marketplace, and the athlete row stays
-- for coaches' records and payments without personal details or a login.
create or replace function public.prepare_account_deletion(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete_id uuid;
  v_coach_id uuid;
  v_today date := (timezone('America/New_York', now()))::date;
begin
  select athlete_id, coach_id into v_athlete_id, v_coach_id from public.user_profiles where id = p_user_id;

  update public.coach_slot_bookings as booking
    set status = 'canceled', canceled_at = now(), cancellation_reason = 'Account deleted', updated_at = now()
    from public.coach_availability_slot_occurrences as occurrence
    where booking.occurrence_id = occurrence.id
      and booking.status::text in ('booked', 'pending_payment', 'requested')
      and occurrence.occurrence_date >= v_today
      and ((v_athlete_id is not null and booking.athlete_id = v_athlete_id)
        or (v_coach_id is not null and booking.coach_id = v_coach_id));

  if v_athlete_id is not null then
    update public.athlete_profiles
      set user_id = null, full_name = 'Former athlete', phone_number = null, location = null,
          bio = null, profile_image_url = null, cover_image_urls = '{}', instagram_handle = null,
          high_school = null, season_goal = null, highlight_video_url = null, updated_at = now()
      where id = v_athlete_id;
  end if;
  if v_coach_id is not null then
    update public.coaches set status = 'hidden', updated_at = now() where id = v_coach_id;
  end if;

  update public.package_purchases set user_id = null where user_id = p_user_id;
  update public.coach_slot_bookings set created_by = null where created_by = p_user_id;
  update public.slot_feedback_v2 set created_by = null where created_by = p_user_id;
  update public.slot_attendance_v2 set created_by = null where created_by = p_user_id;
  update public.session_feedback_v2 set created_by = null where created_by = p_user_id;
end;
$$;

revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;

-- Admin delete (admin-accounts function): same checks as before, then the shared clean-up.
create or replace function public.admin_prepare_account_deletion(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();
  if p_user_id = auth.uid() then
    raise exception 'You cannot delete your own account';
  end if;
  if exists (
    select 1 from public.user_roles where user_id = p_user_id and role = 'admin'::public.app_role
  ) and (select count(*) from public.user_roles where role = 'admin'::public.app_role) <= 1 then
    raise exception 'The last admin account cannot be deleted';
  end if;
  perform public.prepare_account_deletion(p_user_id);
end;
$$;

-- Daily job: accounts whose deletion was asked for 14 or more days ago.
create or replace function public.run_due_account_deletions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_done integer := 0;
begin
  for v_user in
    select up.id
    from public.user_profiles as up
    where up.deletion_requested_at is not null
      and up.deletion_requested_at <= now() - interval '14 days'
      and not exists (
        select 1 from public.user_roles r where r.user_id = up.id and r.role = 'admin'::public.app_role
      )
  loop
    begin
      perform public.prepare_account_deletion(v_user);
      delete from public.user_profiles where id = v_user;
      delete from auth.users where id = v_user;
      v_done := v_done + 1;
    exception when others then
      raise warning 'Account deletion failed for %: %', v_user, sqlerrm;
    end;
  end loop;
  return v_done;
end;
$$;

revoke all on function public.run_due_account_deletions() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'delete-requested-accounts';
select cron.schedule('delete-requested-accounts', '30 7 * * *', 'select public.run_due_account_deletions()');
