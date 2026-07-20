import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { strings } from "@/config/strings";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ResetState = "checking" | "ready" | "error";

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<ResetState>("checking");
  const [statusMessage, setStatusMessage] = useState("Validating your reset link...");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { updatePassword } = useAuth();
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

        const hashParams = getRecoveryParams();
        const type = hashParams.get("type");
        const accessToken = hashParams.get("access_token");

        if (type !== "recovery" || !accessToken) {
          if (isMounted) {
            setStatus("error");
            setStatusMessage("This reset link is invalid or has already been used.");
          }
          return;
        }

        // Verify the recovery token by exchanging it for a session
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: accessToken,
          type: "recovery",
        });

        if (!isMounted) return;

        if (error || !data.session) {
          setStatus("error");
          setStatusMessage("We couldn't verify your session. Please request a new reset email.");
          return;
        }

        cleanRecoveryParams();
        setStatus("ready");
        setStatusMessage("");
      } catch (error) {
        if (!isMounted) return;
        console.error("Unexpected error verifying recovery token", error);
        setStatus("error");
        setStatusMessage("Something went wrong while verifying your link. Please request a new reset email.");
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

    if (newPassword.length < 8) {
      setFormError(strings.form.validation.passwordTooShort);
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
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{statusMessage}</p>
        </div>
      );
    }

    if (status === "error") {
      return (
        <div className="space-y-4">
          <p className="text-center text-sm text-destructive">{statusMessage}</p>
          <Button
            type="button"
            className="w-full"
            onClick={() => navigate("/forgot-password")}
          >
            {strings.buttons.forgotPassword}
          </Button>
        </div>
      );
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-password">{strings.form.labels.password}</Label>
          <Input
            id="new-password"
            type="password"
            placeholder={strings.form.labels.password}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">{strings.form.labels.confirmPassword}</Label>
          <Input
            id="confirm-password"
            type="password"
            placeholder={strings.form.labels.confirmPassword}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={isSubmitting}
          />
        </div>
        {formError && <p className="text-sm text-destructive">{formError}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Updating password..." : strings.buttons.resetPassword}
        </Button>
      </form>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted pt-20">
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">{strings.buttons.resetPassword}</CardTitle>
            <CardDescription>
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
