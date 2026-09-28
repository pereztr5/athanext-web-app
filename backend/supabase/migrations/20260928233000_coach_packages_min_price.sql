-- ATH-47 follow-up: coaches can now write coach_packages directly, and
-- create-package-payment sends total_price to Stripe as unit_amount (cents).
-- Stripe rejects charges under $0.50, so enforce that floor in the table.

alter table public.coach_packages
  drop constraint if exists coach_packages_total_price_check;

alter table public.coach_packages
  add constraint coach_packages_total_price_check check (total_price >= 50);
