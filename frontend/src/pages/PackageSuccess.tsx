import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { packagesAPI } from "@/api/packages";
import { ROUTES } from "@/routes";

type VerificationStatus = "verifying" | "pending" | "success" | "error";

const PackageSuccess = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const navigate = useNavigate();

  const [status, setStatus] = useState<VerificationStatus>("verifying");
  const [statusMessage, setStatusMessage] = useState("Verifying your payment...");
  const [attemptKey, setAttemptKey] = useState(0);

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

  const isLoading = status === "verifying" || status === "pending";

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center px-4 py-8 sm:py-12 lg:py-16">
      <div className="max-w-3xl w-full space-y-6">
        <div className="flex items-center gap-3">
          {status === "error" ? (
            <AlertCircle className="h-8 w-8 text-red-500" />
          ) : status === "success" ? (
            <CheckCircle className="h-8 w-8 text-green-600" />
          ) : (
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          )}
          <div>
            <p className="text-2xl font-bold text-slate-900">
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
          <CardContent className="p-6 sm:p-8 space-y-4">
            {status === "success" && (
              <p className="text-sm text-slate-700">
                Your payment is confirmed. You can return to your profile to view your packages.
              </p>
            )}
            {status === "error" && (
              <p className="text-sm text-red-600">
                We could not verify your payment. Please retry verification or contact support.
              </p>
            )}
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Checking payment status...</span>
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

export default PackageSuccess;
