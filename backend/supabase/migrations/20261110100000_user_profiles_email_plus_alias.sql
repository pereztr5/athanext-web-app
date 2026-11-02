-- Allow plus-addressing in user_profiles.email (e.g. name+parent@domain.com).
-- Auth already accepts "+", but user_profiles_email_check rejected it and blocked
-- finishProfile right after the sign-up code (stuck auth user, no profile row).
alter table public.user_profiles drop constraint if exists user_profiles_email_check;

alter table public.user_profiles
  add constraint user_profiles_email_check
  check (
    length(email) <= 255
    and email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]+$'
  );
