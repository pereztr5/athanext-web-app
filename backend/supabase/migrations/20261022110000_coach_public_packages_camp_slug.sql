-- Public coach profile camp cards link to the camp page (/<coach slug>/<camp slug>).
-- get_coach_public_packages now also returns camp_slug and camp_published_at, so the
-- profile can open the camp page instead of the old package checkout. The rest of the
-- function is the live definition, unchanged. Safe to re-run (create or replace).

CREATE OR REPLACE FUNCTION public.get_coach_public_packages(p_coach_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((
    select jsonb_agg(to_jsonb(src) order by src.created_at)
    from (
      select
        pkg.id,
        pkg.coach_id,
        pkg.package_name,
        pkg.description,
        pkg.session_count,
        pkg.duration_minutes,
        pkg.total_price,
        pkg.price_per_session,
        pkg.validity_days,
        pkg.is_active,
        pkg.kind,
        pkg.camp_starts_on,
        pkg.camp_ends_on,
        pkg.camp_daily_start,
        pkg.camp_daily_end,
        pkg.camp_location,
        pkg.camp_capacity,
        pkg.camp_age_min,
        pkg.camp_age_max,
        pkg.co_coach_ids,
        pkg.camp_slug,
        pkg.camp_published_at,
        pkg.created_at,
        case
          when pkg.kind = 'camp' and pkg.camp_capacity is not null then greatest(
            0,
            pkg.camp_capacity - coalesce((
              select count(*)::integer
              from public.package_purchases as purchase
              where purchase.package_id = pkg.id
                and purchase.status in ('active', 'expired', 'completed')
            ), 0)
          )
          else null
        end as spots_left,
        case
          when pkg.kind = 'camp' then coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', mate.id,
              'name', mate.name,
              'photo_url', nullif(btrim(coalesce(mate.profile_image_url, mate.image_url, '')), '')
            ) order by mate.name)
            from public.coaches as mate
            where mate.id = any(pkg.co_coach_ids)
          ), '[]'::jsonb)
          else '[]'::jsonb
        end as co_coaches
      from public.coach_packages as pkg
      where p_coach_id is not null
        and pkg.coach_id = p_coach_id
        and (
          pkg.is_active
          or pkg.coach_id = (
            select profile.coach_id
            from public.user_profiles as profile
            where profile.id = auth.uid()
          )
        )
    ) as src
  ), '[]'::jsonb);
$function$;

grant execute on function public.get_coach_public_packages(uuid) to anon, authenticated;
