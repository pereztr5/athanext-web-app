import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, ShieldCheck, KeyRound, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { strings } from "@/config/strings";
import { usePasswordValidation, PASSWORD_RULE_MESSAGE } from "@/hooks/usePasswordValidation";
import { PasswordRequirements } from "@/components/password/PasswordRequirements";

const ChangePassword = () => {
  const { user, loading, changePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isNewPasswordFocused, setIsNewPasswordFocused] = useState(false);
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { items: passwordValidationItems, allValid: allPasswordRulesMet } = usePasswordValidation(newPassword);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth?mode=signin", { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    return () => {
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (formError === PASSWORD_RULE_MESSAGE && allPasswordRulesMet) {
      setFormError(null);
    }
  }, [formError, allPasswordRulesMet]);

  if (loading || (!user && loading)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted pt-20">
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4">
          <Card className="w-full max-w-md">
            <CardContent className="flex flex-col items-center gap-4 py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {strings.info.pleaseWait}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage("");

    if (!currentPassword) {
      setFormError("Please enter your current password.");
      return;
    }

    if (newPassword.length < 8) {
      setFormError(strings.form.validation.passwordTooShort);
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError(strings.form.validation.passwordMismatch);
      return;
    }

    if (!allPasswordRulesMet) {
      setFormError(PASSWORD_RULE_MESSAGE);
      return;
    }

    setIsSubmitting(true);
    const { error } = await changePassword(currentPassword, newPassword);

    if (error) {
      setFormError(error.message);
      setIsSubmitting(false);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSuccessMessage("Password updated successfully. You will be logged out shortly—please sign in with your new password.");
    setIsSubmitting(false);

    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
    }

    logoutTimerRef.current = setTimeout(async () => {
      await signOut();
      navigate("/auth?mode=signin", { replace: true });
    }, 6000);
  };

  const sellingPoints = [
    {
      icon: ShieldCheck,
      title: "Multi-layer Protection",
      body: "Your password updates are sealed with modern hashing algorithms and session revalidation for peace of mind.",
    },
    {
      icon: KeyRound,
      title: "Strong Password Guidance",
      body: "A live checklist keeps you aligned with our security baseline while you type.",
    },
    {
      icon: Lock,
      title: "Automatic Sign-out",
      body: "Once updated, we re-authenticate the session so your data stays in the right hands.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f0f4ff] pt-24 pb-16 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="h-[40vh] bg-gradient-to-b from-blue-200/40 to-transparent" aria-hidden="true" />
        <div className="absolute bottom-[-120px] right-[-80px] h-[320px] w-[320px] rounded-full bg-blue-200/50 blur-[130px]" aria-hidden="true" />
        <div className="absolute top-[-150px] left-[-100px] h-[280px] w-[280px] rounded-full bg-emerald-200/50 blur-[140px]" aria-hidden="true" />
      </div>
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <div className="relative overflow-hidden rounded-[32px] border border-white/60 bg-white/85 shadow-[0_35px_120px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="absolute -right-24 top-16 h-56 w-56 rounded-full bg-blue-200/50 blur-3xl" aria-hidden="true" />
            <div className="absolute -left-16 -bottom-10 h-48 w-48 rounded-full bg-emerald-200/40 blur-2xl" aria-hidden="true" />

            <div className="relative grid gap-10 lg:grid-cols-[1.05fr_minmax(0,1fr)] p-6 sm:p-10 lg:p-12">
              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Security</p>
                  <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
                    {strings.profile.changePassword}
                  </h1>
                  <p className="text-base sm:text-lg text-slate-600">
                    Keep your account secure by refreshing your password and ensuring only you have access.
                  </p>
                </div>
                <div className="space-y-4">
                  {sellingPoints.map(({ icon: Icon, title, body }) => (
                    <div key={title} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white/70 p-4 shadow-sm">
                      <div className="rounded-full bg-blue-50 p-2">
                        <Icon className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{title}</p>
                        <p className="text-sm text-slate-600">{body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Card className="shadow-xl border border-slate-200/70">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-xl">{strings.profile.changePassword}</CardTitle>
                  <CardDescription>
                    Update your password and we&apos;ll refresh your session for you.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Current Password</Label>
                      <div className="relative">
                        <Input
                          id="current-password"
                          type={showCurrentPassword ? "text" : "password"}
                          placeholder="Enter your current password"
                          value={currentPassword}
                          onChange={(event) => setCurrentPassword(event.target.value)}
                          disabled={isSubmitting}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-2 flex items-center text-muted-foreground"
                          aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                        >
                          {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password">{strings.form.labels.password}</Label>
                      <div className="relative">
                        <Input
                          id="new-password"
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Enter a new password"
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          onFocus={() => setIsNewPasswordFocused(true)}
                          onBlur={() => setIsNewPasswordFocused(false)}
                          disabled={isSubmitting}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-2 flex items-center text-muted-foreground"
                          aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {isNewPasswordFocused && (
                        <PasswordRequirements items={passwordValidationItems} className="mt-2" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">{strings.form.labels.confirmPassword}</Label>
                      <div className="relative">
                        <Input
                          id="confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm your new password"
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          disabled={isSubmitting}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-2 flex items-center text-muted-foreground"
                          aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    {formError && (
                      <p className="text-sm text-destructive">{formError}</p>
                    )}
                    {successMessage && (
                      <p className="text-sm text-emerald-600">{successMessage}</p>
                    )}
                    <Button type="submit" disabled={isSubmitting} className="w-full">
                      {isSubmitting ? "Updating..." : strings.profile.changePassword}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
