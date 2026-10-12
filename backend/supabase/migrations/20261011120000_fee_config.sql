-- Card processing: 2.9% + $0.30 once per Checkout. Marketplace platform_fees is unchanged.
-- package_trial_days is 0: monthly academy group passes renew with no free trial.
-- package_purchases.status may still be 'trialing' for any in-flight $0 trial checkout.

insert into public.configurations (key, value, description)
select v.key, v.value, v.description
from (values
  ('stripe_fees', '2.9', 'Card processing percent charged on top of the list price'),
  ('stripe_fee_fixed', '0.30', 'Fixed card processing dollars once per Checkout'),
  ('package_trial_days', '0', 'Free trial days for monthly academy group passes (0 = none)')
) as v(key, value, description)
where not exists (select 1 from public.configurations c where c.key = v.key);

update public.configurations set value = '2.9', updated_at = now() where key = 'stripe_fees';
update public.configurations set value = '0.30', updated_at = now() where key = 'stripe_fee_fixed';
update public.configurations set value = '0', updated_at = now() where key = 'package_trial_days';

comment on column public.package_purchases.status is
  'active | expired | completed | trialing (legacy subscription trial with zero credits until first paid invoice)';
