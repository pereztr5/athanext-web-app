import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eye, EyeOff, KeyRound, Lock, Pencil, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useRole } from "@/hooks/useRole";
import { strings } from "@/config/strings";
import { usePasswordValidation, PASSWORD_RULE_MESSAGE } from "@/hooks/usePasswordValidation";
import { PasswordRequirements } from "@/components/password/PasswordRequirements";
import { getInitials } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { TimeZoneSelect } from "@/components/common/TimeZoneSelect";
import { BookingConfirmationToggle } from "@/components/common/BookingConfirmationToggle";

const rowLabelClass = "w-[180px] shrink-0 text-[14px] font-normal leading-[18px] tracking-[-0.42px] text-[#1A202C]";
const fieldLabelClass = "text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-[#1A202C]";
const rowValueClass = "text-[14px] font-normal leading-[18px] tracking-[-0.42px] text-[#484D56]";

const SettingRow = ({
  label,
  children,
  divider = true,
}: {
  label: string;
  children?: ReactNode;
  divider?: boolean;
}) => (
  <>
    <div className="flex h-10 items-center gap-[10px]">
      <p className={rowLabelClass}>{label}</p>
      {children}
    </div>
    {divider ? <div className="h-px w-full bg-[#EAEADF]" /> : null}
  </>
);

const SectionTitle = ({ title, action }: { title: string; action?: ReactNode }) => (
  <div className="flex items-end justify-between">
    <h2 className="text-[20px] font-medium leading-[18px] tracking-[-1px] text-[#1A202C]">{title}</h2>
    {action}
  </div>
);

const EditButton = ({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="inline-flex items-center gap-[5px] rounded-[8px] border border-[#EAEADF] bg-[#F7F7F0] p-[10px] text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#767980] disabled:cursor-default"
  >
    <Pencil className="size-3" strokeWidth={1.5} />
    Edit
  </button>
);

const Field = ({
  label,
  value,
  empty = "—",
}: {
  label: string;
  value?: string | null;
  empty?: string;
}) => (
  <div className="space-y-1.5">
    <p className="text-[12px] font-medium leading-[14px] tracking-[-0.03em] text-[#767980]">{label}</p>
    <p className="text-[16px] leading-[18px] tracking-[-0.03em] text-[#1A202C]">{value?.trim() ? value : empty}</p>
  </div>
);

const AccountSettings = () => {
  const navigate = useNavigate();
  const { user, userName, userImg, userProfile, changePassword, signOut } = useAuth();
  const { profile } = useProfile();
  const { isCoach, isAthleteLike } = useRole();

  const athlete =
    profile?.type === "athlete" ? (profile.data as Record<string, unknown>) : null;
  const coach = profile?.type === "coach" ? (profile.data as Record<string, unknown>) : null;

  const displayName =
    (athlete?.full_name as string) ||
    (coach?.name as string) ||
    userName ||
    userProfile?.name ||
    user?.email?.split("@")[0] ||
    "Account";
  const email = userProfile?.email || user?.email || "";
  const authProvider =
    (user?.app_metadata as { provider?: string } | undefined)?.provider ||
    user?.identities?.[0]?.provider ||
    null;
  const canChangePassword = authProvider === "email" || authProvider === "password";

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
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { items: passwordValidationItems, allValid: allPasswordRulesMet } =
    usePasswordValidation(newPassword);

  useEffect(() => {
    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (formError === PASSWORD_RULE_MESSAGE && allPasswordRulesMet) {
      setFormError(null);
    }
  }, [formError, allPasswordRulesMet]);

  const sportLabel = useMemo(() => {
    const sport =
      (athlete?.sport as string) ||
      (coach?.sport as string) ||
      userProfile?.sport ||
      null;
    if (!sport) return null;
    return String(sport).charAt(0).toUpperCase() + String(sport).slice(1).toLowerCase();
  }, [athlete?.sport, coach?.sport, userProfile?.sport]);

  const position =
    (athlete?.position as string) ||
    (coach?.coach_position as string) ||
    (coach?.position as string) ||
    null;

  const dobLabel = (() => {
    const raw = athlete?.date_of_birth ? String(athlete.date_of_birth) : "";
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}.${match[2]}.${match[1]}`;
    return null;
  })();

  const photo = (athlete?.profile_image_url as string) || userImg || "";
  const phone = (athlete?.phone_number as string) || "";
  const openProfile = () => navigate(isCoach ? `${ROUTES.PROFILE}?mode=edit` : ROUTES.PROFILE);

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
    setSuccessMessage("Password updated. You will be signed out shortly.");
    setIsSubmitting(false);
    logoutTimerRef.current = setTimeout(async () => {
      await signOut();
      navigate(ROUTES.AUTH);
    }, 2500);
  };

  if (isAthleteLike) {
    return (
      <div className="overflow-x-hidden px-4 pb-16 md:px-10">
        <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-20">
          <h1 className="text-[32px] font-bold leading-[28px] tracking-[-1.6px] text-[#1A202C]">Settings</h1>

          <div className="flex flex-col gap-[60px]">
            <section className="flex flex-col gap-[30px]">
              <SectionTitle title="Profile" action={<EditButton onClick={openProfile} />} />
              <div className="flex flex-col gap-[10px]">
                <SettingRow label="Profile picture">
                  <div className="flex items-center gap-[10px]">
                    <div className="size-10 overflow-hidden rounded-full bg-[#F1F1E6]">
                      {photo ? (
                        <img src={photo} alt="" className="size-full object-cover" />
                      ) : (
                        <span className="flex size-full items-center justify-center text-[12px] font-medium text-[#484D56]">
                          {getInitials(displayName)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={openProfile}
                      className="rounded-[6px] border border-[#EAEADF] bg-[#F7F7F0] p-[6px] text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#484D56]"
                    >
                      Update
                    </button>
                  </div>
                </SettingRow>
                <SettingRow label="Full name">
                  <p className={rowValueClass}>{displayName}</p>
                </SettingRow>
                <SettingRow label="Email">
                  <p className={rowValueClass}>{email}</p>
                </SettingRow>
                <SettingRow label="Sport">
                  <p className={rowValueClass}>{sportLabel || ""}</p>
                </SettingRow>
                <SettingRow label="Position">
                  <p className={rowValueClass}>{position || ""}</p>
                </SettingRow>
                <SettingRow label="Date of birth">
                  <p className={rowValueClass}>{dobLabel || ""}</p>
                </SettingRow>
                <SettingRow label="Phone number" divider={false}>
                  <p className={rowValueClass}>{phone}</p>
                </SettingRow>
              </div>
            </section>

            <section className="flex flex-col gap-[30px]">
              <SectionTitle title="Time zone" />
              <div className="flex flex-col gap-[10px]">
                <SettingRow label="Show session times in" divider={false}>
                  <TimeZoneSelect className="w-full max-w-[360px]" />
                </SettingRow>
              </div>
            </section>

            <section className="flex flex-col gap-[30px]">
              <SectionTitle title="Guardian" action={<EditButton disabled />} />
              <div className="flex flex-col gap-[10px]">
                <SettingRow label="Name" />
                <SettingRow label="Email" />
                <SettingRow label="Verification status" />
                <SettingRow label="Guardians" divider={false}>
                  <button
                    type="button"
                    disabled
                    className="rounded-[6px] border border-[#EAEADF] bg-[#F7F7F0] p-[6px] text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#484D56] disabled:cursor-default"
                  >
                    Add guardian
                  </button>
                </SettingRow>
              </div>
            </section>

            <section className="flex flex-col gap-[30px]">
              <SectionTitle title="Payments" />
              <div className="flex h-10 items-center gap-[10px]">
                <p className={rowLabelClass}>Stripe</p>
                <span className="rounded-[6px] border border-[#D9D9CF] bg-[#EAEADF] p-[6px] text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#A3A6AB]">
                  Not connected
                </span>
              </div>
            </section>

            <section className="flex flex-col gap-[30px]">
              <SectionTitle title="Account" />
              <div className="flex h-10 items-center gap-[10px]">
                <p className={rowLabelClass}>Delete account</p>
                <button
                  type="button"
                  disabled
                  className="rounded-[6px] border border-[#FD9191] bg-[#FEECEC] p-[6px] text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#FB4747] disabled:cursor-default"
                >
                  Delete account
                </button>
              </div>
            </section>

            {canChangePassword && (
              <section className="flex flex-col gap-[30px]">
                <SectionTitle title="Password" />
                <form className="max-w-[420px] space-y-5" onSubmit={handlePasswordChange}>
                  <div className="space-y-2">
                    <Label htmlFor="current-password" className={fieldLabelClass}>
                      Current password
                    </Label>
                    <div className="relative">
                      <Input
                        id="current-password"
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="pr-10"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#767980] transition-colors hover:text-[#1A202C]"
                        onClick={() => setShowCurrentPassword((v) => !v)}
                        aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                      >
                        {showCurrentPassword ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className={fieldLabelClass}>
                      New password
                    </Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        onFocus={() => setIsNewPasswordFocused(true)}
                        onBlur={() => setIsNewPasswordFocused(false)}
                        className="pr-10"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#767980] transition-colors hover:text-[#1A202C]"
                        onClick={() => setShowNewPassword((v) => !v)}
                        aria-label={showNewPassword ? "Hide password" : "Show password"}
                      >
                        {showNewPassword ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
                      </button>
                    </div>
                    {(isNewPasswordFocused || newPassword) && (
                      <PasswordRequirements items={passwordValidationItems} />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className={fieldLabelClass}>
                      Confirm new password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pr-10"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#767980] transition-colors hover:text-[#1A202C]"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
                      </button>
                    </div>
                  </div>
                  {formError && (
                    <p className="flex items-center gap-2 text-[14px] leading-[18px] tracking-[-0.03em] text-destructive">
                      <Lock className="size-4 shrink-0" strokeWidth={1.5} />
                      {formError}
                    </p>
                  )}
                  {successMessage && (
                    <p className="flex items-center gap-2 text-[14px] leading-[18px] tracking-[-0.03em] text-[#1E7431]">
                      <ShieldCheck className="size-4 shrink-0" strokeWidth={1.5} />
                      {successMessage}
                    </p>
                  )}
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Updating…" : "Update password"}
                  </Button>
                </form>
              </section>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-hidden px-4 pb-16 md:px-10">
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-[60px]">
      <h1 className="text-[32px] font-bold leading-[28px] tracking-[-1.6px] text-[#1A202C]">Settings</h1>

      <div className="flex flex-col gap-6">
        <section>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="tracking-[-0.05em]">Profile</CardTitle>
                <CardDescription className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
                  Details from your AthaNext profile.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(isCoach ? `${ROUTES.PROFILE}?mode=edit` : ROUTES.PROFILE)}
              >
                Edit
              </Button>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  {userImg ? <AvatarImage src={userImg} alt={displayName} /> : null}
                  <AvatarFallback className="bg-[#E5EDF7] text-[16px] font-medium text-[#0054B4]">
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-[12px] font-medium leading-[14px] tracking-[-0.03em] text-[#767980]">Profile picture</p>
                  <button
                    type="button"
                    className="mt-1 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#0054B4] hover:underline"
                    onClick={() => navigate(isCoach ? `${ROUTES.PROFILE}?mode=edit` : ROUTES.PROFILE)}
                  >
                    Update
                  </button>
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Full name" value={displayName} />
                <Field label="Email" value={email} />
                <Field label="Sport" value={sportLabel} />
                <Field label="Position" value={position} />
                {isAthleteLike && (
                  <>
                    <Field label="Date of birth" value={dobLabel} />
                    <Field
                      label="Phone number"
                      value={(athlete?.phone_number as string) || null}
                    />
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle className="tracking-[-0.05em]">Time zone</CardTitle>
              <CardDescription className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
                Session times show in this zone. Availability is still entered in Eastern Time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TimeZoneSelect className="w-full max-w-[360px]" />
            </CardContent>
          </Card>
        </section>

        {isCoach && (
          <section>
            <Card>
              <CardHeader>
                <CardTitle className="tracking-[-0.05em]">Bookings</CardTitle>
              </CardHeader>
              <CardContent>
                <BookingConfirmationToggle />
              </CardContent>
            </Card>
          </section>
        )}

        {isAthleteLike && (
          <section>
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <CardTitle className="tracking-[-0.05em]">Guardian</CardTitle>
                <Button variant="outline" size="sm" disabled>
                  Edit
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field label="Name" value={null} empty="Not set" />
                  <Field label="Email" value={null} empty="Not set" />
                  <Field
                    label="Verification status"
                    value={user?.email_confirmed_at ? "Verified" : "Pending verification"}
                  />
                </div>
                <Button variant="outline" disabled>
                  Add guardian
                </Button>
              </CardContent>
            </Card>
          </section>
        )}

        <section>
          <Card>
            <CardHeader>
              <CardTitle className="tracking-[-0.05em]">Account</CardTitle>
            </CardHeader>
            <CardContent>
              {!isAthleteLike && (
                <div className="mb-6">
                  <Field
                    label="Verification status"
                    value={user?.email_confirmed_at ? "Verified" : "Pending verification"}
                  />
                </div>
              )}
              <Button
                variant="outline"
                className="border-[#FD9191] bg-[#FEECEC] text-[#FB4747] hover:bg-[#FEECEC]"
                disabled
              >
                Delete account
              </Button>
            </CardContent>
          </Card>
        </section>

        {canChangePassword && (
          <section>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 tracking-[-0.05em]">
                  <KeyRound className="size-5 text-[#767980]" strokeWidth={1.5} />
                  Change password
                </CardTitle>
                <CardDescription className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
                  Update the password for {email}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-5" onSubmit={handlePasswordChange}>
                  <div className="space-y-2">
                    <Label htmlFor="current-password" className={fieldLabelClass}>Current password</Label>
                    <div className="relative">
                      <Input
                        id="current-password"
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="pr-10"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#767980] transition-colors hover:text-[#1A202C]"
                        onClick={() => setShowCurrentPassword((v) => !v)}
                        aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                      >
                        {showCurrentPassword ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-password" className={fieldLabelClass}>New password</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        onFocus={() => setIsNewPasswordFocused(true)}
                        onBlur={() => setIsNewPasswordFocused(false)}
                        className="pr-10"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#767980] transition-colors hover:text-[#1A202C]"
                        onClick={() => setShowNewPassword((v) => !v)}
                        aria-label={showNewPassword ? "Hide password" : "Show password"}
                      >
                        {showNewPassword ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
                      </button>
                    </div>
                    {(isNewPasswordFocused || newPassword) && (
                      <PasswordRequirements items={passwordValidationItems} />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className={fieldLabelClass}>Confirm new password</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pr-10"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#767980] transition-colors hover:text-[#1A202C]"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="size-4" strokeWidth={1.5} />
                        ) : (
                          <Eye className="size-4" strokeWidth={1.5} />
                        )}
                      </button>
                    </div>
                  </div>

                  {formError && (
                    <p className="flex items-center gap-2 text-[14px] leading-[18px] tracking-[-0.03em] text-destructive">
                      <Lock className="size-4 shrink-0" strokeWidth={1.5} />
                      {formError}
                    </p>
                  )}
                  {successMessage && (
                    <p className="flex items-center gap-2 text-[14px] leading-[18px] tracking-[-0.03em] text-[#1E7431]">
                      <ShieldCheck className="size-4 shrink-0" strokeWidth={1.5} />
                      {successMessage}
                    </p>
                  )}

                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Updating…" : "Update password"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>
        )}

        <section>
          <Card>
            <CardHeader>
              <CardTitle className="tracking-[-0.05em]">Payments</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[16px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">Stripe</p>
                <p className="mt-1 text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">Not connected</p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
    </div>
  );
};

export default AccountSettings;
