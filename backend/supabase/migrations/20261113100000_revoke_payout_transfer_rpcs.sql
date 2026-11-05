-- void_booking_transfers / release_booking_transfers move coach payouts (void, reverse a sent
-- transfer, or release a held one) for any booking id, with no ownership check. They were granted
-- to authenticated, so any signed-in user could call them over the API: a family could reverse a
-- coach's payout after the session, a coach could release held payouts early.
--
-- Nothing calls them from the client or an edge function. They are only used inside other
-- SECURITY DEFINER functions (payments_reliability, camp_registration_bookings), which run as the
-- function owner and don't need the grant.

revoke all on function public.void_booking_transfers(uuid) from public, anon, authenticated;
revoke all on function public.release_booking_transfers(uuid) from public, anon, authenticated;
grant execute on function public.void_booking_transfers(uuid) to service_role;
grant execute on function public.release_booking_transfers(uuid) to service_role;
