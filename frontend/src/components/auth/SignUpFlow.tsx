/**
 * Sign up (WC4): one question per screen with big tiles and a clickable progress bar.
 * Coach / athlete 18+ / parent → questions → account (Google or email, country code, terms) →
 * 6-digit email code → families see match cards, coaches see a draft profile.
 * Athletes under 18 email a parent instead. No background-check / admin-review step.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  ClipboardList,
  Dumbbell,
  Eye,
  EyeOff,
  Flag,
  GraduationCap,
  Mail,
  MapPin,
  Medal,
  MessageCircle,
  ShieldCheck,
  Sprout,
  Star,
  User,
  Users,
  Video,
  Zap,
} from "lucide-react";
import { authAPI } from "@/api/auth";
import { coachesAPI, userProfilesAPI, type PublicCoach } from "@/api";
import { createAthleteInitiatedReferral } from "@/api/referrals";
import { getSportPillars, setSportPillars } from "@/api/sport-pillars";
import logo from "@/assets/AthaNext-Logo.svg";
import { PhoneInput } from "@/components/common/PhoneInput";
import { LegalAnchor } from "@/components/legal/LegalLinks";
import { PasswordRequirements } from "@/components/password/PasswordRequirements";
import { getPrivacyPolicyContent } from "@/api/privacy-policy";
import { getTermsAndConditionsContent } from "@/api/terms";
import { input, label, meta, primaryButton, secondaryButton, textButton } from "@/components/schedule/styles";
import { useAuth } from "@/contexts/AuthContext";
import { usePasswordValidation } from "@/hooks/usePasswordValidation";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { isValidE164 } from "@/utils/phone";
import { clearJoinCoach } from "@/utils/referralHelpers";
import {
  COACH_POS_TO_DB,
  LEVEL_TO_PATHWAY,
  ageYearsFromTile,
  clearSignupSession,
  dobFromAgeTile,
  emptySignupAnswers,
  readSignupAnswers,
  roleFromWho,
  writeSignupAnswers,
  writeSignupRole,
  type SignupAnswers,
  type SignupWho,
} from "@/utils/signup";

/** Pill primary CTA (WC4 `.gx-cta`): full-width, 46px, large radius. */
const signupCta = cn(primaryButton, "h-[46px] w-full rounded-[23px]");

const legalAcceptanceFields = async () => {
  const [termsRes, privacyRes] = await Promise.all([getTermsAndConditionsContent(), getPrivacyPolicyContent()]);
  const acceptedAt = new Date().toISOString();
  return {
    terms_version: String(termsRes.data?.version ?? "1"),
    terms_accepted_at: acceptedAt,
    privacy_version: String(privacyRes.data?.version ?? "1"),
    privacy_accepted_at: acceptedAt,
  };
};

type StepId =
  | "who"
  | "sport"
  | "pillars"
  | "level"
  | "clevels"
  | "age"
  | "where"
  | "cwhere"
  | "account"
  | "verify"
  | "matches"
  | "cprofile"
  | "invite"
  | "sent";

const FAMILY_FLOW: StepId[] = ["who", "sport", "pillars", "level", "age", "where", "account"];
const COACH_FLOW: StepId[] = ["who", "sport", "pillars", "clevels", "cwhere", "account"];
const OFF_FLOW: StepId[] = ["verify", "matches", "cprofile", "invite", "sent"];

const LEVELS: { id: string; title: string; detail: string; Icon: typeof User }[] = [
  { id: "Recreational", title: "Recreational", detail: "Any age, playing for fun and fitness", Icon: User },
  { id: "Youth development", title: "Youth development", detail: "Under 13, building the fundamentals", Icon: Sprout },
  { id: "Elite pathway", title: "Elite pathway", detail: "13 to 18, aiming to play in college or pro", Icon: Medal },
  { id: "College or pro", title: "College or pro", detail: "18 and over, playing at a high level", Icon: GraduationCap },
];

const PILLARS: Record<"Soccer" | "Rowing", { title: string; Icon: typeof User }[]> = {
  Soccer: [
    { title: "On-field training", Icon: Flag },
    { title: "Video analysis", Icon: Video },
    { title: "Mentorship", Icon: MessageCircle },
    { title: "Performance coaching", Icon: Dumbbell },
    { title: "Academic tutoring", Icon: BookOpen },
    { title: "College recruiting", Icon: GraduationCap },
  ],
  Rowing: [
    { title: "On-water technique", Icon: Zap },
    { title: "Erg and race training", Icon: Zap },
    { title: "Mentorship", Icon: MessageCircle },
    { title: "Strength and conditioning", Icon: Dumbbell },
    { title: "Academic tutoring", Icon: BookOpen },
    { title: "College recruiting", Icon: GraduationCap },
  ],
};

const AGE_TILES = [
  ["u9", "Under 9"],
  ...Array.from({ length: 9 }, (_, k) => [String(k + 9), String(k + 9)] as const),
  ["18", "18+"],
] as const;

const tileClass = (on: boolean) =>
  cn(
    "relative flex w-full items-start gap-3 rounded-[10px] border px-3.5 py-3 text-left transition-colors",
    on ? "border-[#0054B4] bg-[#E5EDF7]" : "border-[#EAEADF] bg-[#F9F9F5] hover:border-[#6698D2]"
  );

const errorText = (err: unknown, fallback: string) =>
  (err && typeof err === "object" && "message" in err && typeof err.message === "string" && err.message) || fallback;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

const Field = ({ text, error, children }: { text: string; error?: string; children: ReactNode }) => (
  <label className="flex flex-col gap-1.5">
    <span className={label}>{text}</span>
    {children}
    {error ? <span className="text-[12px] text-[#972B2B]">{error}</span> : null}
  </label>
);

const Tile = ({
  on,
  title,
  detail,
  icon,
  multi,
  onClick,
}: {
  on: boolean;
  title: string;
  detail?: string;
  icon?: ReactNode;
  multi?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    className={tileClass(on)}
    aria-pressed={multi ? on : undefined}
    role={multi ? undefined : "radio"}
    aria-checked={multi ? undefined : on}
    onClick={onClick}
  >
    {icon ? (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-[#E5EDF7] text-[#0054B4]">
        {icon}
      </span>
    ) : null}
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-[14px] font-medium text-[#1A202C]">{title}</span>
      {detail ? <span className={meta}>{detail}</span> : null}
    </span>
    <span
      className={cn(
        "mt-0.5 ml-auto flex size-5 shrink-0 items-center justify-center rounded-full border",
        on ? "border-[#0054B4] bg-[#0054B4] text-white" : "border-[#C1C1B8] text-transparent"
      )}
      aria-hidden="true"
    >
      <Check className="size-3" strokeWidth={2.5} />
    </span>
  </button>
);

export const SignUpFlow = ({ inviteToken, joinCoachId }: { inviteToken: string | null; joinCoachId: string | null }) => {
  const { user, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const saved = readSignupAnswers();
  const [answers, setAnswers] = useState<SignupAnswers>(() => saved ?? emptySignupAnswers());
  const [step, setStep] = useState<StepId>(() => {
    if (user && saved?.google) return "account";
    if (user && saved?.who) return saved.who === "coach" ? "cprofile" : "matches";
    return "who";
  });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [matches, setMatches] = useState<PublicCoach[]>([]);
  const [matchTotal, setMatchTotal] = useState(0);

  const { items: passwordItems, allValid: passwordOk } = usePasswordValidation(answers.pw);
  const isCoach = answers.who === "coach";
  const isParent = answers.who === "parent";
  const they = (parentCopy: string, selfCopy: string, coachCopy?: string) =>
    isCoach && coachCopy !== undefined ? coachCopy : isParent ? parentCopy : selfCopy;

  const flow = isCoach ? COACH_FLOW : FAMILY_FLOW;
  const flowIndex = flow.indexOf(step);
  const offFlow = OFF_FLOW.includes(step);
  const questionCount = flow.length - 1;
  const questionIndex = flowIndex >= 0 ? flowIndex : 0;
  const ageYears = ageYearsFromTile(answers.age);
  const isMinorSelf = answers.who === "self" && ageYears !== null && ageYears < 18;

  useEffect(() => {
    writeSignupAnswers(answers);
  }, [answers]);

  useEffect(() => {
    setErrors({});
  }, [step]);

  // Google return: land on Almost done when the account already exists.
  useEffect(() => {
    if (!user) return;
    const stored = readSignupAnswers();
    if (!stored?.who) return;
    if (stored.google && step === "who") {
      setAnswers({ ...stored, first: stored.first || (user.user_metadata?.name as string)?.split(" ")[0] || "", last: stored.last || (user.user_metadata?.name as string)?.split(" ").slice(1).join(" ") || "", email: user.email ?? stored.email });
      setStep("account");
    }
  }, [user, step]);

  const patch = (partial: Partial<SignupAnswers>) => setAnswers((cur) => ({ ...cur, ...partial }));

  const go = (id: StepId) => setStep(id);

  const nextFrom = (id: StepId) => {
    if (id === "who") return go("sport");
    if (id === "age" && isMinorSelf) return go("invite");
    if (id === "verify") return go(isCoach ? "cprofile" : "matches");
    const i = flow.indexOf(id);
    if (i >= 0 && i < flow.length - 1) go(flow[i + 1]!);
  };

  const back = () => {
    if (step === "invite") return go("age");
    if (step === "verify") return go("account");
    if (step === "matches" || step === "cprofile") return go("account");
    const i = flow.indexOf(step);
    if (i > 0) go(flow[i - 1]!);
  };

  const pickWho = (who: SignupWho) => {
    setAnswers((cur) => {
      if (cur.who === who) return cur;
      return {
        ...cur,
        who,
        age: null,
        pos: null,
        cpos: [],
        pillars: [],
        level: null,
        clevels: [],
        ctypes: [],
      };
    });
    window.setTimeout(() => go("sport"), 180);
  };

  const pickSport = (sport: "Soccer" | "Rowing") => {
    setAnswers((cur) =>
      cur.sport === sport
        ? cur
        : { ...cur, sport, pos: null, cpos: [], pillars: [] }
    );
  };

  const accountValid = () => {
    if (user || answers.google) {
      return isValidE164(answers.phone) && (!isParent || answers.ath.trim());
    }
    return (
      answers.first.trim() &&
      answers.last.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email.trim()) &&
      isValidE164(answers.phone) &&
      passwordOk &&
      (!isParent || answers.ath.trim())
    );
  };

  const createAccount = async () => {
    if (!answers.terms) {
      setErrors({ terms: "Please accept to continue" });
      return;
    }
    if (!accountValid()) {
      toast({
        title: user || answers.google ? "Add your mobile number to finish" : "Fill in every field to finish",
        variant: "destructive",
      });
      return;
    }

    writeSignupRole(roleFromWho(answers.who));

    // Google path: account already exists (or will after OAuth). Skip verify.
    if (user || answers.google) {
      await finishProfile();
      return;
    }

    setBusy(true);
    const name = `${answers.first.trim()} ${answers.last.trim()}`;
    const persona = isCoach ? "coach" : isParent ? "parent" : "athlete";
    const { error } = await authAPI.signUp({
      email: answers.email.trim().toLowerCase(),
      password: answers.pw,
      name,
      metadata: { name, persona_type: persona, phone_number: answers.phone },
      emailRedirectTo: `${window.location.origin}/auth?mode=signup${inviteToken ? `&invite=${inviteToken}` : ""}`,
    });
    setBusy(false);
    if (error) {
      setErrors({ email: error.message });
      return;
    }
    go("verify");
  };

  const startGoogle = async () => {
    writeSignupAnswers({ ...answers, google: true });
    writeSignupRole(roleFromWho(answers.who));
    setBusy(true);
    const { error } = await authAPI.signInWithOAuth("google", {
      redirectTo: `${window.location.origin}/auth?mode=signup${inviteToken ? `&invite=${inviteToken}` : ""}`,
    });
    setBusy(false);
    if (error) {
      toast({ title: "Google sign in failed", description: error.message, variant: "destructive" });
    }
  };

  const submitCode = async () => {
    if (!/^\d{6}$/.test(answers.code.trim())) {
      setErrors({ code: "Enter the 6-digit code" });
      return;
    }
    setBusy(true);
    writeSignupRole(roleFromWho(answers.who));
    const { error } = await supabase.auth.verifyOtp({
      email: answers.email.trim().toLowerCase(),
      token: answers.code.trim(),
      type: "signup",
    });
    setBusy(false);
    if (error) {
      setErrors({
        code: error.message.includes("expired")
          ? "That code has expired. Send a new one."
          : "That code didn't work. Check it and try again.",
      });
      return;
    }
    await finishProfile();
  };

  const resend = async () => {
    const { error } = await supabase.auth.resend({ type: "signup", email: answers.email.trim().toLowerCase() });
    toast(error ? { title: "Couldn't send a new code", description: error.message, variant: "destructive" } : { title: "New code sent" });
  };

  const loadMatches = async () => {
    const { data } = await coachesAPI.getPublicCoaches();
    const list = (data ?? []).filter((c) => c.is_verified !== false && c.status !== "inactive");
    const pos = answers.pos || "";
    const byPos = list.filter((c) => {
      const positions = [...(c.positions ?? []), c.position ?? ""].map((p) => p.toLowerCase());
      if (!pos) return true;
      if (pos.toLowerCase().includes("goalkeeper")) return positions.some((p) => p.includes("goalkeeper") || p.includes("keeper"));
      if (pos.toLowerCase().includes("field")) return positions.some((p) => p.includes("field") || !p.includes("goalkeeper"));
      return positions.some((p) => p.includes(pos.toLowerCase()));
    });
    const scored = [...byPos].sort((a, b) => {
      const score = (c: PublicCoach) =>
        (c.specialties ?? []).filter((s) => answers.pillars.some((p) => s.toLowerCase().includes(p.toLowerCase().split(" ")[0] ?? ""))).length;
      return score(b) - score(a) || (b.rating ?? 0) - (a.rating ?? 0);
    });
    setMatchTotal(scored.length || list.length);
    setMatches((scored.length ? scored : list).slice(0, 3));
  };

  const finishProfile = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const me = auth.user;
    if (!me) {
      toast({ title: "Your session ended", description: "Sign in to finish setting up.", variant: "destructive" });
      return;
    }

    const accountName =
      `${answers.first.trim()} ${answers.last.trim()}`.trim() ||
      (me.user_metadata?.name as string | undefined) ||
      me.email?.split("@")[0] ||
      "";
    const sportKey = (answers.sport ?? "Soccer").toLowerCase() as "soccer" | "rowing";

    setBusy(true);
    try {
      if (isCoach) {
        const coachPositions = answers.cpos.map((p) => COACH_POS_TO_DB[p] ?? p);
        const pathway = answers.clevels.map((l) => LEVEL_TO_PATHWAY[l] ?? l).filter(Boolean);
        const sessionTypes = answers.video ? ["in-person", "virtual"] : ["in-person"];
        const { data: coach, error: coachError } = await coachesAPI.createCoach({
          name: accountName,
          email: me.email ?? answers.email,
          specialties: answers.pillars,
          locations: answers.zip ? [answers.zip] : [],
          position: coachPositions.join(", "),
          positions: coachPositions,
          favourite_positions: coachPositions,
          pathway_tags: pathway,
          session_types: sessionTypes,
          listed: false,
          status: "active",
          // Keep is_verified as DB default (false). No admin-review / Checkr gate in this flow.
          is_verified: false,
        });
        if (coachError || !coach) throw new Error(coachError?.message ?? "Couldn't create your coaching profile");

        try {
          const pillarsRes = await getSportPillars(sportKey);
          const ids = (pillarsRes.data?.sportPillars ?? [])
            .filter((p) => answers.pillars.some((t) => t.toLowerCase() === p.title.toLowerCase()))
            .map((p) => p.id);
          if (ids.length) await setSportPillars(coach.id, sportKey, ids);
        } catch {
          // Pillars can be set later on the profile.
        }

        const legalAccept = await legalAcceptanceFields();
        const { error: profileError } = await userProfilesAPI.upsertUserProfile({
          id: me.id,
          email: me.email ?? answers.email,
          name: accountName,
          persona_type: "coach",
          sport: sportKey,
          position: coachPositions.join(", "),
          phone_number: answers.phone,
          zip_code: answers.zip || null,
          coach_id: coach.id,
          is_profile_completed: true,
          ...legalAccept,
        } as Parameters<typeof userProfilesAPI.upsertUserProfile>[0]);
        if (profileError) throw new Error(profileError.message);
        await supabase.auth.updateUser({ data: { persona_type: "coach", coach_id: coach.id } });
        clearSignupSession();
        await refreshUserProfile();
        go("cprofile");
      } else {
        const athFirst = isParent ? answers.ath.trim() : answers.first.trim();
        const athLast = isParent ? answers.last.trim() : answers.last.trim();
        const dob = dobFromAgeTile(answers.age);
        const pathway = answers.level ? [LEVEL_TO_PATHWAY[answers.level] ?? answers.level] : [];
        const { data: athlete, error: athleteError } = await supabase
          .from("athlete_profiles")
          .insert({
            user_id: me.id,
            full_name: `${athFirst} ${athLast}`.trim(),
            date_of_birth: dob,
            sport: sportKey,
            position: answers.pos,
            tags: answers.pillars,
            pathway_tags: pathway,
            phone_number: answers.phone,
          })
          .select("id")
          .single();
        if (athleteError) throw athleteError;

        const persona = isParent ? "parent" : "athlete";
        const legalAccept = await legalAcceptanceFields();
        const { error: profileError } = await userProfilesAPI.upsertUserProfile({
          id: me.id,
          email: me.email ?? answers.email,
          name: isParent ? accountName : `${athFirst} ${athLast}`.trim(),
          persona_type: persona,
          sport: sportKey,
          position: answers.pos,
          date_of_birth: dob,
          phone_number: answers.phone,
          zip_code: answers.zip || null,
          athlete_id: athlete.id,
          guardian_relationship: isParent ? "Parent" : null,
          is_profile_completed: true,
          ...legalAccept,
        } as Parameters<typeof userProfilesAPI.upsertUserProfile>[0]);
        if (profileError) throw new Error(profileError.message);
        await supabase.auth.updateUser({ data: { persona_type: persona, athlete_id: athlete.id } });
        if (!inviteToken && joinCoachId) {
          await createAthleteInitiatedReferral(joinCoachId);
          clearJoinCoach();
        }
        await loadMatches();
        clearSignupSession();
        await refreshUserProfile();
        go("matches");
      }
      toast({ title: "Your account is ready" });
    } catch (err) {
      toast({ title: "Couldn't finish setting up", description: errorText(err, "Please try again."), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const sendParentEmail = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.pemail.trim())) {
      setErrors({ pemail: "Enter a valid email" });
      return;
    }
    setBusy(true);
    const summary = [
      answers.sport,
      answers.pos,
      answers.level,
      answers.pillars.slice(0, 3).join(", "),
      answers.age === "u9" ? "Under 9" : answers.age ? `Age ${answers.age}` : "",
      answers.zip ? `ZIP ${answers.zip}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const link = `${window.location.origin}/auth?mode=signup`;
    const html = `
      <p>Your athlete started signing up for AthaNext and needs a parent or guardian to finish the account.</p>
      <p><strong>What they chose:</strong> ${summary || "Their preferences are ready."}</p>
      <p><a href="${link}">Create the parent account</a> to see coach matches and manage bookings.</p>
    `;
    try {
      const fromEmail = import.meta.env.VITE_CONTACT_FROM_EMAIL || "hello@athanext.com";
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          to: answers.pemail.trim().toLowerCase(),
          from: fromEmail,
          subject: "Finish your athlete's AthaNext account",
          html,
          message: `Your athlete started signing up for AthaNext. Open ${link} to finish as a parent.`,
        },
      });
      if (error) throw error;
      clearSignupSession();
      go("sent");
    } catch (err) {
      toast({
        title: "Couldn't send the email",
        description: errorText(err, "Please try again, or ask your parent to sign up directly."),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const leaveToApp = () => {
    clearSignupSession();
    if (inviteToken) {
      navigate(`/invite/${inviteToken}`, { replace: true });
      return;
    }
    if (isCoach) {
      navigate(ROUTES.DASHBOARD, { replace: true });
      return;
    }
    navigate(ROUTES.COACHES, { replace: true });
  };

  const Progress = () => {
    if (offFlow || step === "account") return null;
    const qs = questionCount;
    const qi = Math.min(questionIndex, qs - 1);
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-[8px] text-[#484D56] hover:bg-[#F1F1E6]",
              questionIndex <= 0 && "invisible"
            )}
            aria-label="Back"
            onClick={back}
          >
            <ChevronLeft className="size-5" strokeWidth={1.5} />
          </button>
          <div className="flex flex-1 items-center gap-1.5" role="group" aria-label={`Question ${qi + 1} of ${qs}`}>
            {Array.from({ length: qs }, (_, k) =>
              k < qi ? (
                <button
                  key={k}
                  type="button"
                  className="relative h-[18px] flex-1 p-0"
                  aria-label={`Back to question ${k + 1}`}
                  title={`Question ${k + 1}`}
                  onClick={() => go(flow[k]!)}
                >
                  <span className="absolute inset-x-0 top-[6px] h-1.5 rounded-[3px] bg-[#0054B4]" />
                </button>
              ) : (
                <span key={k} className="relative h-[18px] flex-1" aria-hidden={k !== qi}>
                  <span
                    className={cn(
                      "absolute inset-x-0 top-[6px] h-1.5 rounded-[3px]",
                      k === qi ? "bg-[#0054B4]" : "bg-[#D9D9CF]"
                    )}
                  />
                </span>
              )
            )}
          </div>
          <span className={cn(meta, "min-w-[30px] text-right tabular-nums")}>
            {qi + 1}/{qs}
          </span>
        </div>
        <p className={cn(meta, "text-center font-medium text-[#0054B4]")}>
          {step === "who" ? "Welcome to AthaNext" : isCoach ? "Set up your coaching profile" : "Find the right coach"}
        </p>
      </div>
    );
  };

  const Head = ({ title, sub }: { title: string; sub?: string }) => (
    <div className="flex flex-col gap-1">
      <h2 className="text-[20px] font-semibold leading-[24px] tracking-[-0.03em] text-[#1A202C]">{title}</h2>
      {sub ? <p className={meta}>{sub}</p> : null}
    </div>
  );

  const Continue = ({ ok, onClick, label: lbl = "Continue" }: { ok: boolean; onClick: () => void; label?: string }) => (
    <button type="button" className={signupCta} disabled={!ok || busy} onClick={onClick}>
      {lbl}
      <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
    </button>
  );

  /** Logo home (WC4 `.gx-logo`): jumps to the first question after "Who's signing up?". */
  const LogoHome = () => {
    const clickable = !offFlow && step !== "who";
    const img = <img src={logo} alt="AthaNext" className="h-7 w-auto" />;
    if (!clickable) {
      return <span className="inline-flex items-center rounded-[8px] px-2 py-1.5 -ml-2">{img}</span>;
    }
    return (
      <button
        type="button"
        className="inline-flex items-center rounded-[8px] px-2 py-1.5 -ml-2 hover:bg-[#F1F1E6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]"
        aria-label="Back to the first question"
        title="Back to the start"
        onClick={() => go("who")}
      >
        {img}
      </button>
    );
  };

  const summaryPills = useMemo(() => {
    const bits = [
      answers.sport,
      ...(isCoach ? answers.cpos : [answers.pos]),
      answers.level,
      ...answers.pillars.slice(0, 2),
      answers.pillars.length > 2 ? `+${answers.pillars.length - 2} more` : "",
      answers.age && isParent ? (answers.age === "u9" ? "Under 9" : `Age ${answers.age}`) : "",
    ].filter(Boolean) as string[];
    return bits;
  }, [answers, isCoach, isParent]);

  // —— Screens ——
  let body: ReactNode = null;

  if (step === "who") {
    body = (
      <div className="flex flex-col gap-3">
        <Head title="Who's signing up?" />
        <Tile on={answers.who === "coach"} title="I'm a coach" detail="Run your coaching business on AthaNext" icon={<ClipboardList className="size-5" strokeWidth={1.5} />} onClick={() => pickWho("coach")} />
        <Tile on={answers.who === "self"} title="I'm an athlete" detail="18 or older" icon={<User className="size-5" strokeWidth={1.5} />} onClick={() => pickWho("self")} />
        <Tile on={answers.who === "parent"} title="I'm a parent or guardian" detail="Of an athlete under 18" icon={<Users className="size-5" strokeWidth={1.5} />} onClick={() => pickWho("parent")} />
        <p className={cn(meta, "text-center")}>
          Already have an account?{" "}
          <Link to={`${ROUTES.AUTH}?mode=signin`} className="font-medium text-[#0054B4] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    );
  } else if (step === "sport") {
    const soccerPos = isCoach
      ? [
          ["Goalkeepers", "Goalkeepers", ""],
          ["Field players", "Field players", "Defense, midfield or forward"],
        ]
      : [
          ["Goalkeeper", "Goalkeeper", ""],
          ["Field player", "Field player", "Defense, midfield or forward"],
        ];
    const rowingPos = isCoach
      ? [
          ["Rowers", "Rowers", "Sweep and sculling"],
          ["Coxswains", "Coxswains", "Steering and race calls"],
        ]
      : [
          ["Rower", "Rower", "Sweep or sculling"],
          ["Coxswain", "Coxswain", "Steers and calls the race"],
        ];
    const posOpts = answers.sport === "Rowing" ? rowingPos : soccerPos;
    const posTitle = isCoach
      ? "Which players do you coach?"
      : answers.sport === "Rowing"
        ? they("Where does your athlete sit in the boat?", "Where do you sit in the boat?")
        : they("What position does your athlete play?", "What position do you play?");

    body = (
      <div className="flex flex-col gap-3">
        <Head title={isCoach ? "Which sport do you coach?" : "Which sport?"} sub="Soccer and rowing are live now." />
        <div className="flex flex-col gap-2" role="radiogroup">
          <Tile on={answers.sport === "Soccer"} title="Soccer" onClick={() => pickSport("Soccer")} />
          <Tile on={answers.sport === "Rowing"} title="Rowing" onClick={() => pickSport("Rowing")} />
        </div>
        <div className="flex items-center gap-3 rounded-[10px] border border-dashed border-[#EAEADF] bg-[#F9F9F5] px-3.5 py-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-[#F1F1E6] text-[#767980]">+</span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[14px] font-medium">More sports</span>
            <span className={meta}>We're adding new sports to AthaNext</span>
          </span>
          <span className="rounded-full bg-[#EAEADF] px-2 py-0.5 text-[11px] font-medium text-[#484D56]">Coming soon</span>
        </div>
        {answers.sport ? (
          <div className="flex flex-col gap-2 border-t border-[#EAEADF] pt-3">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-[16px] font-medium text-[#1A202C]">{posTitle}</h3>
              {isCoach ? <p className={meta}>Pick all that apply.</p> : null}
            </div>
            {isCoach
              ? posOpts.map(([v, t, d]) => (
                  <Tile
                    key={v}
                    multi
                    on={answers.cpos.includes(v)}
                    title={t}
                    detail={d || undefined}
                    onClick={() =>
                      patch({
                        cpos: answers.cpos.includes(v) ? answers.cpos.filter((x) => x !== v) : [...answers.cpos, v],
                      })
                    }
                  />
                ))
              : posOpts.map(([v, t, d]) => (
                  <Tile
                    key={v}
                    on={answers.pos === v}
                    title={t}
                    detail={d || undefined}
                    onClick={() => {
                      patch({ pos: v });
                      window.setTimeout(() => nextFrom("sport"), 180);
                    }}
                  />
                ))}
            {isCoach ? <Continue ok={answers.cpos.length > 0} onClick={() => nextFrom("sport")} /> : null}
          </div>
        ) : null}
      </div>
    );
  } else if (step === "pillars") {
    const list = PILLARS[answers.sport ?? "Soccer"];
    body = (
      <div className="flex flex-col gap-3">
        <Head
          title={they("What do you want your athlete to work on?", "What do you want to work on?", "Which pillars do you coach?")}
          sub={isCoach ? "Pick every pillar you offer sessions in." : "Pick as many as you like."}
        />
        <div className="flex flex-col gap-2">
          {list.map(({ title, Icon }) => (
            <Tile
              key={title}
              multi
              on={answers.pillars.includes(title)}
              title={title}
              icon={<Icon className="size-5" strokeWidth={1.5} />}
              onClick={() =>
                patch({
                  pillars: answers.pillars.includes(title)
                    ? answers.pillars.filter((x) => x !== title)
                    : [...answers.pillars, title],
                })
              }
            />
          ))}
        </div>
        <Continue ok={answers.pillars.length > 0} onClick={() => nextFrom("pillars")} />
      </div>
    );
  } else if (step === "level") {
    body = (
      <div className="flex flex-col gap-3">
        <Head title={they("Which best describes your athlete?", "Which best describes you?")} />
        <div className="flex flex-col gap-2" role="radiogroup">
          {LEVELS.map(({ id, title, detail, Icon }) => (
            <Tile
              key={id}
              on={answers.level === id}
              title={title}
              detail={detail}
              icon={<Icon className="size-5" strokeWidth={1.5} />}
              onClick={() => {
                patch({ level: id });
                window.setTimeout(() => nextFrom("level"), 180);
              }}
            />
          ))}
        </div>
      </div>
    );
  } else if (step === "clevels") {
    body = (
      <div className="flex flex-col gap-3">
        <Head title="What levels do you coach?" sub="Pick all that apply." />
        <div className="flex flex-col gap-2">
          {LEVELS.map(({ id, title, detail, Icon }) => (
            <Tile
              key={id}
              multi
              on={answers.clevels.includes(id)}
              title={title}
              detail={detail}
              icon={<Icon className="size-5" strokeWidth={1.5} />}
              onClick={() =>
                patch({
                  clevels: answers.clevels.includes(id)
                    ? answers.clevels.filter((x) => x !== id)
                    : [...answers.clevels, id],
                })
              }
            />
          ))}
        </div>
        <Continue ok={answers.clevels.length > 0} onClick={() => nextFrom("clevels")} />
      </div>
    );
  } else if (step === "age") {
    body = (
      <div className="flex flex-col gap-3">
        <Head title={they("How old is your athlete?", "How old are you?")} sub="We use it to match age groups." />
        <div className="grid grid-cols-3 gap-2">
          {AGE_TILES.map(([v, t]) => (
            <button
              key={v}
              type="button"
              className={cn(
                "rounded-[10px] border px-2 py-3 text-center text-[14px] font-medium transition-colors",
                answers.age === v ? "border-[#6698D2] bg-[#E5EDF7] text-[#0054B4]" : "border-[#EAEADF] bg-[#F9F9F5] text-[#1A202C] hover:border-[#6698D2]"
              )}
              onClick={() => {
                const who = answers.who;
                patch({ age: v });
                const years = ageYearsFromTile(v);
                window.setTimeout(() => {
                  if (who === "self" && years !== null && years < 18) go("invite");
                  else go("where");
                }, 180);
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    );
  } else if (step === "where") {
    body = (
      <div className="flex flex-col gap-3">
        <Head title={they("Where does your athlete train?", "Where do you train?")} sub="We'll show coaches near you first." />
        <Field text="ZIP code" error={errors.zip}>
          <input
            className={input}
            inputMode="numeric"
            maxLength={5}
            placeholder="78704"
            value={answers.zip}
            onChange={(e) => patch({ zip: e.target.value.replace(/\D/g, "").slice(0, 5) })}
            autoFocus
          />
        </Field>
        <button
          type="button"
          role="switch"
          aria-checked={answers.video}
          className={tileClass(answers.video)}
          onClick={() => patch({ video: !answers.video })}
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[14px] font-medium">Remote sessions work too</span>
            <span className={meta}>Sessions over video, with coaches from anywhere</span>
          </span>
          <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", answers.video ? "bg-[#0054B4]" : "bg-[#C1C1B8]")}>
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-transform", answers.video ? "left-4" : "left-0.5")} />
          </span>
        </button>
        <Continue ok={/^\d{5}$/.test(answers.zip)} onClick={() => nextFrom("where")} />
      </div>
    );
  } else if (step === "cwhere") {
    body = (
      <div className="flex flex-col gap-3">
        <Head title="Where and how do you coach?" sub="Families near you see you first." />
        <Field text="ZIP code">
          <input
            className={input}
            inputMode="numeric"
            maxLength={5}
            placeholder="78704"
            value={answers.zip}
            onChange={(e) => patch({ zip: e.target.value.replace(/\D/g, "").slice(0, 5) })}
            autoFocus
          />
        </Field>
        <div className="flex flex-col gap-2">
          <span className={label}>Sessions you offer. Pick all that apply.</span>
          <Tile
            multi
            on={answers.ctypes.includes("1-on-1")}
            title="1-on-1"
            detail="One athlete at a time"
            icon={<User className="size-5" strokeWidth={1.5} />}
            onClick={() =>
              patch({
                ctypes: answers.ctypes.includes("1-on-1")
                  ? answers.ctypes.filter((x) => x !== "1-on-1")
                  : [...answers.ctypes, "1-on-1"],
              })
            }
          />
          <Tile
            multi
            on={answers.ctypes.includes("Group")}
            title="Group"
            detail="Small groups and clinics"
            icon={<Users className="size-5" strokeWidth={1.5} />}
            onClick={() =>
              patch({
                ctypes: answers.ctypes.includes("Group")
                  ? answers.ctypes.filter((x) => x !== "Group")
                  : [...answers.ctypes, "Group"],
              })
            }
          />
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={answers.video}
          className={tileClass(answers.video)}
          onClick={() => patch({ video: !answers.video })}
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[14px] font-medium">Remote sessions</span>
            <span className={meta}>Coach over video, from anywhere</span>
          </span>
          <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", answers.video ? "bg-[#0054B4]" : "bg-[#C1C1B8]")}>
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-transform", answers.video ? "left-4" : "left-0.5")} />
          </span>
        </button>
        <Continue ok={/^\d{5}$/.test(answers.zip) && answers.ctypes.length > 0} onClick={() => nextFrom("cwhere")} />
      </div>
    );
  } else if (step === "account") {
    const googleMode = Boolean(user || answers.google);
    body = (
      <div className="flex flex-col gap-3">
        <Head
          title={googleMode ? "Almost done" : isCoach ? "Create your coach account" : "Save your matches"}
          sub={
            googleMode
              ? "A couple of details Google doesn't share with us."
              : isCoach
                ? "Free to set up. Your profile stays private until you go live."
                : isParent
                  ? "You'll manage the account and get every message."
                  : "Create your account to see your coaches."
          }
        />
        {!isCoach && !googleMode && summaryPills.length ? (
          <div className="flex flex-wrap gap-1.5">
            {summaryPills.map((p) => (
              <span key={p} className="rounded-full bg-[#E5EDF7] px-2.5 py-1 text-[12px] font-medium text-[#0054B4]">
                {p}
              </span>
            ))}
          </div>
        ) : null}
        {!googleMode ? (
          <>
            <button type="button" className={cn(secondaryButton, "h-[40px] w-full gap-2")} disabled={busy} onClick={startGoogle}>
              <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[#EAEADF]" />
              </div>
              <div className="relative flex justify-center text-[12px]">
                <span className="bg-card px-2 text-[#767980]">or use your email</span>
              </div>
            </div>
          </>
        ) : null}
        {isParent ? (
          <Field text="Your athlete's first name" error={errors.ath}>
            <input className={input} value={answers.ath} onChange={(e) => patch({ ath: e.target.value })} placeholder="Ava" />
          </Field>
        ) : null}
        {!googleMode ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field text={isParent ? "Your first name" : "First name"} error={errors.first}>
                <input className={input} value={answers.first} onChange={(e) => patch({ first: e.target.value })} autoComplete="given-name" />
              </Field>
              <Field text={isParent ? "Your last name" : "Last name"} error={errors.last}>
                <input className={input} value={answers.last} onChange={(e) => patch({ last: e.target.value })} autoComplete="family-name" />
              </Field>
            </div>
            <Field text="Email" error={errors.email}>
              <input className={input} type="email" value={answers.email} onChange={(e) => patch({ email: e.target.value })} autoComplete="email" />
            </Field>
          </>
        ) : null}
        <Field text="Mobile number" error={errors.phone}>
          <PhoneInput value={answers.phone} onChange={(v) => patch({ phone: v })} />
          <span className={meta}>{isCoach ? "For booking alerts." : "Coaches use it to reach you about sessions."} Never shown publicly.</span>
        </Field>
        {!googleMode ? (
          <Field text="Password" error={errors.password}>
            <div className="relative">
              <input
                className={cn(input, "pr-10")}
                type={showPassword ? "text" : "password"}
                value={answers.pw}
                onChange={(e) => patch({ pw: e.target.value })}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-2 flex items-center rounded-[4px] text-[#767980] hover:text-[#1A202C]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
              </button>
            </div>
            {answers.pw ? <PasswordRequirements items={passwordItems} /> : <span className={meta}>8 or more characters with a number and a symbol</span>}
          </Field>
        ) : null}
        <label className="flex items-start gap-2 text-[13px] text-[#484D56]">
          <input
            type="checkbox"
            className="mt-[3px]"
            checked={answers.terms}
            onChange={(e) => patch({ terms: e.target.checked })}
          />
          <span>
            I agree to the <LegalAnchor kind="terms" className="text-[#0054B4]" /> and the{" "}
            <LegalAnchor kind="privacy" className="text-[#0054B4]" />
            {isParent ? ", on behalf of my athlete too" : ""}
          </span>
        </label>
        {errors.terms ? <span className="text-[12px] text-[#972B2B]">{errors.terms}</span> : null}
        <button
          type="button"
          className={signupCta}
          disabled={!answers.terms || busy}
          onClick={createAccount}
        >
          {busy ? "Working…" : "Complete signup"}
          <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
        </button>
        {!googleMode ? (
          <button type="button" className={cn(textButton, "self-center")} onClick={back}>
            Back
          </button>
        ) : null}
      </div>
    );
  } else if (step === "verify") {
    body = (
      <div className="flex flex-col gap-3">
        <Head title="Check your email" sub={`We sent a 6-digit code to ${answers.email.trim().toLowerCase()}.`} />
        <Field text="Verification code" error={errors.code}>
          <input
            className={cn(input, "tracking-[0.3em]")}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={answers.code}
            onChange={(e) => patch({ code: e.target.value.replace(/\D/g, "") })}
            autoFocus
          />
        </Field>
        <Continue ok={/^\d{6}$/.test(answers.code.trim())} onClick={submitCode} label={busy ? "Checking…" : "Verify email"} />
        <button type="button" className={cn(textButton, "self-center")} onClick={resend}>
          Resend code
        </button>
      </div>
    );
  } else if (step === "matches") {
    const nm = isParent ? answers.ath || "your athlete" : "you";
    const pos = answers.pos || "your position";
    body = (
      <div className="flex flex-col gap-3">
        {matches.length ? (
          <>
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-[40px] font-semibold leading-none tracking-[-0.05em] text-[#0054B4]">{matchTotal || matches.length}</span>
              <h2 className="text-[20px] font-semibold tracking-[-0.03em]">
                {(matchTotal || matches.length) === 1 ? "coach fits" : "coaches fit"} {nm}
              </h2>
              <p className={meta}>
                Matched on {pos.toLowerCase()}
                {answers.level ? `, ${(answers.level || "").toLowerCase()}` : ""}
                {answers.pillars.length ? ` and ${answers.pillars.length === 1 ? "1 goal" : `${answers.pillars.length} goals`}` : ""}
                {answers.zip ? `, near ${answers.zip}` : ""}.
              </p>
            </div>
            <div className="flex flex-col gap-2.5">
              {matches.map((c) => (
                <div key={c.id} className="flex gap-3 rounded-[10px] border border-[#EAEADF] bg-[#F9F9F5] p-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#E5EDF7] text-[14px] font-semibold text-[#0054B4]">
                    {initials(c.name)}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[14px] font-medium">{c.name}</span>
                      {c.rating != null ? (
                        <span className={cn(meta, "inline-flex items-center gap-1")}>
                          <Star className="size-3" strokeWidth={1.5} aria-hidden="true" />
                          {Number(c.rating).toFixed(1)}
                        </span>
                      ) : null}
                    </div>
                    <span className={meta}>{(c.specialties ?? []).slice(0, 2).join(" · ") || c.position || "Coach"}</span>
                    <div className="flex flex-wrap gap-1">
                      {(c.specialties ?? []).slice(0, 2).map((p) => (
                        <span key={p} className="rounded-full bg-[#E5EDF7] px-2 py-0.5 text-[11px] font-medium text-[#0054B4]">
                          {p}
                        </span>
                      ))}
                      <span className="rounded-full bg-[#EAEADF] px-2 py-0.5 text-[11px] font-medium text-[#484D56]">
                        {(c.session_types ?? []).some((t) => /virtual|video/i.test(t)) ? "Video call" : (c.locations?.[0] ?? "Nearby")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(meta, "inline-flex items-center gap-1 text-[#0054B4]")}>
                        <Check className="size-3" strokeWidth={2} aria-hidden="true" />
                        {(c.positions?.length ?? 0) > 1 ? "Coaches every position" : `${c.position || pos} specialist`}
                      </span>
                      <span className="text-[14px] font-medium whitespace-nowrap">From ${c.hourly_rate ?? 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Continue ok onClick={leaveToApp} label={`See all ${matchTotal || matches.length} coaches`} />
          </>
        ) : (
          <>
            <Head
              title={answers.sport === "Rowing" ? "Rowing coaches are on the way" : "Finding coaches near you"}
              sub={
                answers.sport === "Rowing"
                  ? `We're adding rowing coaches near ${answers.zip || "you"}. We'll email you as soon as one fits ${nm}.`
                  : "Browse the directory to pick your first coach."
              }
            />
            <Continue ok onClick={leaveToApp} label="Browse coaches" />
          </>
        )}
      </div>
    );
  } else if (step === "cprofile") {
    const nm = `${answers.first || "Your"} ${answers.last || "name"}`.trim();
    const cp = answers.cpos.length ? answers.cpos : ["Field players"];
    const spec =
      answers.sport === "Rowing"
        ? cp.length > 1
          ? "Rowers and coxswains"
          : cp[0]
        : `${cp.map((x) => x.replace(/s$/, "").toLowerCase()).join(" and ").replace(/^./, (c) => c.toUpperCase())} coach`;
    const types = [
      ...answers.ctypes.map((x) => (x === "Group" ? "Group sessions" : "1-on-1 sessions")),
      ...(answers.video ? ["Remote sessions"] : []),
    ];
    // No background-check or admin-review rows — is_verified stays plumbing-only.
    const setup = [
      ["Account created", true],
      ["Add a photo and a short bio", false],
      ["Set your session prices", false],
      ["Set your weekly availability", false],
      ["Go live", false],
    ] as const;

    body = (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col items-center gap-1 text-center">
          <h2 className="text-[20px] font-semibold tracking-[-0.03em]">Your profile is started</h2>
          <p className={meta}>This is how families will see you once you go live.</p>
        </div>
        <div className="flex flex-col gap-3 rounded-[10px] border border-[#EAEADF] bg-[#F9F9F5] p-3">
          <div className="flex gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#E5EDF7] text-[14px] font-semibold text-[#0054B4]">
              {initials(nm)}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[14px] font-medium">{nm}</span>
                <span className="rounded-full bg-[#EAEADF] px-2 py-0.5 text-[11px] font-medium text-[#484D56]">Draft, only you can see this</span>
              </div>
              <span className={meta}>
                {answers.sport || "Soccer"} · {spec}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {answers.pillars.map((p) => (
              <span key={p} className="rounded-full bg-[#E5EDF7] px-2 py-0.5 text-[11px] font-medium text-[#0054B4]">
                {p}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {types.map((t) => (
              <span key={t} className="rounded-full bg-[#D8EEE4] px-2 py-0.5 text-[11px] font-medium text-[#0F6B4C]">
                {t}
              </span>
            ))}
            {answers.clevels.map((l) => (
              <span key={l} className="rounded-full bg-[#EAEADF] px-2 py-0.5 text-[11px] font-medium text-[#484D56]">
                {l}
              </span>
            ))}
          </div>
          {answers.zip ? (
            <span className={cn(meta, "inline-flex items-center gap-1")}>
              <MapPin className="size-3" strokeWidth={1.5} aria-hidden="true" />
              Based in {answers.zip}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <span className={label}>Before families can book you</span>
          {setup.map(([t, done], k) => (
            <div key={t} className="flex items-center gap-3 rounded-[8px] bg-[#F9F9F5] px-3 py-2.5">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  done ? "bg-[#0054B4] text-white" : "border border-[#C1C1B8] text-[#767980]"
                )}
              >
                {done ? <Check className="size-3" strokeWidth={2.5} /> : k + 1}
              </span>
              <span className="text-[14px]">{t}</span>
            </div>
          ))}
        </div>
        <Continue ok onClick={leaveToApp} label="Finish my profile" />
        <p className={cn(meta, "text-center")}>No charge until you go live.</p>
      </div>
    );
  } else if (step === "invite") {
    body = (
      <div className="flex flex-col gap-3">
        <Head
          title="Last step: add a parent"
          sub="Athletes under 18 join through a parent or guardian. We'll email them a link to finish setting up your account and see your matches."
        />
        {summaryPills.length ? (
          <div className="flex flex-wrap gap-1.5">
            {summaryPills.map((p) => (
              <span key={p} className="rounded-full bg-[#E5EDF7] px-2.5 py-1 text-[12px] font-medium text-[#0054B4]">
                {p}
              </span>
            ))}
          </div>
        ) : null}
        <Field text="Parent or guardian's email" error={errors.pemail}>
          <input
            className={input}
            type="email"
            placeholder="parent@email.com"
            value={answers.pemail}
            onChange={(e) => patch({ pemail: e.target.value })}
            autoFocus
          />
        </Field>
        <p className="flex items-start gap-2 rounded-[8px] bg-[#E5EDF7] px-3 py-2.5 text-[13px] leading-[18px] text-[#00326C]">
          <ShieldCheck className="mt-[1px] size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          Your answers are saved. Your parent becomes the account holder and checks them before any booking.
        </p>
        <Continue
          ok={/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.pemail.trim())}
          onClick={sendParentEmail}
          label={busy ? "Sending…" : "Send to my parent"}
        />
        <button
          type="button"
          className={cn(textButton, "self-center")}
          onClick={() => {
            patch({ who: "parent", age: null });
            go("age");
          }}
        >
          I'm actually the parent
        </button>
      </div>
    );
  } else if (step === "sent") {
    body = (
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-[#E5EDF7] text-[#0054B4]">
          <Mail className="size-7" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <Head title="We emailed your parent" sub={`${answers.pemail} has a link to finish your account. Your matches will be waiting.`} />
        <Link to={`${ROUTES.AUTH}?mode=signin`} className={cn(secondaryButton, "h-[40px] w-full")}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-start">
        <LogoHome />
      </div>
      <Progress />
      {body}
    </div>
  );
};
