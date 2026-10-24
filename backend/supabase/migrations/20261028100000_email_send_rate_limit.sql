-- Rate limit for public send-email requests (Oct 28).
--
-- send-email used to send any to/subject/html for any caller with a JWT, the public anon key
-- included. Now only the service role sends freely; anyone else can only send a fixed kind of
-- message (contact, partnership, parent_invite) built by the function. Each of those is counted
-- here first, per device and per email:
--   email_send_attempt(kind, ip_hash, email_hash, per_ip, ip_window_minutes, per_email,
--                      email_window_minutes)
--     -> null when the send may go ahead (and the attempt is recorded),
--        'rate_ip' or 'rate_email' when a limit is reached (nothing is recorded).
-- Neither the IP nor the email is stored, only salted hashes from the function. Rows older than
-- a day are cleared on the way. Only the service role (send-email) can reach any of it.

create table if not exists public.email_send_attempts (
  id bigint generated always as identity primary key,
  kind text not null,
  ip_hash text,
  email_hash text,
  created_at timestamptz not null default now()
);

create index if not exists email_send_attempts_ip_idx on public.email_send_attempts (ip_hash, created_at);
create index if not exists email_send_attempts_email_idx on public.email_send_attempts (email_hash, created_at);
create index if not exists email_send_attempts_created_idx on public.email_send_attempts (created_at);

alter table public.email_send_attempts enable row level security;
revoke all on public.email_send_attempts from public, anon, authenticated;

create or replace function public.email_send_attempt(
  p_kind text,
  p_ip_hash text,
  p_email_hash text,
  p_per_ip integer,
  p_ip_window_minutes integer,
  p_per_email integer,
  p_email_window_minutes integer
)
returns text
language plpgsql
security definer
set search_path = public
as $function$
begin
  -- One attempt at a time, so two quick requests can't both pass the count.
  perform pg_advisory_xact_lock(hashtext('email_send_attempts'));

  delete from public.email_send_attempts where created_at < now() - interval '1 day';

  if p_ip_hash is not null and (
    select count(*) from public.email_send_attempts
    where ip_hash = p_ip_hash and created_at > now() - make_interval(mins => p_ip_window_minutes)
  ) >= p_per_ip then
    return 'rate_ip';
  end if;

  if p_email_hash is not null and (
    select count(*) from public.email_send_attempts
    where email_hash = p_email_hash and created_at > now() - make_interval(mins => p_email_window_minutes)
  ) >= p_per_email then
    return 'rate_email';
  end if;

  insert into public.email_send_attempts (kind, ip_hash, email_hash)
  values (p_kind, p_ip_hash, p_email_hash);
  return null;
end;
$function$;

revoke all on function public.email_send_attempt(text, text, text, integer, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.email_send_attempt(text, text, text, integer, integer, integer, integer)
  to service_role;
