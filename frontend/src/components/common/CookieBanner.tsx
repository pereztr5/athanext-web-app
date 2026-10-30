/**
 * The cookie banner at the bottom of every page (ATH-119), until the visitor picks Accept all or
 * Only essential. Cookie settings (account menu) brings it back to change the answer.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { primaryButton, secondaryButton, smallButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { COOKIE_SETTINGS_EVENT, readCookieConsent, saveCookieConsent, type CookieConsent } from "@/utils/cookieConsent";

export const CookieBanner = () => {
  const [open, setOpen] = useState(() => readCookieConsent() === null);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(COOKIE_SETTINGS_EVENT, show);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, show);
  }, []);

  if (!open) return null;

  const choose = (choice: CookieConsent) => {
    saveCookieConsent(choice);
    setOpen(false);
  };

  return (
    <div
      role="region"
      aria-label="Cookies"
      className="fixed inset-x-0 bottom-0 z-[1500] px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] md:px-6"
    >
      <div className="mx-auto flex max-w-wrapper flex-col gap-3 rounded-card border border-light-525 bg-light-300 p-4 shadow-overlay md:flex-row md:items-center md:gap-6">
        <p className="min-w-0 flex-1 text-paragraph text-dark">
          We use cookies to keep you signed in and, if you allow it, to see how AthaNext is used so we can improve it.{" "}
          <Link to={ROUTES.PRIVACY_POLICY} className="font-medium text-primary hover:underline">
            Privacy policy
          </Link>
        </p>
        <div className="flex flex-none gap-2">
          <button type="button" className={cn(secondaryButton, smallButton, "flex-1 md:flex-none")} onClick={() => choose("essential")}>
            Only essential
          </button>
          <button type="button" className={cn(primaryButton, smallButton, "flex-1 md:flex-none")} onClick={() => choose("all")}>
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
};
