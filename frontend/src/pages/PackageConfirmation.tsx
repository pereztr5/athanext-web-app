import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, AlertCircle, Loader2, RefreshCw } from "@/components/icons";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { packagesAPI, type Package } from "@/api/packages";
import { useCoachDetails } from "@/hooks/useCoachDetails";
import { useFeeConfig } from "@/hooks/useFeeConfig";
import { ROUTES } from "@/routes";
import { BrandPill } from "@/components/brand";
import { useProfile } from "@/contexts/ProfileContext";
import { useReferralWaiver } from "@/hooks/useReferrals";
import { PROFILE_TYPE } from "@/utils/db";
import { feeAmountText } from "@/utils/feeDisplay";
import { feeLine, toCents } from "@/utils/fees";

type VerificationStatus = "verifying" | "pending" | "success" | "error";

const PackageConfirmation = () => {
  const [searchParams] = useSearchParams();
  const packageId = searchParams.get("package_id");
  const coachIdParam = searchParams.get("coach_id");
  const sessionId = searchParams.get("session_id");
  // Academy packages (Working Copy): credits with the coaches in the package, no single coach.
  const academy = Boolean(searchParams.get("org_package_id"));
  const navigate = useNavigate();

  const [pkg, setPkg] = useState<Package | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<VerificationStatus>("verifying");
  const [statusMessage, setStatusMessage] = useState("Verifying your payment…");
  const [attemptKey, setAttemptKey] = useState(0);

  const coachId = pkg?.coach_id || coachIdParam || "";
  const { coach } = useCoachDetails(coachId);
  const { config: feeConfig, error: feeError } = useFeeConfig();
  const { profile } = useProfile();
  const athleteId =
    profile?.type === PROFILE_TYPE.athlete && profile?.data ? ((profile.data as { id?: string }).id ?? undefined) : undefined;
  // Existing client of this coach: create-package-payment charged no platform fee.
  const { waived } = useReferralWaiver(athleteId, coachId || undefined);

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      setStatusMessage("Missing session information. Please contact support.");
      return;
    }

    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const verifyPayment = async () => {
      if (cancelled) return;

      try {
        const result = await packagesAPI.reconcilePackagePayment(sessionId);

        if (cancelled) return;

        if (result.error) {
          console.error("Package reconciliation error:", result.error);
          setStatus("error");
          setStatusMessage(result.error.message || "We couldn't verify your payment.");
          return;
        }

        const state = result.data?.state;

        if (state === "reconciled" || state === "trialing") {
          setStatus("success");
          setStatusMessage(
            state === "trialing"
              ? "Your package is set up. Credits unlock when the first paid month begins. You can cancel renewal from Book a session."
              : academy
                ? "Payment confirmed. Your credits are ready to use when you book with the coaches in this package."
                : "Payment confirmed. Your package is ready."
          );
          setError(null);
          return;
        }

        if (state === "pending" && attempts < 4) {
          attempts += 1;
          setStatus("pending");
          setStatusMessage("Payment is still processing. We’ll check again automatically…");
          retryTimeout = setTimeout(verifyPayment, 1500);
          return;
        }

        setStatus("error");
        setStatusMessage("Payment is still processing. Try checking again in a moment.");
      } catch (err) {
        if (cancelled) return;
        console.error("Verification failed:", err);
        setStatus("error");
        setStatusMessage("Something went wrong while verifying your payment.");
      }
    };

    verifyPayment();

    return () => {
      cancelled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [sessionId, attemptKey, academy]);

  useEffect(() => {
    const loadPackage = async () => {
      if (!packageId || status !== "success") return;
      setLoading(true);
      setError(null);
      try {
        const result = await packagesAPI.getPackageById(packageId);
        if (result.error) {
          setError(result.error.message || "Unable to load package details.");
          return;
        }
        const loaded = result.data;
        setPkg(loaded);
        if (loaded?.kind === "camp") {
          setStatusMessage("Payment confirmed. You're registered for this camp. It does not add session credits.");
        }
      } catch (err) {
        console.error("Failed to load package confirmation:", err);
        setError("That didn't load. Try again");
      } finally {
        setLoading(false);
      }
    };

    loadPackage();
  }, [packageId, status]);

  const coachName = coach?.name || "Your coach";
  const priceLabel = useMemo(() => {
    if (!pkg) return "-";
    // Camps: no platform fee for anyone (create-package-payment), card processing only.
    const kind = pkg.kind === "camp" ? "camp" : "package";
    const fees = feeConfig ? feeLine(toCents(pkg.total_price / 100), kind, feeConfig, waived) : null;
    return feeAmountText(Boolean(fees), feeError, `$${((fees?.totalCents ?? 0) / 100).toFixed(2)}`);
  }, [pkg, feeConfig, feeError, waived]);

  const coachEmail = useMemo(() => {
    if (coach && typeof (coach as any).email === "string") {
      return (coach as any).email;
    }
    return "";
  }, [coach]);

  const isLoading = status === "verifying" || status === "pending";
  const showPackageSkeleton =
    loading ||
    status !== "success" ||
    (!pkg && !error);

  const isCamp = pkg?.kind === "camp";
  const title =
    status === "success" ? (isCamp ? "Camp confirmed" : "Package confirmed") : status === "error" ? "We couldn’t confirm your package" : "Finishing up";
  const statusIcon =
    status === "error" ? (
      <div className="flex h-10 w-10 items-center justify-center rounded-control border border-info-300 bg-info-50">
        <AlertCircle strokeWidth={1.5} className="h-5 w-5 text-info-700" />
      </div>
    ) : status === "success" ? (
      <div className="flex h-10 w-10 items-center justify-center rounded-control border border-success-300 bg-success-50">
        <CheckCircle strokeWidth={1.5} className="h-5 w-5 text-success-700" />
      </div>
    ) : (
      <div className="flex h-10 w-10 items-center justify-center rounded-control bg-light-400">
        <Loader2 strokeWidth={1.5} className="h-5 w-5 animate-spin text-dark-300" />
      </div>
    );
  const detailLabel = "text-label-xsm text-dark-300";

  return (
    <div className="flex items-start justify-center px-4 py-8 font-sans text-dark sm:py-12 lg:py-16">
      <div className="w-full max-w-wrapper-focused overflow-hidden rounded-card border border-light-525 bg-light-300">
        {/* Status header */}
        <div className="flex flex-col items-start gap-4 px-[25px] pb-5 pt-[30px]" aria-live="polite">
          {statusIcon}
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-section">{title}</h1>
              {status === "success" && <BrandPill tone="green">Paid</BrandPill>}
            </div>
            <p className="text-body-m text-dark-300">{statusMessage}</p>
          </div>
        </div>
        {/* Package details (hidden when verification failed and there's nothing to show) */}
        {!academy && (status !== "error" || error) && (
        <>
        <div className="h-px bg-light-525" />
        <div className="flex flex-col gap-5 px-[25px] py-5">
          {showPackageSkeleton && status !== "error" && (
            <>
              <div className="flex items-start justify-between gap-5">
                <div className="flex flex-col gap-2.5">
                  <Skeleton className="h-6 w-56" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <Skeleton className="h-[30px] w-24" />
              </div>
              <Skeleton className="h-[84px] w-full rounded-control" />
            </>
          )}

          {!showPackageSkeleton && pkg && status === "success" && (
            <>
              <div className="flex items-start justify-between gap-5">
                <div className="flex min-w-0 flex-col gap-2.5">
                  <p className="text-card-title">
                    {pkg.package_name} with {coachName}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <BrandPill tone="blue">{isCamp ? "Camp" : "Package"}</BrandPill>
                  </div>
                  {pkg.description && (
                    <p className="text-body-m text-dark-300">{pkg.description}</p>
                  )}
                </div>
                <div className="flex flex-none flex-col items-end gap-1.5 text-right">
                  <p className="text-stat">{priceLabel}</p>
                  <p className="text-caption text-dark-300">Total paid</p>
                </div>
              </div>

              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-control bg-light-400 px-5 py-4 sm:grid-cols-3">
                {(isCamp
                  ? [
                      { label: "Daily session", value: `${pkg.duration_minutes} min` },
                      ...((pkg as { camp_location?: string | null }).camp_location
                        ? [{ label: "Place", value: (pkg as { camp_location?: string | null }).camp_location as string }]
                        : []),
                      { label: "Credits", value: "None. This is a camp registration." },
                    ]
                  : [
                      { label: "Sessions", value: String(pkg.session_count) },
                      { label: "Duration", value: `${pkg.duration_minutes} min each` },
                      { label: "Valid for", value: `${pkg.validity_days} days` },
                    ]
                ).map((item) => (
                  <div key={item.label} className="flex flex-col gap-1.5">
                    <dt className={detailLabel}>{item.label}</dt>
                    <dd className="text-body-m">{item.value}</dd>
                  </div>
                ))}
              </dl>

              {pkg.features && pkg.features.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <p className="text-subtitle">What’s included</p>
                  <ul className="flex list-disc flex-col gap-1.5 pl-5 text-body-m text-dark-300 marker:text-dark-200">
                    {pkg.features.map((feature, idx) => (
                      <li key={`${feature}-${idx}`}>{feature}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {error && (
            <p className="flex items-center gap-2 text-body-m text-error-700">
              <AlertCircle strokeWidth={1.5} className="h-4 w-4 flex-none" />
              {error}
            </p>
          )}
        </div>
        </>
        )}

        {/* Actions */}
        <div className="h-px bg-light-525" />
        <div className="flex flex-col-reverse gap-[10px] px-[25px] py-5 sm:flex-row sm:justify-end">
          <Button
            variant={status === "error" ? "outline" : "default"}
            onClick={() => navigate(ROUTES.PROFILE)}
            disabled={isLoading}
          >
            Go to profile
          </Button>
          {status === "error" && (
            <Button onClick={() => setAttemptKey((key) => key + 1)}>
              <RefreshCw strokeWidth={1.5} className="h-4 w-4" />
              Check again
            </Button>
          )}
        </div>
      </div>
    </div>
  );

};

export default PackageConfirmation;
