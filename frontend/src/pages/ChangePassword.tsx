import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ShieldCheck, KeyRound, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { strings } from "@/config/strings";
import { usePasswordValidation, PASSWORD_RULE_MESSAGE } from "@/hooks/usePasswordValidation";
import { PasswordRequirements } from "@/components/password/PasswordRequirements";

const ChangePassword = () => {
  const { user, changePassword, signOut } = useAuth();
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
    setSuccessMessage("Password updated. We'll sign you out in a few seconds so you can sign in with your new password.");
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
      title: "Stored securely",
      body: "Your new password is hashed before it's saved. We never store it in plain text.",
    },
    {
      icon: KeyRound,
      title: "Live requirements",
      body: "A checklist shows which password rules you've met as you type.",
    },
    {
      icon: Lock,
      title: "Signed out after the change",
      body: "Once your password is updated, we sign you out so you can sign in again with the new one.",
    },
  ];

  const eyeButtonClass =
    "absolute inset-y-0 right-3 flex items-center text-[#767980] transition-colors hover:text-[#1A202C]";
  const labelClass = "text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]";

  return (
    <div className="overflow-x-hidden px-4 pb-16 md:px-10">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
        <header className="flex flex-col gap-[10px]">
          <h1 className="text-[32px] font-bold leading-[28px] tracking-[-1.6px] text-[#1A202C]">Change password</h1>
          <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#767980]">
            Choose a new password to keep your account secure.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <CardHeader className="gap-[6px] space-y-0">
              <CardTitle className="tracking-[-0.05em]">New password</CardTitle>
              <CardDescription className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
                Enter your current password, then choose a new one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="current-password" className={labelClass}>Current password</Label>
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
                      className={eyeButtonClass}
                      aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                    >
                      {showCurrentPassword ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="new-password" className={labelClass}>New password</Label>
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
                      className={eyeButtonClass}
                      aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                    >
                      {showNewPassword ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
                    </button>
                  </div>
                  {isNewPasswordFocused && (
                    <PasswordRequirements items={passwordValidationItems} className="mt-2" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirm-password" className={labelClass}>Confirm new password</Label>
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
                      className={eyeButtonClass}
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    >
                      {showConfirmPassword ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
                    </button>
                  </div>
                </div>
                {formError && (
                  <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-destructive">{formError}</p>
                )}
                {successMessage && (
                  <p className="rounded-[8px] bg-[#CBE7D1] px-3 py-[10px] text-[14px] leading-[18px] tracking-[-0.03em] text-[#1E7431]">
                    {successMessage}
                  </p>
                )}
                <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto sm:self-start">
                  {isSubmitting ? "Updating..." : "Change password"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="tracking-[-0.05em]">How it works</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-[10px]">
              {sellingPoints.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex items-start gap-[10px] rounded-[8px] bg-[#F4F4EB] p-3">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-[#F7F7F0] text-[#767980]" aria-hidden="true">
                    <Icon className="size-4" strokeWidth={1.5} />
                  </span>
                  <div className="flex flex-col gap-1">
                    <p className="text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">{title}</p>
                    <p className="text-[12px] leading-[16px] tracking-[-0.03em] text-[#767980]">{body}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
