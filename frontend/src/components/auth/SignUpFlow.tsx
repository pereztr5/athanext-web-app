/**
 * Sign up (ATH-93): who is using AthaNext, your account, a 6-digit email code, then a short
 * profile step that writes straight into the profile. Athletes under 18 sign up through a
 * parent, who holds the account. New athletes land on Home with the Finish profile card.
 */
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, ClipboardList, ShieldCheck, User } from "lucide-react";
import { authAPI } from "@/api/auth";
import { coachesAPI, userProfilesAPI } from "@/api";
import { createAthleteInitiatedReferral } from "@/api/referrals";
import { PasswordRequirements } from "@/components/password/PasswordRequirements";
import { input, label, meta, primaryButton, textButton } from "@/components/schedule/styles";
import { useAuth } from "@/contexts/AuthContext";
import { usePasswordValidation } from "@/hooks/usePasswordValidation";
import { useSportPillars } from "@/hooks/useSportPillars";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { ageOn } from "@/utils/athleteHome";
import { clearJoinCoach } from "@/utils/referralHelpers";
import { SIGNUP_ROLE_KEY, readSignupRole, type SignupRole } from "@/utils/signup";

type Step = "role" | "account" | "verify" | "profile";

const ATHLETE_POSITIONS = ["Goalkeeper", "Field player"];
const COACH_POSITIONS: Record<string, string[]> = {
  soccer: ["Goalkeeper", "Field Player"],
  rowing: ["Rower", "Coxswain"],
};

const chip = (on: boolean) =>
  cn(
    "rounded-full border px-3 py-1.5 text-[14px] font-medium transition-colors",
    on ? "border-[#6698D2] bg-[#E5EDF7] text-[#0054B4]" : "border-[#EAEADF] bg-[#F9F9F5] text-[#484D56] hover:bg-[#F1F1E6]"
  );

const errorText = (err: unknown, fallback: string) =>
  (err && typeof err === "object" && "message" in err && typeof err.message === "string" && err.message) || fallback;

const Steps = ({ n }: { n: number }) => (
  <div className="flex gap-1.5" aria-label={`Step ${n} of 3`}>
    {[1, 2, 3].map((i) => (
      <span key={i} className={cn("h-1 flex-1 rounded-full", i <= n ? "bg-[#0054B4]" : "bg-[#EAEADF]")} />
    ))}
  </div>
);

const Field = ({ text, error, children }: { text: string; error?: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-1.5">
    <span className={label}>{text}</span>
    {children}
    {error ? <span className="text-[12px] text-[#972B2B]">{error}</span> : null}
  </label>
);

export const SignUpFlow = ({ inviteToken, joinCoachId }: { inviteToken: string | null; joinCoachId: string | null }) => {
  const { user, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // A signed-in user who verified but didn't finish picks up at the profile step.
  const resumeRole = user ? readSignupRole() : null;
  const [step, setStep] = useState<Step>(resumeRole ? "profile" : "role");
  const [role, setRole] = useState<SignupRole>(resumeRole ?? "athlete");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [code, setCode] = useState("");

  const [athFirst, setAthFirst] = useState("");
  const [athLast, setAthLast] = useState("");
  const [dob, setDob] = useState("");
  const [sport, setSport] = useState<"soccer" | "rowing">("soccer");
  const [position, setPosition] = useState("");
  const [coachPositions, setCoachPositions] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [pillars, setPillars] = useState<string[]>([]);

  const { items: passwordItems, allValid: passwordOk } = usePasswordValidation(password);
  const { sportPillars } = useSportPillars({ sport, autoFetch: step === "profile" && role === "coach" });

  useEffect(() => setErrors({}), [step]);
  useEffect(() => {
    setCoachPositions([]);
    setPillars([]);
  }, [sport]);

  const today = new Date().toISOString().slice(0, 10);
  const age = ageOn(dob || null, today);
  const minor = age !== null && age < 18;

  const submitAccount = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!first.trim()) next.first = "Required";
    if (!last.trim()) next.last = "Required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email";
    if (!passwordOk) next.password = "Use a stronger password";
    if (!terms) next.terms = "Please accept to continue";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    const name = `${first.trim()} ${last.trim()}`;
    const { error } = await authAPI.signUp({
      email: email.trim().toLowerCase(),
      password,
      name,
      metadata: { name, persona_type: role === "coach" ? "coach" : "athlete" },
      emailRedirectTo: `${window.location.origin}/auth?mode=complete-profile${inviteToken ? `&invite=${inviteToken}` : ""}`,
    });
    setBusy(false);
    if (error) {
      setErrors({ email: error.message });
      return;
    }
    setStep("verify");
  };

  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setErrors({ code: "Enter the 6-digit code" });
      return;
    }
    setBusy(true);
    // Keeps Auth from sending a half-finished account to the old profile form.
    try {
      sessionStorage.setItem(SIGNUP_ROLE_KEY, role);
    } catch {
      // The flow still works; a reload just won't resume.
    }
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "signup" });
    setBusy(false);
    if (error) {
      try {
        sessionStorage.removeItem(SIGNUP_ROLE_KEY);
      } catch {
        // ignore
      }
      setErrors({ code: error.message.includes("expired") ? "That code has expired. Send a new one." : "That code didn't work. Check it and try again." });
      return;
    }
    setStep("profile");
  };

  const resend = async () => {
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim().toLowerCase() });
    toast(error ? { title: "Couldn't send a new code", description: error.message, variant: "destructive" } : { title: "New code sent" });
  };

  const finish = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (role === "athlete") {
      if (!athFirst.trim()) next.athFirst = "Required";
      if (!athLast.trim()) next.athLast = "Required";
      if (!dob || dob >= today) next.dob = "Enter a date of birth";
      if (!position) next.position = "Pick a position";
    } else {
      if (!coachPositions.length) next.position = "Pick at least one";
      if (!city.trim()) next.city = "Add your city";
      if (!pillars.length) next.pillars = "Pick at least one";
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    const { data: auth } = await supabase.auth.getUser();
    const me = auth.user;
    if (!me) {
      toast({ title: "Your session ended", description: "Sign in to finish setting up.", variant: "destructive" });
      return;
    }
    const accountName = (me.user_metadata?.name as string | undefined) || `${first} ${last}`.trim() || me.email?.split("@")[0] || "";
    setBusy(true);
    try {
      if (role === "athlete") {
        const { data: athlete, error: athleteError } = await supabase
          .from("athlete_profiles")
          .insert({
            user_id: me.id,
            full_name: `${athFirst.trim()} ${athLast.trim()}`,
            date_of_birth: dob,
            sport,
            position,
            tags: [],
          })
          .select("id")
          .single();
        if (athleteError) throw athleteError;
        const persona = minor ? "parent" : "athlete";
        const { error: profileError } = await userProfilesAPI.upsertUserProfile({
          id: me.id,
          email: me.email ?? email,
          name: minor ? accountName : `${athFirst.trim()} ${athLast.trim()}`,
          persona_type: persona,
          sport,
          position,
          date_of_birth: dob,
          athlete_id: athlete.id,
          is_profile_completed: true,
        });
        if (profileError) throw new Error(profileError.message);
        await supabase.auth.updateUser({ data: { persona_type: persona, athlete_id: athlete.id } });
        if (!inviteToken && joinCoachId) {
          await createAthleteInitiatedReferral(joinCoachId);
          clearJoinCoach();
        }
      } else {
        const { data: coach, error: coachError } = await coachesAPI.createCoach({
          name: accountName,
          specialties: pillars,
          locations: [city.trim()],
          position: coachPositions.join(", "),
          positions: coachPositions,
          favourite_positions: coachPositions,
        });
        if (coachError || !coach) throw new Error(coachError?.message ?? "Couldn't create your coaching profile");
        const { error: profileError } = await userProfilesAPI.upsertUserProfile({
          id: me.id,
          email: me.email ?? email,
          name: accountName,
          persona_type: "coach",
          sport,
          position: coachPositions.join(", "),
          coach_id: coach.id,
          is_profile_completed: true,
        });
        if (profileError) throw new Error(profileError.message);
        await supabase.auth.updateUser({ data: { persona_type: "coach", coach_id: coach.id } });
      }
      try {
        sessionStorage.removeItem(SIGNUP_ROLE_KEY);
      } catch {
        // ignore
      }
      await refreshUserProfile();
      toast({ title: "Your account is ready" });
      navigate(inviteToken ? `/invite/${inviteToken}` : ROUTES.DASHBOARD, { replace: true });
    } catch (err) {
      toast({ title: "Couldn't finish setting up", description: errorText(err, "Please try again."), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (step === "role") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[14px] font-medium text-[#1A202C]">Who is using AthaNext?</p>
        {(
          [
            ["athlete", User, "Athlete", "Book coaches, pay and follow progress. Under 18? A parent signs up and manages the account."],
            ["coach", ClipboardList, "Coach", "Run your schedule, get paid and grow your business."],
          ] as const
        ).map(([key, Icon, title, detail]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setRole(key);
              setStep("account");
            }}
            className="flex items-center gap-3 rounded-[8px] border border-[#EAEADF] bg-[#F9F9F5] p-3 text-left hover:border-[#6698D2]"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-[#E5EDF7] text-[#0054B4]">
              <Icon className="size-5" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <b className="text-[14px] font-medium">{title}</b>
              <span className={meta}>{detail}</span>
            </span>
            <ChevronRight className="size-4 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
          </button>
        ))}
      </div>
    );
  }

  if (step === "account") {
    return (
      <form onSubmit={submitAccount} className="flex flex-col gap-3" noValidate>
        <Steps n={1} />
        <p className="text-[16px] font-medium">Your account</p>
        {role === "athlete" ? <p className={meta}>If the athlete is under 18, use a parent's details. They manage the account.</p> : null}
        <div className="grid grid-cols-2 gap-3">
          <Field text="First name" error={errors.first}>
            <input className={input} value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" autoFocus />
          </Field>
          <Field text="Last name" error={errors.last}>
            <input className={input} value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" />
          </Field>
        </div>
        <Field text="Email" error={errors.email}>
          <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        <Field text="Password" error={errors.password}>
          <input className={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        {password ? <PasswordRequirements items={passwordItems} /> : null}
        <label className="flex items-start gap-2 text-[13px] text-[#484D56]">
          <input type="checkbox" className="mt-[3px]" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          <span>
            I agree to the{" "}
            <Link to={ROUTES.TERMS_AND_CONDITIONS} target="_blank" className="text-[#0054B4] hover:underline">Terms</Link> and{" "}
            <Link to={ROUTES.PRIVACY_POLICY} target="_blank" className="text-[#0054B4] hover:underline">Privacy Policy</Link>
          </span>
        </label>
        {errors.terms ? <span className="text-[12px] text-[#972B2B]">{errors.terms}</span> : null}
        <button type="submit" className={cn(primaryButton, "h-[40px] w-full")} disabled={busy}>
          {busy ? "Creating your account…" : "Continue"}
        </button>
        <button type="button" className={cn(textButton, "self-center")} onClick={() => setStep("role")}>Back</button>
      </form>
    );
  }

  if (step === "verify") {
    return (
      <form onSubmit={submitCode} className="flex flex-col gap-3" noValidate>
        <Steps n={2} />
        <p className="text-[16px] font-medium">Check your email</p>
        <p className={meta}>We sent a 6-digit code to {email.trim().toLowerCase()}.</p>
        <Field text="Verification code" error={errors.code}>
          <input
            className={cn(input, "tracking-[0.3em]")}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
        </Field>
        <button type="submit" className={cn(primaryButton, "h-[40px] w-full")} disabled={busy}>
          {busy ? "Checking…" : "Verify email"}
        </button>
        <button type="button" className={cn(textButton, "self-center")} onClick={resend}>Send a new code</button>
      </form>
    );
  }

  const coachPositionOptions = COACH_POSITIONS[sport] ?? [];
  return (
    <form onSubmit={finish} className="flex flex-col gap-3" noValidate>
      <Steps n={3} />
      {role === "athlete" ? (
        <>
          <p className="text-[16px] font-medium">About the athlete</p>
          <p className={meta}>Just what coaches need to book. You can add more later.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field text="First name" error={errors.athFirst}>
              <input className={input} value={athFirst} onChange={(e) => setAthFirst(e.target.value)} autoFocus />
            </Field>
            <Field text="Last name" error={errors.athLast}>
              <input className={input} value={athLast} onChange={(e) => setAthLast(e.target.value)} />
            </Field>
          </div>
          <Field text="Date of birth" error={errors.dob}>
            <input className={input} type="date" max={today} value={dob} onChange={(e) => setDob(e.target.value)} />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className={label}>Sport</span>
            <div className="flex gap-2">
              {(["soccer", "rowing"] as const).map((s) => (
                <button key={s} type="button" className={chip(sport === s)} aria-pressed={sport === s} onClick={() => setSport(s)}>
                  {s === "soccer" ? "Soccer" : "Rowing"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={label}>Position</span>
            <div className="flex gap-2">
              {ATHLETE_POSITIONS.map((p) => (
                <button key={p} type="button" className={chip(position === p)} aria-pressed={position === p} onClick={() => setPosition(p)}>
                  {p}
                </button>
              ))}
            </div>
            {errors.position ? <span className="text-[12px] text-[#972B2B]">{errors.position}</span> : null}
          </div>
          {minor ? (
            <p className="flex items-start gap-2 rounded-[8px] bg-[#E5EDF7] px-3 py-2.5 text-[13px] leading-[18px] text-[#00326C]">
              <ShieldCheck className="mt-[1px] size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              The athlete is under 18, so you stay the account holder. The athlete has no separate login.
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-[16px] font-medium">Set up your coaching profile</p>
          <p className={meta}>You can change all of this later.</p>
          <div className="flex flex-col gap-1.5">
            <span className={label}>Sport</span>
            <div className="flex gap-2">
              {(["soccer", "rowing"] as const).map((s) => (
                <button key={s} type="button" className={chip(sport === s)} aria-pressed={sport === s} onClick={() => setSport(s)}>
                  {s === "soccer" ? "Soccer" : "Rowing"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={label}>Positions you coach</span>
            <div className="flex flex-wrap gap-2">
              {coachPositionOptions.map((p) => {
                const on = coachPositions.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    className={chip(on)}
                    aria-pressed={on}
                    onClick={() => setCoachPositions((cur) => (on ? cur.filter((x) => x !== p) : [...cur, p]))}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            {errors.position ? <span className="text-[12px] text-[#972B2B]">{errors.position}</span> : null}
          </div>
          <Field text="City" error={errors.city}>
            <input className={input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Austin, TX" autoComplete="address-level2" />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className={label}>Pillars you coach</span>
            <div className="flex flex-wrap gap-2">
              {sportPillars.map((p) => {
                const on = pillars.includes(p.title);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={chip(on)}
                    aria-pressed={on}
                    onClick={() => setPillars((cur) => (on ? cur.filter((x) => x !== p.title) : [...cur, p.title]))}
                  >
                    {p.title}
                  </button>
                );
              })}
            </div>
            {errors.pillars ? <span className="text-[12px] text-[#972B2B]">{errors.pillars}</span> : null}
          </div>
        </>
      )}
      <button type="submit" className={cn(primaryButton, "h-[40px] w-full")} disabled={busy}>
        {busy ? "Saving…" : role === "athlete" ? "Finish" : "Create profile"}
      </button>
    </form>
  );
};
