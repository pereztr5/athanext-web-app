-- delete_old_pending_bookings() deletes every unpaid booking older than 5 minutes and could be
-- run by anyone, signed in or not. Nothing in the app or in cron calls it; unpaid checkouts are
-- now released by release-unpaid-checkouts. Keep it for the server only.
revoke execute on function public.delete_old_pending_bookings() from public, anon, authenticated;
