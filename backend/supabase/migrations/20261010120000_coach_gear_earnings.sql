-- Business > Money in: "Gear and deals" is the coach's share of gear their athletes bought
-- through the AthaNext store (gear_purchases, linked to the coach), net of refunds, per
-- Eastern day for the last p_days days. The share matches the Working Copy (15%).

create or replace function public.get_coach_gear_earnings(p_days integer)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('date', day, 'amount', amount) order by day), '[]'::jsonb)
  from (
    select (timezone('America/New_York', purchase.purchased_at))::date as day,
           round(sum((purchase.amount - purchase.refunded_amount) * 0.15), 2) as amount
    from public.gear_purchases as purchase
    where purchase.coach_id = public.current_coach_id()
      and purchase.purchased_at >= now() - make_interval(days => greatest(1, least(p_days, 400)))
    group by 1
  ) as per_day;
$$;

revoke all on function public.get_coach_gear_earnings(integer) from public, anon;
grant execute on function public.get_coach_gear_earnings(integer) to authenticated;
