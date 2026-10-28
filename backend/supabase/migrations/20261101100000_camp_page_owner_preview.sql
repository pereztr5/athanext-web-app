-- Camp page: the camp's own coach (or an admin) sees "how families see it" with Edit on top,
-- drafts included. Families still only see published camps. Safe to run more than once.

create or replace function public.get_camp_page(p_coach_slug text, p_camp_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'id', pkg.id,
    'name', pkg.package_name,
    'description', pkg.description,
    'tags', to_jsonb(pkg.camp_tags),
    'cover_url', coalesce(pkg.camp_cover_url, nullif(btrim(coalesce(coach.profile_image_url, coach.image_url, '')), '')),
    'cover_is_coach_photo', pkg.camp_cover_url is null,
    'price_cents', pkg.total_price,
    'days', pkg.camp_ends_on - pkg.camp_starts_on + 1,
    'per_day_cents', round(pkg.total_price::numeric / greatest(1, pkg.camp_ends_on - pkg.camp_starts_on + 1))::integer,
    'starts_on', pkg.camp_starts_on,
    'ends_on', pkg.camp_ends_on,
    'location', pkg.camp_location,
    'included', pkg.camp_included,
    'age_min', pkg.camp_age_min,
    'age_max', pkg.camp_age_max,
    'pay_direct', pkg.camp_pay_direct,
    'waiver_url', pkg.camp_waiver_url,
    'published', pkg.camp_published_at is not null,
    'can_edit', public.camp_editor_coach_id(pkg.id) is not null,
    'open', pkg.camp_ends_on >= public.camp_today(),
    'spots_left', case when pkg.camp_capacity is null then null
                       else greatest(0, pkg.camp_capacity - public.camp_taken(pkg.id)) end,
    'coach', jsonb_build_object(
      'id', coach.id,
      'name', coach.name,
      'slug', coach.slug,
      'photo_url', nullif(btrim(coalesce(coach.profile_image_url, coach.image_url, '')), ''),
      'bio', coach.bio,
      'years_experience', coach.years_experience,
      'rating', coach.rating,
      'total_reviews', coach.total_reviews,
      'cancellation_policy', coach.cancellation_policy
    ),
    'linked_coach', case when linked.id is null then null else jsonb_build_object(
      'id', linked.id,
      'name', linked.name,
      'slug', linked.slug,
      'photo_url', nullif(btrim(coalesce(linked.profile_image_url, linked.image_url, '')), '')
    ) end,
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'description', g.description,
        'start_time', to_char(g.start_time, 'HH24:MI'),
        'end_time', to_char(g.end_time, 'HH24:MI'),
        'spots', g.spots,
        'spots_left', g.spots_left,
        'full', g.spots_left <= 0
      ) order by g.sort_order, g.created_at)
      from (
        select grp.*,
          least(
            greatest(0, grp.spots - public.camp_group_taken(grp.id)),
            case when pkg.camp_capacity is null then grp.spots
                 else greatest(0, pkg.camp_capacity - public.camp_taken(pkg.id)) end
          ) as spots_left
        from public.camp_groups as grp
        where grp.camp_id = pkg.id
      ) as g
    ), '[]'::jsonb)
  )
  from public.coaches as coach
  join public.coach_packages as pkg on pkg.coach_id = coach.id
  left join public.coaches as linked on linked.id = pkg.camp_linked_coach_id and linked.deactivated_at is null
  where coach.slug = p_coach_slug
    and coach.deactivated_at is null
    and pkg.kind = 'camp'
    and pkg.camp_slug = p_camp_slug
    and pkg.is_active
    and (pkg.camp_published_at is not null or public.camp_editor_coach_id(pkg.id) is not null)
    and pkg.camp_starts_on is not null
    and pkg.camp_ends_on is not null
  limit 1;
$function$;

notify pgrst, 'reload schema';
