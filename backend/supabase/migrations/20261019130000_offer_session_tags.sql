-- Plan your week: each group session needs an age group or level (U12, Youth development)
-- before the week is sent. The label is edited on the draft (occurrence details) and
-- copied onto the published pick-and-pay card so it stays with the week families see.
-- session_tags is a jsonb object of occurrence id to label. Null until a week is tagged.

alter table public.group_session_offers
  add column if not exists session_tags jsonb;

comment on column public.group_session_offers.session_tags is
  'Age group or level for each session on this card, keyed by occurrence id. Null until the coach tags the week.';

create or replace function public.schedule_set_offer_session_tags(p_offer_id uuid, p_tags jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := public.current_coach_id();
  v_updated integer;
begin
  if v_coach_id is null then
    raise exception 'Only coaches can tag a week' using errcode = '42501';
  end if;
  if p_tags is not null and jsonb_typeof(p_tags) is distinct from 'object' then
    raise exception 'Tags must be an object of session id to label' using errcode = '22023';
  end if;

  update public.group_session_offers
    set session_tags = p_tags
    where id = p_offer_id and coach_id = v_coach_id;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Week card not found' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.schedule_set_offer_session_tags(uuid, jsonb) from public, anon;
grant execute on function public.schedule_set_offer_session_tags(uuid, jsonb) to authenticated;
