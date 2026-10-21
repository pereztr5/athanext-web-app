import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail } from "@/components/icons";
import { strings } from "@/config/strings";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/AthaNext-Logo.svg";

// Supabase allows one reset email per address a minute.
const RESEND_COOLDOWN_SECONDS = 60;

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { requestPasswordReset } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const send = async (address: string) => {
    setError(null);
    setIsSubmitting(true);
    const { error } = await requestPasswordReset(address);
    setIsSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }
    setSentTo(address);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (!address) {
      setError(strings.form.validation.emailRequired);
      return;
    }
    await send(address);
  };

  const backToSignIn = (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={() => navigate("/auth?mode=signin")}
      disabled={isSubmitting}
    >
      Back to sign in
    </Button>
  );

  if (sentTo) {
    return (
      <div className="min-h-screen bg-background pt-20">
        <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-10">
          <Card className="w-full max-w-[440px]">
            <CardHeader className="items-center gap-2.5 space-y-0 text-center">
              <img src={logo} alt="AthaNext" className="h-7 w-auto" />
              <span className="mt-2 flex size-14 items-center justify-center rounded-full bg-primary-50 text-primary">
                <Mail className="size-7" strokeWidth={1.5} aria-hidden="true" />
              </span>
              <CardTitle className="pt-2 text-section text-dark">Check your email</CardTitle>
              <CardDescription className="text-body-m text-dark-300">
                If an account uses <span className="font-medium text-dark">{sentTo}</span>, we sent it a link to
                reset your password. It can take a minute to arrive. Check your spam folder too.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {error && <p className="text-center text-caption text-error-700">{error}</p>}
              <Button
                type="button"
                size="lg"
                className="w-full"
                onClick={() => void send(sentTo)}
                disabled={isSubmitting || cooldown > 0}
              >
                {isSubmitting
                  ? "Sending…"
                  : cooldown > 0
                    ? `Resend link in ${cooldown}s`
                    : "Resend link"}
              </Button>
              {backToSignIn}
              <button
                type="button"
                className="mt-1 self-center rounded-control text-label-xsm text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                onClick={() => {
                  setSentTo(null);
                  setError(null);
                }}
              >
                Use a different email
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-10">
        <Card className="w-full max-w-[440px]">
          <CardHeader className="items-center gap-2.5 space-y-0 text-center">
            <img src={logo} alt="AthaNext" className="h-7 w-auto" />
            <CardTitle className="pt-2 text-section text-dark">
              Forgot password?
            </CardTitle>
            <CardDescription className="text-body-m text-dark-300">
              Enter the email you use for your account and we'll send you a reset link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="reset-email"
                  className="text-label-xsm text-dark-300"
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
                {error && <p className="text-caption text-error-700">{error}</p>}
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Sending reset link…" : "Send reset link"}
              </Button>
            </form>
            <div className="mt-4 flex flex-col gap-2">{backToSignIn}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;
