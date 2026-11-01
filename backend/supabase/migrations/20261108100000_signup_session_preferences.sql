-- Sign-up redesign (Oct 31 "signup flows: today vs proposed"): families now say what kind of
-- sessions they want, the mirror of what coaches offer, so coaches can be matched on it.
--   session_formats:   'individual' and/or 'group'
--   session_locations: 'in_person' and/or 'online'
-- Coaches already store where they coach in coaches.session_types; they now also store formats.
alter table public.athlete_profiles
  add column if not exists session_formats text[] not null default '{}',
  add column if not exists session_locations text[] not null default '{}';

alter table public.coaches
  add column if not exists session_formats text[] not null default '{}';

comment on column public.athlete_profiles.session_formats is 'Sessions the family wants: individual, group.';
comment on column public.athlete_profiles.session_locations is 'Where the family wants sessions: in_person, online.';
comment on column public.coaches.session_formats is 'Sessions the coach offers: individual, group.';
