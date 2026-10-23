-- "Resend receipt" on the booking confirmation page.
--
-- send-booking-notifications ({ action: "resend_receipt" }) emails the receipt to the family's
-- account address. receipt_resends logs each resend so a booking's receipt goes out at most
-- 3 times an hour.
-- * claim_receipt_resend() checks the limit for every booking on the receipt and logs the
--   resend in one step. Only the edge function (service role) calls it, after
--   get_booking_receipt() has confirmed the caller owns the bookings.
-- * No one reads the table from the app (RLS on, no policies).
-- Safe to run more than once.

create table if not exists public.receipt_resends (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.coach_slot_bookings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists receipt_resends_booking_idx on public.receipt_resends (booking_id, created_at desc);

alter table public.receipt_resends enable row level security;

create or replace function public.claim_receipt_resend(p_user_id uuid, p_booking_ids uuid[])
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_user_id is null or coalesce(cardinality(p_booking_ids), 0) = 0 then
    return false;
  end if;

  -- One resend at a time per booking, so two quick taps can't both pass the check. Locked in
  -- id order so two overlapping receipts can't deadlock.
  foreach v_id in array (select array_agg(distinct x order by x) from unnest(p_booking_ids) as x) loop
    perform pg_advisory_xact_lock(hashtext('receipt_resend:' || v_id::text));
  end loop;

  if exists (
    select 1
    from public.receipt_resends
    where booking_id = any(p_booking_ids)
      and created_at > now() - interval '1 hour'
    group by booking_id
    having count(*) >= 3
  ) then
    return false;
  end if;

  insert into public.receipt_resends (booking_id, user_id)
  select distinct id, p_user_id from unnest(p_booking_ids) as id;
  return true;
end;
$$;

revoke all on function public.claim_receipt_resend(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.claim_receipt_resend(uuid, uuid[]) to service_role;
