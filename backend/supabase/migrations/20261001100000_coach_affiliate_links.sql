-- ATH-35: affiliate marketing links on the coach profile.
-- Up to three { brand, url, code } entries, edited by the coach and shown on
-- the public profile. Coach rows are already readable on the profile and
-- writable by their owner, so no new policies are needed.

alter table public.coaches
  add column if not exists affiliate_links jsonb not null default '[]'::jsonb;

alter table public.coaches
  drop constraint if exists coaches_affiliate_links_shape;

alter table public.coaches
  add constraint coaches_affiliate_links_shape
  check (jsonb_typeof(affiliate_links) = 'array' and jsonb_array_length(affiliate_links) <= 3);

comment on column public.coaches.affiliate_links is
  'ATH-35: up to 3 affiliate links [{ brand, url, code? }] shown on the coach profile.';
