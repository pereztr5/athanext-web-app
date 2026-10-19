import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, RefreshCcw } from "@/components/icons";
import logo from "@/assets/AthaNext-Logo.svg";
import { useToast } from "@/hooks/use-toast";
import { authAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { ROUTES } from "@/routes";

interface SignupConfirmationProps {
  email?: string;
  onResend?: () => void;
  onStartOver?: () => void;
  onSupport?: () => void;
}

const steps = [
  "Check your inbox, and your spam or junk folder",
  "Click the confirmation link in the email",
  "Complete your profile and start booking sessions",
];

const SignupConfirmation = ({
  email,
  onResend,
  onStartOver,
  onSupport,
}: SignupConfirmationProps) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentEmail, setCurrentEmail] = useState("");
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    const emailFromParams = searchParams.get("email") || "";
    const nextEmail = email || emailFromParams || user?.email || "";
    setCurrentEmail((prev) => (prev === nextEmail ? prev : nextEmail));
  }, [email, searchParams, user?.email]);

  const handleResend = async () => {
    if (onResend) return onResend();

    if (!currentEmail) {
      toast({
        title: "Email required",
        description: "Provide an email so we can resend the confirmation link.",
        variant: "destructive",
      });
      return;
    }

    setIsResending(true);
    const { error } = await authAPI.resendConfirmationEmail(
      currentEmail,
      `${window.location.origin}${ROUTES.AUTH}?mode=complete-profile`
    );
    setIsResending(false);

    if (error) {
      toast({
        title: "Could not resend email",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Email sent",
      description: `We've sent the confirmation again to ${currentEmail}.`,
    });
  };

  const handleSupport = () => {
    if (onSupport) return onSupport();
    navigate(ROUTES.CONTACT_US);
  };


  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-10">
        <Card className="w-full max-w-[480px]">
          <CardHeader className="items-center gap-2.5 space-y-0 text-center">
            <img src={logo} alt="AthaNext" className="h-7 w-auto" />
            <div className="mt-4 flex h-12 w-12 items-center justify-center rounded-full border border-primary-300 bg-primary-50">
              <Mail strokeWidth={1.5} className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
            <h1 className="pt-2 text-section text-dark">
              Check your email
            </h1>
            <p className="text-body-m text-dark-300">
              We sent a confirmation link to{" "}
              <span className="font-medium text-dark [overflow-wrap:anywhere]">
                {currentEmail || "your email"}
              </span>
              . Open it to activate your account.
            </p>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="space-y-3 rounded-card border border-light-525 bg-light-400 px-5 py-4">
              <h2 className="text-subtitle text-dark">
                What's next
              </h2>
              <ol className="space-y-2.5">
                {steps.map((step, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-3 text-body-m text-dark-400"
                  >
                    <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border border-primary-300 bg-primary-50 text-label-xsm text-primary">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="space-y-2.5">
              <p className="text-center text-caption text-dark-300">
                Didn't get the email?
              </p>
              <Button
                size="lg"
                className="w-full"
                onClick={handleResend}
                disabled={isResending || !currentEmail}
              >
                <RefreshCcw strokeWidth={1.5} className="mr-2 h-4 w-4" />
                {isResending ? "Resending…" : "Resend confirmation email"}
              </Button>
            </div>

            <div className="h-px bg-light-525" />

            <p className="text-center text-caption text-dark-300">
              Still having trouble?{" "}
              <button
                type="button"
                className="rounded-control font-medium text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                onClick={handleSupport}
              >
                Contact support
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SignupConfirmation;
