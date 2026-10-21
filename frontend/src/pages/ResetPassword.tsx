import { Eye, EyeOff, Loader2 } from "@/components/icons";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { strings } from "@/config/strings";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import logo from "@/assets/AthaNext-Logo.svg";
import { PasswordRequirements } from "@/components/password/PasswordRequirements";
import { PASSWORD_RULE_MESSAGE, usePasswordValidation } from "@/hooks/usePasswordValidation";

type ResetState = "checking" | "ready" | "error";

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<ResetState>("checking");
  const [statusMessage, setStatusMessage] = useState("Checking your reset link…");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { updatePassword } = useAuth();
  // The same rules as sign-up and settings: upper, lower, number, symbol, 8+.
  const { items: passwordRules, allValid: meetsRules } = usePasswordValidation(newPassword);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const cleanRecoveryParams = () => {
      const url = new URL(window.location.href);
      url.hash = "";
      const sensitiveParams = [
        "type",
        "access_token",
        "refresh_token",
        "expires_in",
        "token_hash",
        "provider_token",
      ];

      sensitiveParams.forEach((param) => url.searchParams.delete(param));
      url.search = url.searchParams.toString() ? `?${url.searchParams.toString()}` : "";
      window.history.replaceState({}, "", url.toString());
    };

    const getRecoveryParams = () => {
      const currentUrl = new URL(window.location.href);

      const normalizeFragment = (fragment: string) => fragment.trim().replace(/^([?#])/, "");

      let hashFragment = normalizeFragment(currentUrl.hash);

      if (!hashFragment) {
        const encodedHashIndex = currentUrl.href.indexOf("%23");
        if (encodedHashIndex !== -1) {
          const encodedFragment = currentUrl.href.slice(encodedHashIndex + 3);
          const endOfFragment = encodedFragment.search(/[#?]/);
          const fragmentSlice = endOfFragment === -1 ? encodedFragment : encodedFragment.slice(0, endOfFragment);

          try {
            hashFragment = normalizeFragment(decodeURIComponent(fragmentSlice));
          } catch (error) {
            console.error("Error decoding recovery hash fragment", error);
          }
        }
      }

      if (!hashFragment && currentUrl.searchParams.get("type") === "recovery") {
        hashFragment = normalizeFragment(currentUrl.search);
      }

      return new URLSearchParams(hashFragment);
    };

    const verifyRecoveryToken = async () => {
      try {
        const { data: existingSession } = await supabase.auth.getSession();
        if (existingSession?.session) {
          if (isMounted) {
            setStatus("ready");
            setStatusMessage("");
            cleanRecoveryParams();
          }
          return;
        }

        // Supabase normally signs the link in by itself (hash tokens or ?code=). These are the
        // fallbacks: a token_hash link (custom email template), raw hash tokens, or an error.
        const hashParams = getRecoveryParams();
        const searchParams = new URL(window.location.href).searchParams;
        const tokenHash = searchParams.get("token_hash") ?? hashParams.get("token_hash");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const linkError = hashParams.get("error_code") ?? searchParams.get("error_code");

        if (linkError) {
          if (isMounted) {
            setStatus("error");
            setStatusMessage(
              linkError === "otp_expired"
                ? "This reset link has expired. Request a new one."
                : "This reset link is invalid or has already been used."
            );
          }
          return;
        }

        let verified = false;
        if (tokenHash) {
          const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
          verified = !error && Boolean(data.session);
        } else if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          verified = !error && Boolean(data.session);
        } else {
          if (isMounted) {
            setStatus("error");
            setStatusMessage("This reset link is invalid or has already been used.");
          }
          return;
        }

        if (!isMounted) return;

        if (!verified) {
          setStatus("error");
          setStatusMessage("We couldn't verify this link. Request a new reset email.");
          return;
        }

        cleanRecoveryParams();
        setStatus("ready");
        setStatusMessage("");
      } catch (error) {
        if (!isMounted) return;
        console.error("Unexpected error verifying recovery token", error);
        setStatus("error");
        setStatusMessage("Something went wrong while checking your link. Request a new reset email.");
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === "PASSWORD_RECOVERY" && session) {
        cleanRecoveryParams();
        setStatus("ready");
        setStatusMessage("");
      }
    });

    verifyRecoveryToken();

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!meetsRules) {
      setFormError(PASSWORD_RULE_MESSAGE);
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError(strings.form.validation.passwordMismatch);
      return;
    }

    setIsSubmitting(true);
    const { error } = await updatePassword(newPassword);

    if (error) {
      setFormError(error.message);
      setIsSubmitting(false);
    } else {
      // Sign out after password update to ensure user signs in with new password
      await supabase.auth.signOut();
      navigate("/auth?mode=signin&message=password-updated", { replace: true });
    }
  };

  const renderContent = () => {
    if (status === "checking") {
      return (
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 strokeWidth={1.5} className="h-6 w-6 animate-spin text-primary" />
          <p className="text-body-m text-dark-300">{statusMessage}</p>
        </div>
      );
    }

    if (status === "error") {
      return (
        <div className="space-y-4">
          <p className="text-center text-body-m text-error-700">{statusMessage}</p>
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={() => navigate("/forgot-password")}
          >
            Request a new link
          </Button>
        </div>
      );
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="new-password" className="text-label-xsm text-dark-300">
            New password
          </Label>
          <div className="relative">
            <Input
              id="new-password"
              type={showNew ? "text" : "password"}
              placeholder="Enter a new password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              disabled={isSubmitting}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="absolute inset-y-0 right-2 flex items-center rounded-control text-dark-300 hover:text-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              aria-label={showNew ? "Hide password" : "Show password"}
            >
              {showNew ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
            </button>
          </div>
          {newPassword ? <PasswordRequirements items={passwordRules} /> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password" className="text-label-xsm text-dark-300">
            Confirm password
          </Label>
          <div className="relative">
            <Input
              id="confirm-password"
              type={showConfirm ? "text" : "password"}
              placeholder="Enter it again"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={isSubmitting}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute inset-y-0 right-2 flex items-center rounded-control text-dark-300 hover:text-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
            </button>
          </div>
        </div>
        {formError && <p className="text-caption text-error-700">{formError}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Updating password…" : "Reset password"}
        </Button>
      </form>
    );
  };

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-10">
        <Card className="w-full max-w-[440px]">
          <CardHeader className="items-center gap-2.5 space-y-0 text-center">
            <img src={logo} alt="AthaNext" className="h-7 w-auto" />
            <CardTitle className="pt-2 text-section text-dark">
              Reset password
            </CardTitle>
            <CardDescription className="text-body-m text-dark-300">
              Choose a new password for your account.
            </CardDescription>
          </CardHeader>
          <CardContent>{renderContent()}</CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
