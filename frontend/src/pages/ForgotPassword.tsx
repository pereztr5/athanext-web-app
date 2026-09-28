import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { strings } from "@/config/strings";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/AthaNext-Logo.svg";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasSentEmail, setHasSentEmail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { requestPasswordReset } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!email) {
      setError(strings.form.validation.emailRequired);
      return;
    }

    setIsSubmitting(true);
    const { error } = await requestPasswordReset(email);

    if (error) {
      setError(error.message);
    } else {
      setHasSentEmail(true);
    }

    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-10">
        <Card className="w-full max-w-[440px]">
          <CardHeader className="items-center gap-2.5 space-y-0 text-center">
            <img src={logo} alt="AthaNext" className="h-7 w-auto" />
            <CardTitle className="pt-2 text-[24px] font-semibold leading-[30px] tracking-[-0.05em] text-[#1A202C]">
              Forgot password?
            </CardTitle>
            <CardDescription className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
              {hasSentEmail
                ? `If an account exists for ${email}, a reset link is on its way. Check your inbox and spam folder.`
                : "Enter the email you use for your account and we'll send you a reset link."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="reset-email"
                  className="text-[12px] font-medium leading-[14px] tracking-[-0.03em] text-[#767980]"
                >
                  {strings.form.labels.email}
                </Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder={strings.form.placeholders.email}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isSubmitting}
                />
                {error && <p className="text-[12px] leading-[14px] tracking-[-0.03em] text-destructive">{error}</p>}
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Sending reset link…" : hasSentEmail ? "Resend reset link" : "Send reset link"}
              </Button>
            </form>
            <div className="mt-4 flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => navigate("/auth?mode=signin")}
                disabled={isSubmitting}
              >
                Back to sign in
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;
