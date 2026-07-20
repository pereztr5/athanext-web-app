import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import SignUpConfirmation from "../assets/images/sign-up-confirmation.png";
import { Mail, RefreshCcw, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authAPI } from "@/api";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/routes";

interface SignupConfirmationProps {
  email?: string;
  onResend?: () => void;
  onStartOver?: () => void;
  onSupport?: () => void;
}

const steps = [
  "Check your email inbox (and spam folder)",
  "Click the confirmation link in the email",
  "Start connecting with elite coaches",
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
      description: `We've resent the confirmation to ${currentEmail}.`,
    });
  };

  const handleSupport = () => {
    if (onSupport) return onSupport();
    navigate(ROUTES.CONTACT_US);
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted pt-20">
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <Card className="shadow-lg border-primary/20">
          <CardHeader className="flex flex-col items-center gap-4 text-center pt-10">
            <div className="h-16 w-16 rounded-full flex items-center justify-center">
              {/* <Trophy className="h-8 w-8 text-primary" /> */}
              <img src={SignUpConfirmation} className="mx-auto" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Thank You for Signing Up!</h1>
              <p className="text-muted-foreground mt-2">
                Welcome to AthaNext! Check your email to activate your account and start connecting
                with elite coaches.
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pb-10">
            <div className="rounded-xl bg-primary/5 border border-primary/10 px-4 py-3 items-center text-center">
              <div className="text-sm flex gap-3 justify-center">
                <Mail className="h-5 w-5 text-primary" />
                <p className="text-muted-foreground">Confirmation email sent to:</p>
              </div>
              <div className="text-sm">
                 <p className="font-medium text-primary">{currentEmail || "your email"}</p>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/40 px-4 py-4 space-y-3">
              <h3 className="font-semibold">What's next?</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                {steps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <span className="mt-0.5 h-6 w-6 rounded-full bg-primary text-white text-xs font-semibold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              Didn’t receive the email?
            </div>

            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                className="w-full rounded-full"
                onClick={handleResend}
                disabled={isResending || !currentEmail}
              >
                <RefreshCcw className="h-4 w-4 mr-2" />
                {isResending ? "Resending..." : "Resend Confirmation Email"}
              </Button>
            </div>

            <Separator />

            <div className="text-center text-sm text-muted-foreground">
              Still having trouble?{" "}
              <button
                type="button"
                className="text-primary underline underline-offset-2"
                onClick={handleSupport}
              >
                Contact Support
              </button>
            </div>

          </CardContent>
        </Card>
        <div className="text-center text-sm text-muted-foreground mt-5">
              Make sure to check your spam or junk folder if you don’t see the email in your inbox.
            </div>
      </div>
    </div>
  );
};

export default SignupConfirmation;
