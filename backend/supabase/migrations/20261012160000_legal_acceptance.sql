-- Record which Terms / Privacy version each person accepted (WC4 #22).

alter table public.user_profiles
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists privacy_version text,
  add column if not exists privacy_accepted_at timestamptz;

comment on column public.user_profiles.terms_version is 'Terms of Service version accepted at signup / re-accept.';
comment on column public.user_profiles.privacy_version is 'Privacy Policy version accepted at signup / re-accept.';
