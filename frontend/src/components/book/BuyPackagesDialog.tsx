/**
 * Packages pop-up (Working Copy `AN.modals.packages`): pick a package, then pay on Stripe's
 * page. Booking-only coaches take payment themselves, so their packages open a message instead.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Ticket } from "@/components/icons";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BrandPill } from "@/components/brand";
import { packagesAPI, type Package } from "@/api/packages";
import { useCoachExtras } from "@/components/coach-profile/family/hooks";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useFeeConfig } from "@/hooks/useFeeConfig";
import { useMyReferrals } from "@/hooks/useReferrals";
import { useStartCoachChat } from "@/hooks/useStartCoachChat";
import { ROUTES } from "@/routes";
import { cn } from "@/lib/utils";
import { money } from "@/utils/booking";
import { computeSessionPrice, formatPriceBreakdown } from "@/utils/referralHelpers";
import { plural } from "@/utils/schedule";
import { PROFILE_TYPE } from "@/utils/db";
import { CheckoutTermsLine } from "@/components/legal/LegalLinks";
import { label, meta, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { canApplePay } from "./applePay";
import { ApplePayButton, InfoBox, PayMethodList, sheetBody, sheetContent, sheetFooter, sheetHeader, sheetTitle, wideContent, type PayMethod } from "./checkoutParts";

export interface BuyPackagesCoach {
  id: string;
  name: string;
  slug: string | null;
  paysDirect: boolean;
  credits: number;
}

const perSession = (pkg: Package) =>
  Math.round(pkg.price_per_session ? pkg.price_per_session / 100 : pkg.total_price / 100 / Math.max(1, pkg.session_count));

export const BuyPackagesDialog = ({
  coach,
  initialPackageId = null,
  onClose,
}: {
  /** Null keeps the pop-up closed. */
  coach: BuyPackagesCoach | null;
  /** Opens straight on the pay step for this package. */
  initialPackageId?: string | null;
  onClose: () => void;
}) => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const chat = useStartCoachChat();
  const { platformFeePerc, stripeFeePerc, stripeFeeFixed } = useFeeConfig();
  const athleteId =
    profile?.type === PROFILE_TYPE.athlete && profile?.data ? ((profile.data as { id?: string }).id ?? undefined) : undefined;
  const { data: referrals } = useMyReferrals(athleteId);
  const [held, setHeld] = useState(coach);
  useEffect(() => {
    if (coach) setHeld(coach);
  }, [coach]);
  const shown = coach ?? held;
  const extras = useCoachExtras(shown?.id);
  const [applePay] = useState(canApplePay);
  const [pkgId, setPkgId] = useState<string | null>(null);
  const [method, setMethod] = useState<PayMethod>(applePay ? "apple" : "card");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coachId = shown?.id ?? null;
  useEffect(() => {
    if (!coach) return;
    setPkgId(!coach.paysDirect ? initialPackageId : null);
    setMethod(applePay ? "apple" : "card");
    setPaying(false);
    setError(null);
  }, [coach, initialPackageId, applePay]);

  const packages = useQuery({
    queryKey: ["buy-packages", coachId],
    enabled: Boolean(coachId),
    queryFn: async () => {
      const res = await packagesAPI.getCoachPackages(coachId!);
      if (res.error) throw new Error(res.error.message);
      return (res.data ?? [])
        .filter((pkg) => pkg.is_active !== false)
        .sort((a, b) => (a.display_order ?? Number.MAX_SAFE_INTEGER) - (b.display_order ?? Number.MAX_SAFE_INTEGER));
    },
  });

  const list = packages.data ?? [];
  const bestId = list.some((pkg) => pkg.id === extras?.mostBookedPackageId) ? extras!.mostBookedPackageId : list[0]?.id;
  const chosen = pkgId ? list.find((pkg) => pkg.id === pkgId) ?? null : null;
  const first = shown?.name.split(" ")[0] || "the coach";
  const waived = Boolean(
    shown && (referrals ?? []).some((r) => r.coach_id === shown.id && r.status === "confirmed"),
  );
  const chosenCharge = chosen
    ? computeSessionPrice(chosen.total_price / 100, platformFeePerc, stripeFeePerc, waived, stripeFeeFixed)
    : null;
  const chosenBreakdown = chosen
    ? formatPriceBreakdown(chosen.total_price / 100, platformFeePerc, stripeFeePerc, waived, stripeFeeFixed)
    : null;

  const pay = async () => {
    if (!coach || !chosen) return;
    if (!user) {
      navigate(`${ROUTES.AUTH}?mode=signin`);
      return;
    }
    setPaying(true);
    setError(null);
    try {
      const payment = await packagesAPI.createPackagePayment({ package_id: chosen.id, coach_id: chosen.coach_id || coach.id });
      if (payment.error) throw new Error(payment.error.message);
      if (!payment.data?.url) throw new Error("This package is not available for purchase right now.");
      window.location.href = payment.data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start checkout.");
      setPaying(false);
    }
  };

  const choose = (pkg: Package) => {
    if (!coach) return;
    if (coach.paysDirect) chat.start(coach.id, coach.name);
    else setPkgId(pkg.id);
  };

  const payStep = chosen ? (
    <DialogContent className={sheetContent}>
      <DialogHeader className={sheetHeader}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="-ml-1.5 inline-flex size-[30px] flex-none items-center justify-center rounded-control text-dark-300 hover:bg-light hover:text-dark [&>svg]:size-4"
            aria-label="Back to packages"
            onClick={() => setPkgId(null)}
          >
            <ArrowLeft strokeWidth={1.5} />
          </button>
          <DialogTitle className={sheetTitle}>Buy {chosen.package_name}</DialogTitle>
        </div>
        <DialogDescription className="sr-only">Pay for the package on Stripe's secure page.</DialogDescription>
      </DialogHeader>
      <div className={sheetBody}>
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-subtitle">
              {chosen.package_name} with {shown?.name}
            </span>
            <span className={meta}>
              {money(perSession(chosen))} per session{chosen.validity_days ? ` · valid ${chosen.validity_days} days` : ""}
            </span>
          </span>
          <span className="text-stat tabular-nums">
            {money(chosenCharge?.total ?? chosen.total_price / 100)}
          </span>
        </div>
        {chosenBreakdown ? <p className={meta}>{chosenBreakdown.replace(" session", " package")}</p> : null}
        <div className="flex flex-col gap-2">
          <span className={label}>Pay with</span>
          <PayMethodList name="package-pay" value={method} onChange={setMethod} applePay={applePay} />
        </div>
        <InfoBox icon={Ticket}>
          {plural(chosen.session_count, "credit")} {chosen.session_count === 1 ? "is" : "are"} added to your account right away and used first when you
          book {first}.
        </InfoBox>
        {error ? (
          <p role="alert" className="rounded-control border border-error-300 bg-error-50 px-3 py-2 text-body-m text-error-700">
            {error}
          </p>
        ) : null}
      </div>
      <div className={cn(sheetFooter, "flex-nowrap justify-between")}>
        <button type="button" className={cn(secondaryButton, "h-[44px] flex-1 sm:flex-none")} onClick={() => setPkgId(null)}>
          Back
        </button>
        {method === "apple" && !paying ? (
          <ApplePayButton
            label={`Pay ${money(chosenCharge?.total ?? chosen.total_price / 100)} with`}
            className="flex-1 sm:flex-none"
            onClick={pay}
          />
        ) : (
          <button type="button" className={cn(primaryButton, "h-[44px] flex-1 sm:flex-none")} disabled={paying} onClick={pay}>
            {paying ? "Opening…" : `Pay ${money(chosenCharge?.total ?? chosen.total_price / 100)}`}
          </button>
        )}
      </div>
      <CheckoutTermsLine className="px-5 pb-4 sm:px-[25px]" />
    </DialogContent>
  ) : null;

  const pickStep = (
    <DialogContent className={wideContent}>
      <DialogHeader className={sheetHeader}>
        <DialogTitle className={sheetTitle}>Packages with {shown?.name}</DialogTitle>
        <DialogDescription className="sr-only">Packages you can buy with this coach.</DialogDescription>
      </DialogHeader>
      <div className={sheetBody}>
        {packages.isLoading ? (
          <p className="py-8 text-center text-body-m text-dark-300">Loading packages…</p>
        ) : packages.isError ? (
          <p role="alert" className="rounded-control border border-error-300 bg-error-50 px-3 py-2 text-body-m text-error-700">
            Couldn't load packages. Try again in a moment.
          </p>
        ) : !list.length ? (
          <p className="py-8 text-center text-body-m text-dark-300">No packages available right now.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
            {list.map((pkg) => {
              const best = pkg.id === bestId;
              return (
                <div
                  key={pkg.id}
                  className={cn("flex flex-col gap-4 rounded-card border bg-light-400 p-[22px]", best ? "border-primary-200" : "border-light-525")}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-card-title">{pkg.package_name}</span>
                      {best ? <BrandPill tone="blue">Most booked</BrandPill> : null}
                    </div>
                    <span className="text-body-m text-dark-300">
                      {pkg.validity_days ? `Valid ${pkg.validity_days} days after purchase` : plural(pkg.session_count, "session")}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-stat tabular-nums">{money(pkg.total_price / 100)}</span>
                    <span className={meta}>{money(perSession(pkg))} per session</span>
                  </div>
                  <div className="flex flex-col gap-2 text-body-m">
                    {["Session notes after every session", `Message ${first} anytime`, "Credits roll over until expiry"].map((text) => (
                      <span key={text} className="flex items-center gap-2">
                        <Check className="size-4 flex-none text-primary" strokeWidth={1.5} aria-hidden="true" />
                        {text}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={cn(best ? primaryButton : secondaryButton, "mt-auto w-full")}
                    disabled={shown?.paysDirect ? chat.starting : false}
                    onClick={() => choose(pkg)}
                  >
                    {shown?.paysDirect ? `Get ${pkg.package_name}` : "Choose"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {shown?.paysDirect && list.length ? <p className={meta}>{first} takes payment directly, so packages are arranged in a message.</p> : null}
        {shown && shown.credits > 0 ? (
          <p className={meta}>
            You have {plural(coach.credits, "credit")} left with {first}.
          </p>
        ) : null}
      </div>
    </DialogContent>
  );

  const loadingPay =
    pkgId && packages.isLoading ? (
      <DialogContent className={sheetContent}>
        <DialogHeader className={sheetHeader}>
          <DialogTitle className={sheetTitle}>Buy a package</DialogTitle>
          <DialogDescription className="sr-only">Loading the package.</DialogDescription>
        </DialogHeader>
        <div className={sheetBody}>
          <p className="py-8 text-center text-body-m text-dark-300">Loading…</p>
        </div>
      </DialogContent>
    ) : null;

  return (
    <Dialog open={Boolean(coach)} onOpenChange={(open) => !open && onClose()}>
      {payStep ?? loadingPay ?? pickStep}
    </Dialog>
  );
};
