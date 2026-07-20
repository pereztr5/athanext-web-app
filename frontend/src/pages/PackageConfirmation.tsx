import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, AlertCircle, Loader2, RefreshCw } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { packagesAPI, type Package } from "@/api/packages";
import { useCoachDetails } from "@/hooks/useCoachDetails";
import { useFeeConfig } from "@/hooks/useFeeConfig";
import { ROUTES } from "@/routes";

type VerificationStatus = "verifying" | "pending" | "success" | "error";

const PackageConfirmation = () => {
  const [searchParams] = useSearchParams();
  const packageId = searchParams.get("package_id");
  const coachIdParam = searchParams.get("coach_id");
  const sessionId = searchParams.get("session_id");
  const navigate = useNavigate();

  const [pkg, setPkg] = useState<Package | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<VerificationStatus>("verifying");
  const [statusMessage, setStatusMessage] = useState("Verifying your payment...");
  const [attemptKey, setAttemptKey] = useState(0);

  const coachId = pkg?.coach_id || coachIdParam || "";
  const { coach } = useCoachDetails(coachId);
  const { platformFeePerc, stripeFeePerc } = useFeeConfig();

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

        if (state === "reconciled") {
          setStatus("success");
          setStatusMessage("Payment confirmed! Your package is ready.");
          setError(null);
          return;
        }

        if (state === "pending" && attempts < 4) {
          attempts += 1;
          setStatus("pending");
          setStatusMessage("Payment is still processing. We'll retry automatically...");
          retryTimeout = setTimeout(verifyPayment, 1500);
          return;
        }

        setStatus("error");
        setStatusMessage("Payment is still processing. You can retry verification shortly.");
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
  }, [sessionId, attemptKey]);

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
        setPkg(result.data);
      } catch (err) {
        console.error("Failed to load package confirmation:", err);
        setError("An unexpected error occurred. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadPackage();
  }, [packageId, status]);

  const coachName = coach?.name || "Your Coach";
  const priceLabel = useMemo(() => {
    if (!pkg) return "-";
    // platformFeePerc/stripeFeePerc fetched via hook for consistency with other screens
    void platformFeePerc;
    void stripeFeePerc;
    return `$${(pkg.total_price / 100).toFixed(2)}`;
  }, [pkg, platformFeePerc, stripeFeePerc]);

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

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center px-4 py-8 sm:py-12 lg:py-16 mt-5">
      <div className="max-w-5xl w-full space-y-6">
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-6 sm:px-10 py-10 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white shadow">
            {status === "error" ? (
              <div className="h-16 w-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                <AlertCircle className="h-8 w-8 text-white" strokeWidth={2.5} />
              </div>
            ) : status === "success" ? (
              <div className="h-16 w-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
                <CheckCircle className="h-8 w-8 text-white" strokeWidth={2.5} />
              </div>
            ) : (
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            )}
          </div>
          <div className="mt-4 space-y-2">
            <p className="text-2xl sm:text-3xl font-bold text-slate-900">
              {status === "success"
                ? "Package Confirmed"
                : status === "error"
                  ? "Package Confirmation"
                  : "Finishing Up"}
            </p>
            <p className="text-sm sm:text-base text-slate-600">
              {statusMessage}
            </p>
          </div>
        </div>

        <Card className="shadow-sm border rounded-xl border-blue-200 bg-blue-50">
          <CardContent className="p-6 sm:p-8 space-y-6">
            {showPackageSkeleton && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-7 w-64" />
                    <Skeleton className="h-4 w-72" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-7 w-40" />
                  </div>
                  <div className="sm:min-w-[160px] space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-4 w-72" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
            )}

            {!showPackageSkeleton && pkg && status === "success" && (
              <>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-sm uppercase text-slate-600">Package</p>
                    <h2 className="text-xl font-semibold text-slate-900">{pkg.package_name}</h2>
                    {pkg.description && (
                      <p className="text-sm text-slate-600">{pkg.description}</p>
                    )}
                    <p className="text-sm text-slate-600">
                      Coach:
                    </p>
                    <h2 className="text-xl font-semibold text-slate-900">{coachName}</h2>
                  </div>
                  <div className="text-right sm:text-left sm:min-w-[160px]">
                    <p className="text-xs uppercase text-slate-500">Total Paid</p>
                    <p className="text-3xl font-bold text-slate-900">{priceLabel}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Sessions</p>
                    <p className="text-lg font-semibold text-slate-900">{pkg.session_count}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Duration</p>
                    <p className="text-lg font-semibold text-slate-900">{pkg.duration_minutes} minutes</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Validity</p>
                    <p className="text-lg font-semibold text-slate-900">{pkg.validity_days} days</p>
                  </div>
                </div>

                {pkg.features && pkg.features.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      What’s Included
                    </p>
                    <ul className="space-y-1 text-sm text-slate-700 list-disc list-inside">
                      {pkg.features.map((feature, idx) => (
                        <li key={`${feature}-${idx}`}>{feature}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {!showPackageSkeleton && !pkg && !error && null}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {status === "error" && (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={() => setAttemptKey((key) => key + 1)}
              className="w-full sm:w-auto"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry verification
            </Button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={() => navigate(ROUTES.PROFILE)} disabled={isLoading}>
            Go to Profile
          </Button>
        </div>
      </div>
    </div>
  );

};

export default PackageConfirmation;
