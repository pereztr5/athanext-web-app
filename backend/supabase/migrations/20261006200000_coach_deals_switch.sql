-- ATH-88: coaches turn brand deals (coaches.affiliate_links) on or off. Families only see
-- deals when this is on and there is at least one deal.
alter table public.coaches
  add column if not exists deals_enabled boolean not null default true;

comment on column public.coaches.deals_enabled is
  'ATH-88: show brand deals (affiliate_links) on the public profile.';
