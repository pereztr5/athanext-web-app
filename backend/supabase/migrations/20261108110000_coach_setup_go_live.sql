-- Coach setup (sign-up redesign, Oct 31): after creating their account, coaches go through 7
-- setup steps. Photo, pricing, availability and payout details are required before they go
-- live on the marketplace (listed); bio, Instagram and credentials can wait.

-- Where each setup step stands, for the coach (or an admin).
create or replace function public.coach_setup_status(p_coach_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select c.* from public.coaches c
    where c.id = coalesce(p_coach_id, public.current_coach_id())
      and (c.id = public.current_coach_id() or public.is_admin())
  ),
  today as (select (timezone('America/New_York', now()))::date as d),
  status as (
    select
      t.id,
      t.listed,
      coalesce(nullif(btrim(t.profile_image_url), ''), nullif(btrim(t.image_url), '')) is not null as photo,
      coalesce(nullif(btrim(t.bio), ''), '') <> '' as bio,
      coalesce(nullif(btrim(t.instagram_handle), ''), '') <> '' as instagram,
      exists (select 1 from public.coach_certifications x where x.coach_id = t.id)
        or exists (select 1 from public.coach_achievements x where x.coach_id = t.id) as credentials,
      coalesce(t.hourly_rate, 0) > 0
        or exists (
          select 1 from public.coach_packages p
          where p.coach_id = t.id and p.is_active and coalesce(p.kind, 'package') <> 'camp' and coalesce(p.total_price, 0) > 0
        )
        or exists (
          select 1 from public.coach_availability_slot_occurrences o, today
          where o.coach_id = t.id and o.occurrence_date >= today.d and coalesce(o.price, 0) > 0
        ) as pricing,
      exists (
          select 1 from public.coach_availability_slot_occurrences o, today
          where o.coach_id = t.id and o.occurrence_date >= today.d and o.is_enabled and not o.is_draft
        )
        or exists (
          select 1 from public.coach_session_series s, today
          where s.coach_id = t.id and s.is_active and (s.ends_on is null or s.ends_on >= today.d)
        ) as availability,
      exists (
        select 1 from public.coach_payout_accounts a
        where a.coach_id = t.id and (a.details_submitted or a.payouts_enabled)
      ) as payouts
    from target t
  )
  select jsonb_build_object(
    'coach_id', id,
    'listed', listed,
    'photo', photo,
    'bio', bio,
    'instagram', instagram,
    'credentials', credentials,
    'pricing', pricing,
    'availability', availability,
    'payouts', payouts,
    'ready', photo and pricing and availability and payouts
  )
  from status;
$$;

grant execute on function public.coach_setup_status(uuid) to authenticated;

-- A coach can't put themselves on the marketplace until the required steps are done. Admins can,
-- and coaches already listed aren't affected.
create or replace function public.coaches_require_setup_to_list()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status jsonb;
  v_missing text[] := '{}';
begin
  if not new.listed or coalesce(old.listed, false) or auth.uid() is null or public.is_admin() then
    return new;
  end if;
  v_status := public.coach_setup_status(new.id);
  if v_status is null or (v_status->>'ready')::boolean then
    return new;
  end if;
  if not (v_status->>'photo')::boolean then v_missing := array_append(v_missing, 'a profile photo'); end if;
  if not (v_status->>'pricing')::boolean then v_missing := array_append(v_missing, 'your prices'); end if;
  if not (v_status->>'availability')::boolean then v_missing := array_append(v_missing, 'your availability'); end if;
  if not (v_status->>'payouts')::boolean then v_missing := array_append(v_missing, 'payout details'); end if;
  raise exception 'Before going live, add %', array_to_string(v_missing, ', ')
    using errcode = 'P0001', hint = 'setup_incomplete';
end;
$$;

drop trigger if exists coaches_require_setup_to_list on public.coaches;
create trigger coaches_require_setup_to_list
  before update of listed on public.coaches
  for each row execute function public.coaches_require_setup_to_list();
