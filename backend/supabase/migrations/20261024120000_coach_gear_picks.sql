-- Coach gear picks: the AthaNext store products a coach recommends on their profile.
--
-- * coach_gear_picks holds one row per picked product, by Shopify handle (stable across the
--   Storefront API), in the coach's order (position 0 first). At most 12 per coach.
-- * Anyone can read picks (they show on public coach profiles). No one writes the table
--   directly; set_my_gear_picks() replaces the signed-in coach's whole list in one step.
-- * Handles no longer in the store are kept; the app skips them when it shows the picks.
-- Safe to run more than once.

create table if not exists public.coach_gear_picks (
  coach_id uuid not null references public.coaches(id) on delete cascade,
  product_handle text not null,
  position smallint not null,
  created_at timestamptz not null default now(),
  primary key (coach_id, product_handle),
  constraint coach_gear_picks_handle_format check (product_handle ~ '^[a-z0-9][a-z0-9-]{0,199}$'),
  constraint coach_gear_picks_position_range check (position between 0 and 11)
);

alter table public.coach_gear_picks enable row level security;

drop policy if exists "Anyone can read coach gear picks" on public.coach_gear_picks;
create policy "Anyone can read coach gear picks"
  on public.coach_gear_picks
  for select
  to anon, authenticated
  using (true);

revoke all on table public.coach_gear_picks from public, anon, authenticated;
grant select on table public.coach_gear_picks to anon, authenticated;

-- Replaces the signed-in coach's picks with p_handles, in that order. Handles are trimmed and
-- lowercased, blanks are skipped and repeats keep their first place. An empty list clears the
-- picks. Returns the saved handles in order.
create or replace function public.set_my_gear_picks(p_handles text[])
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_handles text[];
begin
  if v_coach is null then
    raise exception 'Only coaches can pick gear' using errcode = '42501';
  end if;

  select coalesce(array_agg(handle order by first_at), '{}')
  into v_handles
  from (
    select lower(trim(h)) as handle, min(ord) as first_at
    from unnest(coalesce(p_handles, '{}'::text[])) with ordinality as t(h, ord)
    where nullif(trim(h), '') is not null
    group by lower(trim(h))
  ) as picked;

  if cardinality(v_handles) > 12 then
    raise exception 'Pick up to 12 products' using errcode = '22023', hint = 'too_many';
  end if;

  if exists (select 1 from unnest(v_handles) as h where h !~ '^[a-z0-9][a-z0-9-]{0,199}$') then
    raise exception 'That product is not in the store' using errcode = '22023', hint = 'bad_handle';
  end if;

  -- One save at a time per coach, so two quick saves can't mix their lists.
  perform pg_advisory_xact_lock(hashtext('coach_gear_picks:' || v_coach::text));

  delete from public.coach_gear_picks where coach_id = v_coach;

  insert into public.coach_gear_picks (coach_id, product_handle, position)
  select v_coach, h, (ord - 1)::smallint
  from unnest(v_handles) with ordinality as t(h, ord);

  return v_handles;
end;
$$;

revoke all on function public.set_my_gear_picks(text[]) from public, anon, authenticated;
grant execute on function public.set_my_gear_picks(text[]) to authenticated;
