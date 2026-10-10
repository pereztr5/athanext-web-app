/** True on devices where Safari can pay with Apple Pay. Stripe's page then offers it too. */
export const canApplePay = (): boolean => {
  try {
    const session = (window as unknown as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession;
    return Boolean(session?.canMakePayments?.());
  } catch {
    return false;
  }
};
