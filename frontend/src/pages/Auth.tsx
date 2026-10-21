import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Banner } from "@/components/ui/banner";
import { useAuth } from "@/contexts/AuthContext";
import { authAPI, userProfilesAPI } from "@/api";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { strings } from "@/config/strings";
import { authSchema } from "@/utils/validations";
import { Loader2, Eye, EyeOff } from "@/components/icons";
import { LegalAuthFooter } from "@/components/legal/LegalLinks";
import { useQuery } from "@tanstack/react-query";
import { getCoachName } from "@/api/referrals";
import { useReferralInvite } from "@/hooks/useReferrals";
import { INVITE_TOKEN_STORAGE_KEY, readJoinCoach } from "@/utils/referralHelpers";
import { clearSignupSession } from "@/utils/signup";
import { SignUpFlow } from "@/components/auth/SignUpFlow";
import { ROUTES } from "@/routes";
import logo from "@/assets/AthaNext-Logo.svg";

const fieldLabel = "text-label-xsm text-dark-300";
const fieldError = "text-caption text-error-700";
const titleText = "text-section text-dark";
const descriptionText = "text-body-m text-dark-300";
const pageShell = "min-h-screen bg-background pt-20";
const pageCentre = "flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-10";

const BrandLogo = () => <img src={logo} alt="AthaNext" className="h-7 w-auto" />;

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showSigninPassword, setShowSigninPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState("signin");
  // The account Auth has finished checking. Until then a signed-in visitor sees a spinner.
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);
  const { user, signIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const modeParam = searchParams.get("mode");
  const passwordUpdated = searchParams.get("message") === "password-updated";
  const inviteParam = searchParams.get('invite');
  useEffect(() => {
    if (inviteParam) sessionStorage.setItem(INVITE_TOKEN_STORAGE_KEY, inviteParam);
  }, [inviteParam]);
  const inviteToken = inviteParam ?? sessionStorage.getItem(INVITE_TOKEN_STORAGE_KEY);
  const { invite: pendingInvite } = useReferralInvite(inviteToken);
  const inviteCoachName = pendingInvite?.state === "valid" ? pendingInvite.coach_name : null;
  // An invited athlete accepts on the invite page once signed in (email must match there).
  const invitePath = inviteToken ? `/invite/${inviteToken}` : null;
  // A coach's share link (ATH-78): the sign-up asks to join that coach's athletes.
  const coachParam = searchParams.get("coach");
  const joinCoachId = useMemo(() => (inviteToken ? null : readJoinCoach(coachParam)), [inviteToken, coachParam]);
  const { data: joinCoachName } = useQuery({
    queryKey: ["join-coach-name", joinCoachId],
    queryFn: () => getCoachName(joinCoachId!),
    enabled: Boolean(joinCoachId),
    staleTime: Infinity,
  });
  // Set by SignUpFlow before it verifies or saves, so the check below doesn't navigate away
  // while the new account is being written (or while it shows matches afterwards).
  const signupSavingRef = useRef(false);
  const clearFieldError = (field: string) => {
    if (!errors[field]) return;
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  // Old links and emails used mode=complete-profile. Every unfinished account now finishes in
  // the sign-up flow.
  useEffect(() => {
    if (modeParam !== "complete-profile") return;
    const next = new URLSearchParams(searchParams);
    next.set("mode", "signup");
    navigate(`${ROUTES.AUTH}?${next.toString()}`, { replace: true, state: location.state });
  }, [modeParam, searchParams, navigate, location.state]);

  // Signed in: a finished account goes on to the app, an unfinished one to the sign-up flow.
  // Runs when the signed-in account or the mode changes, not on token refreshes.
  const userId = user?.id ?? null;
  useEffect(() => {
    let isMounted = true;

    const checkUserProfile = async () => {
      if (!userId || signupSavingRef.current) return;

      const { data, error } = await userProfilesAPI.getUserProfile(userId);
      if (!isMounted) return;
      if (error) {
        console.error("Failed to load user profile:", error);
      }

      if (data?.is_profile_completed !== true) {
        if (modeParam !== "signup" && modeParam !== "complete-profile") {
          // Only explain the redirect when someone just signed in here, not on "/" or a refresh.
          if (modeParam === "signin") {
            toast({ title: "Finish signing up", description: "A few more details and your account is ready." });
          }
          const next = new URLSearchParams({ mode: "signup" });
          if (inviteToken) next.set("invite", inviteToken);
          navigate(`${ROUTES.AUTH}?${next.toString()}`, { replace: true, state: location.state });
        }
        setCheckedUserId(userId);
        return;
      }

      // Finished account: leftover sign-up answers in this tab no longer apply.
      clearSignupSession();
      setCheckedUserId(userId);
      const from = (location.state as { from?: { pathname: string; search?: string } } | null)?.from;
      navigate(from ? `${from.pathname}${from.search ?? ""}` : invitePath ?? ROUTES.DASHBOARD, { replace: true });
    };

    checkUserProfile();

    return () => {
      isMounted = false;
    };
    // location.state, invite and toast are read at check time; re-checking on them would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, modeParam]);

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }

    // Set active tab based on mode parameter
    setActiveTab(modeParam === "signup" || modeParam === "complete-profile" ? "signup" : "signin");
  }, [searchParams, modeParam]);

  const validateForm = () => {
    try {
      authSchema.parse({ email, password });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.issues.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Answers from an abandoned sign-up in this tab must not hold the sign-in back.
    clearSignupSession();
    signupSavingRef.current = false;
    setIsLoading(true);
    const { error } = await signIn(email, password);
    if (
      error &&
      (error.code === "email_not_confirmed" ||
        error.message?.toLowerCase?.().includes("confirm"))
    ) {
      const confirmationUrl = `${ROUTES.SIGN_UP_CONFIRMATION}?email=${encodeURIComponent(email)}`;
      navigate(confirmationUrl, { replace: true });
    }
    setIsLoading(false);
  };

  const handleGoogleSignIn = async () => {
    clearSignupSession();
    setIsLoading(true);
    try {
      // A new Google account comes back to the sign-up flow via ProtectedRoute.
      const redirectTo = `${window.location.origin}${invitePath ?? "/"}`;

      const { error } = await authAPI.signInWithOAuth('google', { redirectTo });

      if (error) {
        toast({
          title: "Google sign in failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Google signin error:', error);
      toast({
        title: "Something went wrong",
        description: "Try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (user && checkedUserId !== user.id && !signupSavingRef.current) {
    return (
      <div className={pageShell}>
        <div className={pageCentre}>
          <Card className="w-full max-w-[440px]">
            <CardContent className="flex flex-col items-center gap-4 px-[25px] py-10">
              <BrandLogo />
              <Loader2 strokeWidth={1.5} className="h-6 w-6 animate-spin text-primary" />
              <p className={cn(descriptionText, "text-center")}>
                Checking your account details…
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={pageShell}>
      <div className={pageCentre}>
        <Card className={cn("w-full", activeTab === "signup" ? "max-w-[480px]" : "max-w-[440px]")}>
          {activeTab === "signin" ? (
            <CardHeader className="items-center gap-2.5 space-y-0 text-center">
              <BrandLogo />
              <CardTitle className={cn(titleText, "pt-2")}>Welcome back</CardTitle>
              <CardDescription className={descriptionText}>
                Sign in to book and manage your sessions.
              </CardDescription>
            </CardHeader>
          ) : null}
          <CardContent className={activeTab === "signup" ? "pt-6" : undefined}>
            {joinCoachName && !inviteCoachName && (
              <div className="mb-4 rounded-control border border-primary-300 bg-primary-50 p-3 text-body-m text-dark">
                <span className="font-medium">Coach {joinCoachName}</span> invited you to {strings.brand.name}.
                Sign up as a parent or athlete, and they'll approve you as their client.
              </div>
            )}
            {inviteCoachName && (
              <div className="mb-4 rounded-control border border-primary-300 bg-primary-50 p-3 text-body-m text-dark">
                <span className="font-medium">Coach {inviteCoachName}</span>{" "}
                invited you to {strings.brand.name}. Use the email the invite was sent to
                ({pendingInvite?.masked_email}) to book with them with no platform service fee.
              </div>
            )}
            <Tabs value={activeTab} onValueChange={(value) => {
              setActiveTab(value);
              navigate(`/auth?mode=${value}`, { replace: true, state: location.state });
            }} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-5 space-y-4">
                <div className="space-y-4">
                  {passwordUpdated ? (
                    <Banner tone="success">Password updated. Sign in with your new password.</Banner>
                  ) : null}
                  {/* Google sign in button */}
                  <Button
                    type="button"
                    variant="outline"
                    className="flex w-full items-center gap-2"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    {isLoading ? "Signing in…" : "Continue with Google"}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-light-525" />
                    </div>
                    <div className="relative flex justify-center text-caption">
                      <span className="bg-card px-2 text-dark-300">
                        or sign in with email
                      </span>
                    </div>
                  </div>

                  {/* Email/Password Form */}
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="signin-email" className={fieldLabel}>{strings.form.labels.email}</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          setEmail(nextValue);
                          if (nextValue) {
                            clearFieldError("email");
                          }
                        }}
                        placeholder="Enter your email"
                        required
                      />
                      {errors.email && (
                        <p className={fieldError}>{errors.email}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signin-password" className={fieldLabel}>{strings.form.labels.password}</Label>
                      <div className="relative">
                        <Input
                          id="signin-password"
                          type={showSigninPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            setPassword(nextValue);
                            if (nextValue) {
                              clearFieldError("password");
                            }
                          }}
                          placeholder="Enter your password"
                          required
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSigninPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-2 flex items-center rounded-control text-dark-300 hover:text-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          aria-label={showSigninPassword ? "Hide password" : "Show password"}
                        >
                          {showSigninPassword ? <EyeOff strokeWidth={1.5} className="h-4 w-4" /> : <Eye strokeWidth={1.5} className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className={fieldError}>{errors.password}</p>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="rounded-control text-label-xsm text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        onClick={() => navigate("/forgot-password")}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                      {isLoading ? "Signing in…" : "Sign in"}
                    </Button>
                  </form>
                  <p className="text-center text-caption text-dark-300">
                    {invitePath ? (
                      <>
                        Got an invite from your coach?{" "}
                        <Link
                          to={invitePath}
                          className="rounded-control font-medium text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          Accept it here
                        </Link>
                      </>
                    ) : (
                      "Got an invite from your coach? Open the link in their email."
                    )}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="signup" className="mt-5 space-y-4">
                {/* Google / email live inside SignUpFlow's account step (WC4 one-question signup). */}
                <SignUpFlow
                  inviteToken={inviteToken}
                  joinCoachId={joinCoachId}
                  onSaving={() => {
                    signupSavingRef.current = true;
                  }}
                />
              </TabsContent>
            </Tabs>
            <LegalAuthFooter className="mt-5" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
