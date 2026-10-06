-- ATH-91: athlete Account Settings.
-- guardian_relationship: how the account holder is related to the athlete (parent accounts).
-- deletion_requested_at: the family asked to delete the account. It's removed 14 days later
--   by an admin (admin_prepare_account_deletion); signing in and pressing Undo before then
--   clears it.
alter table public.user_profiles
  add column if not exists guardian_relationship text
    check (guardian_relationship in ('Parent', 'Guardian', 'Other family member')),
  add column if not exists deletion_requested_at timestamptz;
