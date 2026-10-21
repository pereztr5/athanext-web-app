-- Platform fee rate in the repo (it was only set by hand). Fee math lives in
-- functions/_shared/fees.ts (copied to frontend/src/utils/fees.ts):
--   sessions and coach packages: 10% platform fee (waived for a coach's own clients), then card
--   processing (stripe_fees % + stripe_fee_fixed once per Checkout) grossed up on the total;
--   academy (org) packages: the 10% platform fee only, card processing absorbed;
--   coach invoices: card processing only.
-- Existing values are left as they are.

insert into public.configurations (key, value, description)
values ('platform_fees', '10', 'Platform fee percent of the list price')
on conflict (key) do nothing;

update public.configurations
set description = 'Card processing percent of the charged total (grossed up on top of list price and platform fee)'
where key = 'stripe_fees';
