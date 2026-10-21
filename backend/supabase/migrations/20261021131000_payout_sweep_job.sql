-- Hourly payout sweep (fix/payments-reliability).
-- release-held-booking-transfers (hourly, :17) turns held coach shares into "waiting", but
-- nothing sent them until the coach opened Payments or Settings. This job calls the
-- stripe-payouts function ({ action: "sweep" }, service role only) at :27 every hour, which
-- sends every waiting share whose Connect account can receive transfers and finishes reversals.
--
-- SETUP (once per project, in the SQL editor; values are NOT in this repo):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service role key (legacy JWT)>', 'service_role_key');
-- Until both secrets exist the job does nothing and logs a notice.
-- Idempotent: safe to run more than once.

create extension if not exists pg_net;

create or replace function public.run_payout_sweep()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url' limit 1;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  if coalesce(v_url, '') = '' or coalesce(v_key, '') = '' then
    raise notice 'run_payout_sweep: vault secrets project_url / service_role_key are not set; skipping';
    return null;
  end if;
  return net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/stripe-payouts',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := jsonb_build_object('action', 'sweep'),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function public.run_payout_sweep() from public, anon, authenticated;
grant execute on function public.run_payout_sweep() to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'send-waiting-payouts';
select cron.schedule('send-waiting-payouts', '27 * * * *', $$select public.run_payout_sweep()$$);
