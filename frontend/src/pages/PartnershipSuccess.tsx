import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { AlertCircle, CheckCircle, Loader2, RefreshCw } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { packagesAPI } from "@/api/packages";

type VerificationStatus = "verifying" | "pending" | "success" | "error";

const PartnershipSuccess = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<VerificationStatus>("verifying");
  const [message, setMessage] = useState("Verifying your payment...");
  const [attemptKey, setAttemptKey] = useState(0);

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      setMessage("Missing session information. Please contact support.");
      return;
    }

    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const verifyPayment = async () => {
      if (cancelled) return;

      try {
        const result = await packagesAPI.reconcilePartnershipPayment(sessionId);

        if (cancelled) return;

        if (result.error) {
          console.error("Reconciliation error:", result.error);
          setStatus("error");
          setMessage(result.error.message || "We couldn't verify your payment.");
          return;
        }

        const state = result.data?.state;

        if (state === "reconciled") {
          setStatus("success");
          setMessage("Payment confirmed! Your partnership resource is ready.");
          return;
        }

        if (state === "pending" && attempts < 4) {
          attempts += 1;
          setStatus("pending");
          setMessage("Payment is still processing. We'll retry automatically...");
          retryTimeout = setTimeout(verifyPayment, 1500);
          return;
        }

        setStatus("error");
        setMessage("Payment is still processing. You can retry verification shortly.");
      } catch (err) {
        if (cancelled) return;
        console.error("Verification failed:", err);
        setStatus("error");
        setMessage("Something went wrong while verifying your payment.");
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardContent className="pt-6">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              {status === "success" ? (
                <CheckCircle className="h-16 w-16 text-green-500" />
              ) : status === "error" ? (
                <AlertCircle className="h-16 w-16 text-destructive" />
              ) : (
                <Loader2 className="h-16 w-16 text-primary animate-spin" />
              )}
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">
                {status === "success"
                  ? "Payment Confirmed"
                  : status === "error"
                    ? "Verification Issue"
                    : "Finishing Up"}
              </h1>
              <p className="text-muted-foreground">{message}</p>
            </div>

            {status === "success" && (
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm text-muted-foreground">
                  A confirmation email has been sent to your registered email address.
                </p>
                <p className="text-sm text-muted-foreground">
                  Our team will reach out to you shortly to get you started with your new partnership service.
                </p>
              </div>
            )}

            {status === "error" && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
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

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild variant="default" disabled={isLoading}>
                <Link to="/">Return to Home</Link>
              </Button>
              <Button asChild variant="outline" disabled={isLoading}>
                <Link to="/partnerships">View More Partnerships</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnershipSuccess;
