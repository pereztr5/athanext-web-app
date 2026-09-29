-- ATH-22: viewer time zone for displaying session times.
-- Sessions stay stored as America/New_York wall-clock; this only drives display.
-- NULL means "follow the browser's zone".

alter table public.user_profiles
  add column if not exists timezone text;

alter table public.user_profiles
  drop constraint if exists user_profiles_timezone_format;

alter table public.user_profiles
  add constraint user_profiles_timezone_format
  check (
    timezone is null
    -- Area/Location names, plus legacy zones browsers can report (UTC, GMT, EST5EDT).
    or (char_length(timezone) <= 64 and timezone ~ '^([A-Za-z]+(/[A-Za-z0-9_+-]+)+|[A-Z]{3,4}[0-9]?[A-Z]{0,4})$')
  );

comment on column public.user_profiles.timezone is
  'IANA time zone used to display session times (ATH-22). NULL = browser zone.';
