-- ATH-78: the coach can add the athlete's first name to an invite. The parent or guardian
-- still adds their athlete after accepting; this is only shown to the coach and in the email.
alter table public.coach_client_referrals
  add column if not exists athlete_first_name text check (char_length(athlete_first_name) <= 100);
