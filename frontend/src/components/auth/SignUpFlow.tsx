/**
 * Sign up (WC4, then the Oct 31 "signup flows: today vs proposed" board): one question per
 * screen with big tiles and a clickable progress bar.
 * Direct: coach / athlete 18+ / parent → questions → account (Google, or email and password) →
 * 6-digit email code last → families add an optional profile and see matches, coaches see a
 * draft profile. Athletes under 18 email a parent instead.
 * Camp families (after the camp form): password and code only, then a few questions built
 * around the camp, then the optional profile. Nothing the camp form asked is asked again.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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
} from "@/components/icons";
import { authAPI } from "@/api/auth";
import { inviteSignupAPI, type InviteSignupInfo } from "@/api/inviteSignup";
import { coachesAPI, userProfilesAPI, type PublicCoach } from "@/api";
import { createAthleteInitiatedReferral } from "@/api/referrals";
import { REFERRAL_KEYS } from "@/hooks/useReferrals";
import { sendPublicEmail } from "@/api/publicEmail";
import { getSportPillars, setSportPillars } from "@/api/sport-pillars";
import { pickedPillarIds } from "@/utils/sessionPillars";
import { usePillarTitles } from "@/hooks/usePillarTitles";
import logo from "@/assets/AthaNext-Logo.svg";
import { PhoneInput } from "@/components/common/PhoneInput";
import { LegalAnchor } from "@/components/legal/LegalLinks";
import { PasswordRequirements } from "@/components/password/PasswordRequirements";
import { getPrivacyPolicyContent } from "@/api/privacy-policy";
import { getTermsAndConditionsContent } from "@/api/terms";
import { input, label, meta, textButton } from "@/components/schedule/styles";
import { buttonVariants } from "@/components/ui/button";
import { BrandPill } from "@/components/brand";
import { useAuth } from "@/contexts/AuthContext";
import { usePasswordValidation } from "@/hooks/usePasswordValidation";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { isValidE164, normalizeStoredPhone } from "@/utils/phone";
import { parentInviteEmailRequest } from "@/utils/publicEmail";
import { clearJoinCoach } from "@/utils/referralHelpers";
import { clearCampFinish, readCampFinish } from "@/components/camps/campFinish";
import { EditPhotoButton } from "@/components/home/EditPhotoButton";
import { buildOAuthRedirectPath } from "@/utils/authRedirect";
import { takeReturnPath } from "@/utils/returnPath";
import { trackAccountCreated, trackSignupStarted } from "@/analytics/events";
import {
  COACH_POS_TO_DB,
  LEVEL_TO_PATHWAY,
  SESSION_FORMATS,
  SESSION_LOCATIONS,
  ageFromDob,
  clearSignupSession,
  dobBounds,
  dobFromAgeTile,
  emptySignupAnswers,
  formatToDb,
  gradYearOptions,
  locationToCoachSessionType,
  locationToDb,
  validDob,
  initialSignupStep,
  prefillFromUser,
  readSignupAnswers,
  readSignupInvite,
  roleFromWho,
  writeSignupInvite,
  writeSignupAnswers,
  writeSignupRole,
  type SignupAnswers,
  type SignupWho,
} from "@/utils/signup";

/** Primary CTA: full-width large primary button. */
const signupCta = cn(buttonVariants({ variant: "default", size: "lg" }), "w-full");
const wideSecondary = cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full");

/** Records the Terms and Privacy versions live in the database when the box was ticked. */
const legalAcceptanceFields = async () => {
  const [termsRes, privacyRes] = await Promise.all([getTermsAndConditionsContent(), getPrivacyPolicyContent()]);
  const acceptedAt = new Date().toISOString();
  return {
    terms_version: termsRes.data?.version ?? null,
    terms_accepted_at: acceptedAt,
    privacy_version: privacyRes.data?.version ?? null,
    privacy_accepted_at: acceptedAt,
  };
};

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

/**
 * Imported and half-finished accounts can already have a coach row. Reuse the one the profile
 * links to, or an unclaimed row with the same email, instead of inserting a duplicate.
 */
const findExistingCoachId = async (linked: string | null | undefined, email: string | null | undefined, userId: string) => {
  if (linked) return linked;
  if (!email) return null;
  const { data: coach } = await supabase
    .from("coaches")
    .select("id")
    .ilike("email", escapeLike(email.trim()))
    .limit(1)
    .maybeSingle();
  if (!coach) return null;
  const { data: owner } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("coach_id", coach.id)
    .neq("id", userId)
    .limit(1)
    .maybeSingle();
  return owner ? null : coach.id;
};

/** Same for athletes: the linked athlete row, else the first one this account created. */
const findExistingAthleteId = async (linked: string | null | undefined, userId: string) => {
  if (linked) return linked;
  const { data } = await supabase
    .from("athlete_profiles")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
};

type StepId =
  | "who"
  | "sport"
  | "pillars"
  | "level"
  | "clevels"
  | "dob"
  | "where"
  | "cwhere"
  | "account"
  | "verify"
  | "password"
  | "matches"
  | "cprofile"
  | "invite"
  | "sent"
  | "extras";

const FAMILY_FLOW: StepId[] = ["who", "sport", "pillars", "level", "dob", "where", "account"];
const COACH_FLOW: StepId[] = ["who", "sport", "pillars", "clevels", "cwhere", "account"];
/** Camp families: the account comes first (the camp form had their details), then these. */
const CAMP_FLOW: StepId[] = ["sport", "pillars", "level", "where"];
/** Families a coach invited: account first (the invite proves the email), then these. */
const INVITE_FLOW: StepId[] = ["sport", "pillars", "level", "dob", "where"];
const OFF_FLOW: StepId[] = ["verify", "password", "matches", "cprofile", "invite", "sent", "extras"];

const LEVELS: { id: string; title: string; detail: string; Icon: typeof User }[] = [
  { id: "Recreational", title: "Recreational", detail: "Any age, playing for fun and fitness", Icon: User },
  { id: "Youth development", title: "Youth development", detail: "Under 13, building the fundamentals", Icon: Sprout },
  { id: "Elite pathway", title: "Elite pathway", detail: "13 to 18, aiming to play in college or pro", Icon: Medal },
  { id: "College or pro", title: "College or pro", detail: "18 and over, playing at a high level", Icon: GraduationCap },
];

const PILLAR_ICONS: Record<string, typeof User> = {
  "On-field training": Flag,
  "Video analysis": Video,
  Mentorship: MessageCircle,
  "Performance coaching": Dumbbell,
  "Academic tutoring": BookOpen,
  "College recruiting": GraduationCap,
  "Technical development": Zap,
  "Race preparation": Flag,
};

const pillarIcon = (title: string) =>
  PILLAR_ICONS[Object.keys(PILLAR_ICONS).find((k) => k.toLowerCase() === title.toLowerCase()) ?? ""] ?? Zap;

const tileClass = (on: boolean) =>
  cn(
    "relative flex w-full items-start gap-3 rounded-control border px-3.5 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    on ? "border-primary bg-primary-50" : "border-light-525 bg-light-300 hover:bg-light-200"
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
    {error ? <span className="text-caption text-error-700">{error}</span> : null}
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
      <span className="flex size-10 shrink-0 items-center justify-center rounded-control border border-primary-300 bg-primary-50 text-primary">
        {icon}
      </span>
    ) : null}
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-label-sm text-dark">{title}</span>
      {detail ? <span className={meta}>{detail}</span> : null}
    </span>
    <span
      className={cn(
        "mt-0.5 ml-auto flex size-5 shrink-0 items-center justify-center rounded-full border",
        on ? "border-primary bg-primary text-light" : "border-light-600 text-transparent"
      )}
      aria-hidden="true"
    >
      <Check className="size-3" strokeWidth={2.5} />
    </span>
  </button>
);

/** Session type, the same for families and coaches: format (1-on-1, group) and where (in person, online). */
const SessionChoices = ({
  answers,
  patch,
  coach,
}: {
  answers: SignupAnswers;
  patch: (partial: Partial<SignupAnswers>) => void;
  coach: boolean;
}) => {
  const toggle = (key: "formats" | "locations", value: string) =>
    patch({ [key]: answers[key].includes(value) ? answers[key].filter((x) => x !== value) : [...answers[key], value] });
  const formatCopy: Record<string, { title: string; detail: string; Icon: typeof User }> = {
    Individual: { title: "1-on-1", detail: coach ? "One athlete at a time" : "Just the athlete and the coach", Icon: User },
    Group: { title: "Group", detail: coach ? "Small groups and clinics" : "Train with other athletes", Icon: Users },
  };
  const locationCopy: Record<string, { title: string; detail: string; Icon: typeof User }> = {
    "In person": { title: "In person", detail: coach ? "At your field or facility" : "At a field near you", Icon: MapPin },
    Online: { title: "Online", detail: coach ? "Coach over video, from anywhere" : "Over video, with coaches from anywhere", Icon: Video },
  };
  return (
    <>
      <div className="flex flex-col gap-2">
        <span className={label}>{coach ? "Sessions you offer. Pick all that apply." : "What kind of sessions? Pick all that apply."}</span>
        {SESSION_FORMATS.map((f) => {
          const { title, detail, Icon } = formatCopy[f]!;
          return (
            <Tile key={f} multi on={answers.formats.includes(f)} title={title} detail={detail} icon={<Icon className="size-5" strokeWidth={1.5} />} onClick={() => toggle("formats", f)} />
          );
        })}
      </div>
      <div className="flex flex-col gap-2">
        <span className={label}>{coach ? "Where you coach" : "Where"}</span>
        {SESSION_LOCATIONS.map((l) => {
          const { title, detail, Icon } = locationCopy[l]!;
          return (
            <Tile key={l} multi on={answers.locations.includes(l)} title={title} detail={detail} icon={<Icon className="size-5" strokeWidth={1.5} />} onClick={() => toggle("locations", l)} />
          );
        })}
      </div>
    </>
  );
};

/**
 * The last step for families, skippable: photo, club team, grad year, season goal and highlight
 * video. All of it can be added later from Home.
 */
const OptionalProfile = ({
  athleteId,
  isParent,
  athleteWord,
  onDone,
}: {
  athleteId: string | null;
  isParent: boolean;
  athleteWord: string;
  onDone: () => Promise<void> | void;
}) => {
  const { toast } = useToast();
  const [team, setTeam] = useState("");
  const [grad, setGrad] = useState("");
  const [goal, setGoal] = useState("");
  const [video, setVideo] = useState("");
  const [busy, setBusy] = useState(false);
  const videoOk = !video.trim() || /^https?:\/\/\S+\.\S+/i.test(video.trim());
  const anything = Boolean(team.trim() || grad || goal.trim() || video.trim());

  const save = async () => {
    if (!athleteId || !anything) return onDone();
    setBusy(true);
    const { error } = await supabase
      .from("athlete_profiles")
      .update({
        ...(team.trim() ? { high_school: team.trim() } : {}),
        ...(grad ? { graduation_year: grad } : {}),
        ...(goal.trim() ? { season_goal: goal.trim() } : {}),
        ...(video.trim() ? { highlight_video_url: video.trim() } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", athleteId);
    setBusy(false);
    if (error) {
      toast({ title: "Couldn't save these", description: "You can add them later from Home.", variant: "destructive" });
      return;
    }
    await onDone();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-card-title text-dark">{isParent ? `A bit more about ${athleteWord}` : "A bit more about you"}</h2>
        <p className={meta}>Optional. Coaches see this when you book. You can add it anytime from Home.</p>
      </div>
      {athleteId ? (
        <div className="flex items-center justify-between gap-3 rounded-control border border-light-525 bg-light-200 px-3 py-2.5">
          <span className="text-label-sm">Profile photo</span>
          <EditPhotoButton athleteId={athleteId} photo={null} isParent={isParent}>
            Add a photo
          </EditPhotoButton>
        </div>
      ) : null}
      <Field text="Club or team">
        <input className={input} value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Austin FC Academy" />
      </Field>
      <Field text="Graduation year">
        <select className={input} value={grad} onChange={(e) => setGrad(e.target.value)}>
          <option value="">Pick a year</option>
          {gradYearOptions().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </Field>
      <Field text="Season goal">
        <input className={input} value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={200} placeholder="Start for the varsity team" />
      </Field>
      <Field text="Highlight video" error={videoOk ? undefined : "Paste the full link"}>
        <input className={input} value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://youtube.com/…" inputMode="url" />
      </Field>
      <button type="button" className={signupCta} disabled={busy || !videoOk} onClick={() => void save()}>
        {busy ? "Saving…" : anything ? "Save and continue" : "Continue"}
        <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
      </button>
      {anything ? (
        <button type="button" className={cn(textButton, "self-center")} disabled={busy} onClick={() => void onDone()}>
          Skip for now
        </button>
      ) : null}
    </div>
  );
};

/**
 * A camp family finishing their account (/auth?mode=signup&email=…&camp_signup=…): they signed up
 * as a parent with their details already, so the flow opens on the account step with them filled in.
 */
export type CampFinishParams = { signupId: string; email: string | null };

const campAnswers = (base: SignupAnswers, camp: CampFinishParams): SignupAnswers => {
  const known = readCampFinish(camp.signupId);
  const [first = "", ...rest] = (known?.parentName ?? "").split(/\s+/).filter(Boolean);
  const campPillars = known?.campPillars ?? [];
  return {
    ...base,
    who: "parent",
    sport: base.sport ?? "Soccer",
    email: camp.email || known?.email || base.email,
    first: base.first || first,
    last: base.last || rest.join(" "),
    phone: base.phone || normalizeStoredPhone(known?.phone),
    ath: base.ath || known?.athleteFirst || "",
    // The camp's pillars start ticked; the camp form already took the terms.
    pillars: Array.from(new Set([...campPillars, ...base.pillars])),
    terms: true,
  };
};

export const SignUpFlow = ({
  inviteToken,
  joinCoachId,
  onSaving,
  camp = null,
  personaWho = null,
}: {
  inviteToken: string | null;
  joinCoachId: string | null;
  /** Called before the account is verified or saved, so Auth doesn't navigate away mid-save. */
  onSaving?: () => void;
  camp?: CampFinishParams | null;
  /** From ?persona= on Become a coach / invite links; seeds the "who" step when unset. */
  personaWho?: SignupWho | null;
}) => {
  const { user, refreshUserProfile, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // A signed-in account that isn't finished (Google from either tab, an imported user) lands
  // here too. Saved answers skip to the account step; otherwise the questions start with the
  // name and email filled in. ?persona=coach (etc.) pre-selects who when nothing is saved yet.
  const [answers, setAnswers] = useState<SignupAnswers>(() => {
    const saved = readSignupAnswers() ?? emptySignupAnswers();
    const withPersona =
      !saved.who && personaWho ? { ...saved, who: personaWho } : saved;
    const base = camp ? campAnswers(withPersona, camp) : withPersona;
    return user ? prefillFromUser(base, user) : base;
  });
  // Opened from a coach's invite: the account comes first, prefilled from the invite. Back from
  // Google the account exists, so the flag in this tab keeps the invite's questions coming.
  const startsInInviteFlow =
    Boolean(inviteToken) && !camp && (!user || readSignupInvite() === inviteToken);
  const [inviteFlow, setInviteFlow] = useState(startsInInviteFlow);
  const [inviteInfo, setInviteInfo] = useState<InviteSignupInfo | null>(null);
  const [step, setStep] = useState<StepId>(() => {
    if (camp) return "account";
    if (startsInInviteFlow) return "account";
    const saved = readSignupAnswers();
    const who = saved?.who ?? personaWho;
    if (who && !saved?.who && personaWho) return "sport";
    return initialSignupStep(Boolean(user), saved ?? (personaWho ? { who: personaWho } : null));
  });
  const prefilledFor = useRef<string | null>(user?.id ?? null);
  const trackedStart = useRef(false);
  // Titles from sport_pillars (built-in list offline), so a coach's picks link to those rows.
  const pillarTitles = usePillarTitles(answers.sport ?? "Soccer");
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

  const flow = camp ? CAMP_FLOW : inviteFlow ? INVITE_FLOW : isCoach ? COACH_FLOW : FAMILY_FLOW;
  const flowIndex = flow.indexOf(step);
  const offFlow = OFF_FLOW.includes(step);
  const questionCount = flow.length - 1;
  const questionIndex = flowIndex >= 0 ? flowIndex : 0;
  const ageYears = ageFromDob(answers.dob);
  const isMinorSelf = answers.who === "self" && ageYears !== null && ageYears < 18;

  useEffect(() => {
    writeSignupAnswers(answers);
  }, [answers]);

  useEffect(() => {
    if (trackedStart.current) return;
    trackedStart.current = true;
    trackSignupStarted({
      source: camp ? "camp" : inviteToken ? "invite" : joinCoachId ? "share_link" : "direct",
    });
  }, [camp, inviteToken, joinCoachId]);

  useEffect(() => {
    setErrors({});
  }, [step]);

  // Signed in after the flow opened (session restored, Google return): prefill once per account
  // and land on Almost done when the questions were already answered.
  useEffect(() => {
    if (!user || prefilledFor.current === user.id) return;
    prefilledFor.current = user.id;
    if (step !== "who") return;
    const stored = readSignupAnswers();
    setAnswers((cur) => prefillFromUser(stored ?? cur, user));
    if (stored?.who) setStep("account");
  }, [user, step]);

  const patch = (partial: Partial<SignupAnswers>) => setAnswers((cur) => ({ ...cur, ...partial }));

  // Where email confirmation and Google come back to: this flow, still in camp / invite mode.
  const returnPath = buildOAuthRedirectPath({
    signup: true,
    invite: inviteToken,
    coach: joinCoachId,
    campSignup: camp?.signupId ?? null,
    email: camp?.email ?? null,
  });
  const campDetails = camp ? readCampFinish(camp.signupId) : null;
  const campBirthYear = campDetails?.birthYear ?? null;
  const campPillars = campDetails?.campPillars ?? [];
  const athleteWord = answers.ath.trim() || "your athlete";
  const coachFirst = (campDetails?.coachName ?? inviteInfo?.coach_name ?? "").split(/\s+/)[0] || "the coach";
  // The invited email is already proven by the link; a different one gets the usual code.
  const invitedEmail = inviteFlow && inviteInfo !== null && answers.email.trim().toLowerCase() === inviteInfo.email;

  useEffect(() => {
    if (!inviteFlow || !inviteToken) return;
    let active = true;
    inviteSignupAPI
      .lookup(inviteToken)
      .then((info) => {
        if (!active) return;
        setInviteInfo(info);
        writeSignupInvite(inviteToken);
        const [first = "", ...rest] = info.parent_name.split(/\s+/).filter(Boolean);
        setAnswers((cur) => ({
          ...cur,
          who: info.athlete_first ? "parent" : "self",
          sport: cur.sport ?? info.sport ?? "Soccer",
          email: cur.email || info.email,
          first: cur.first || first,
          last: cur.last || rest.join(" "),
          ath: cur.ath || info.athlete_first,
        }));
      })
      .catch(() => {
        // An expired, used or leftover invite: the normal sign-up (questions first) instead.
        if (!active) return;
        writeSignupInvite(null);
        setInviteFlow(false);
        if (!user) setStep((cur) => (cur === "account" ? "who" : cur));
      });
    return () => {
      active = false;
    };
    // user is only read when the lookup fails; re-running on sign-in isn't needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteFlow, inviteToken]);
  // The athlete row the account owns, for the optional profile step.
  const [athleteId, setAthleteId] = useState<string | null>(null);

  const go = (id: StepId) => setStep(id);

  const nextFrom = (id: StepId) => {
    if (id === "who") return go("sport");
    if (id === "dob" && isMinorSelf) return go("invite");
    // Camp and invited families answer their questions after the account exists; then it's saved.
    if (id === "where" && (camp || inviteFlow)) return void finishProfile();
    const i = flow.indexOf(id);
    if (i >= 0 && i < flow.length - 1) go(flow[i + 1]!);
  };

  /** Once the email is confirmed (and a password set): camp families answer their questions next. */
  const afterVerified = async () => {
    if (camp || inviteFlow) return go("sport");
    await finishProfile();
  };

  const back = () => {
    if (step === "invite") return go("dob");
    if (step === "verify") return go("account");
    if (step === "password") return go("verify");
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
        formats: [],
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

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email.trim());
  const accountValid = () => {
    if (user || answers.google) {
      return camp ? true : isValidE164(answers.phone) && (!isParent || answers.ath.trim());
    }
    // Camp families gave everything but a password on the camp form.
    if (camp) return emailOk && passwordOk;
    return (
      answers.first.trim() &&
      answers.last.trim() &&
      emailOk &&
      passwordOk &&
      isValidE164(answers.phone) &&
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
        title: user || answers.google
          ? "Add your mobile number to finish"
          : !passwordOk
            ? "Choose a stronger password"
            : "Fill in every field to finish",
        variant: "destructive",
      });
      return;
    }

    writeSignupRole(roleFromWho(answers.who));

    // Google path: account already exists (or will after OAuth). Skip verify.
    if (user || answers.google) {
      // Confirmed the email last time but left before choosing a password: ask for it now.
      if (user?.user_metadata?.password_pending === true) {
        go("password");
        return;
      }
      await afterVerified();
      return;
    }

    // A coach's invite went to this email: create the account confirmed and sign straight in.
    if (invitedEmail && inviteToken) {
      setBusy(true);
      onSaving?.();
      try {
        await inviteSignupAPI.create(inviteToken, answers.pw, answers.phone);
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: answers.email.trim().toLowerCase(),
          password: answers.pw,
        });
        if (signInError) throw signInError;
        go("sport");
      } catch (err) {
        setErrors({ email: errorText(err, "Couldn't create the account. Try again.") });
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    const name = `${answers.first.trim()} ${answers.last.trim()}`.trim() || campDetails?.parentName || "";
    const persona = isCoach ? "coach" : isParent ? "parent" : "athlete";
    // The password is chosen here; the 6-digit code comes last and confirms the email.
    const { error } = await authAPI.signUp({
      email: answers.email.trim().toLowerCase(),
      password: answers.pw,
      name,
      metadata: { name, persona_type: persona, phone_number: answers.phone, password_pending: false },
      emailRedirectTo: `${window.location.origin}${returnPath}`,
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
      redirectTo: `${window.location.origin}${returnPath}`,
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
    onSaving?.();
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
    await afterVerified();
  };

  const setPassword = async () => {
    if (!passwordOk) {
      setErrors({ password: "Choose a stronger password" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: answers.pw, data: { password_pending: false } });
    setBusy(false);
    if (error) {
      setErrors({ password: error.message });
      return;
    }
    await afterVerified();
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
    const accountEmail = me.email ?? answers.email;

    onSaving?.();
    setBusy(true);
    try {
      // A partial profile (imported or earlier attempt) may already link a coach or athlete row.
      const { data: existing } = await userProfilesAPI.getUserProfile(me.id);

      if (isCoach) {
        const coachPositions = answers.cpos.map((p) => COACH_POS_TO_DB[p] ?? p);
        const pathway = answers.clevels.map((l) => LEVEL_TO_PATHWAY[l] ?? l).filter(Boolean);
        const sessionTypes = answers.locations.map(locationToCoachSessionType);
        const coachFields = {
          specialties: answers.pillars,
          locations: answers.zip ? [answers.zip] : [],
          position: coachPositions.join(", "),
          positions: coachPositions,
          favourite_positions: coachPositions,
          pathway_tags: pathway,
          session_types: sessionTypes,
          session_formats: answers.formats.map(formatToDb),
        };

        let coachId = await findExistingCoachId(existing?.coach_id, accountEmail, me.id);
        if (coachId) {
          if (!existing?.coach_id) {
            // Link first: a coach can only update the row their profile points at.
            const { error: linkError } = await userProfilesAPI.upsertUserProfile({
              id: me.id,
              email: accountEmail,
              name: existing?.name || accountName,
              coach_id: coachId,
            } as Parameters<typeof userProfilesAPI.upsertUserProfile>[0]);
            if (linkError) throw new Error(linkError.message);
          }
          // Keep the existing row's name, listing and status; only fill in the answers.
          const { error: updateError } = await coachesAPI.updateCoach(coachId, coachFields);
          if (updateError) throw new Error(updateError.message);
        } else {
          const { data: coach, error: coachError } = await coachesAPI.createCoach({
            name: accountName,
            email: accountEmail,
            ...coachFields,
            listed: false,
            status: "active",
            // Keep is_verified as DB default (false). No admin-review / Checkr gate in this flow.
            is_verified: false,
          });
          if (coachError || !coach) throw new Error(coachError?.message ?? "Couldn't create your coaching profile");
          coachId = coach.id;
        }

        try {
          const pillarsRes = await getSportPillars(sportKey);
          const ids = pickedPillarIds(pillarsRes.data?.sportPillars ?? [], answers.pillars);
          if (ids.length) await setSportPillars(coachId, sportKey, ids);
        } catch {
          // Pillars can be set later on the profile.
        }

        const legalAccept = await legalAcceptanceFields();
        const { error: profileError } = await userProfilesAPI.upsertUserProfile({
          id: me.id,
          email: accountEmail,
          name: accountName,
          persona_type: "coach",
          sport: sportKey,
          position: coachPositions.join(", "),
          phone_number: answers.phone,
          zip_code: answers.zip || null,
          coach_id: coachId,
          is_profile_completed: true,
          ...legalAccept,
        } as Parameters<typeof userProfilesAPI.upsertUserProfile>[0]);
        if (profileError) throw new Error(profileError.message);
        await supabase.auth.updateUser({ data: { persona_type: "coach", coach_id: coachId } });
        clearSignupSession();
        await refreshUserProfile();
        // The invite was read before this profile existed (is_athlete false); ask again.
        void queryClient.invalidateQueries({ queryKey: REFERRAL_KEYS.invite });
        trackAccountCreated({
          persona: "coach",
          source: camp ? "camp" : inviteToken ? "invite" : joinCoachId ? "share_link" : "direct",
        });
        go("cprofile");
      } else {
        const athFirst = isParent ? answers.ath.trim() : answers.first.trim();
        const athLast = isParent ? answers.last.trim() : answers.last.trim();
        // A camp family gave the birth year (the day is unknown); answers saved before the birth
        // date question carry an age instead.
        const dob = validDob(answers.dob)
          ? answers.dob
          : campBirthYear
            ? `${campBirthYear}-01-01`
            : dobFromAgeTile(answers.age);
        const pathway = answers.level ? [LEVEL_TO_PATHWAY[answers.level] ?? answers.level] : [];
        const athleteFields = {
          full_name: `${athFirst} ${athLast}`.trim(),
          date_of_birth: dob,
          sport: sportKey,
          position: answers.pos,
          tags: answers.pillars,
          pathway_tags: pathway,
          phone_number: answers.phone,
          session_formats: answers.formats.map(formatToDb),
          session_locations: answers.locations.map(locationToDb),
        };

        let athleteId = await findExistingAthleteId(existing?.athlete_id, me.id);
        if (athleteId) {
          const { data: updated, error: updateError } = await supabase
            .from("athlete_profiles")
            .update(athleteFields)
            .eq("id", athleteId)
            .select("id");
          if (updateError) throw updateError;
          // Not this account's row (or gone): create a fresh one below.
          if (!updated?.length) athleteId = null;
        }
        if (!athleteId) {
          const { data: athlete, error: athleteError } = await supabase
            .from("athlete_profiles")
            .insert({ user_id: me.id, ...athleteFields })
            .select("id")
            .single();
          if (athleteError) throw athleteError;
          athleteId = athlete.id;
        }

        const persona = isParent ? "parent" : "athlete";
        const legalAccept = await legalAcceptanceFields();
        const { error: profileError } = await userProfilesAPI.upsertUserProfile({
          id: me.id,
          email: accountEmail,
          name: isParent ? accountName : `${athFirst} ${athLast}`.trim(),
          persona_type: persona,
          sport: sportKey,
          position: answers.pos,
          date_of_birth: dob,
          phone_number: answers.phone,
          zip_code: answers.zip || null,
          athlete_id: athleteId,
          guardian_relationship: isParent ? "Parent" : null,
          is_profile_completed: true,
          ...legalAccept,
        } as Parameters<typeof userProfilesAPI.upsertUserProfile>[0]);
        if (profileError) throw new Error(profileError.message);
        await supabase.auth.updateUser({ data: { persona_type: persona, athlete_id: athleteId } });
        if (!inviteToken && joinCoachId) {
          await createAthleteInitiatedReferral(joinCoachId);
          clearJoinCoach();
        }
        // The camp is on their Home (AuthContext links the sign-up to the account). Families add
        // the optional profile next, then see matches (direct) or Home (camp).
        if (camp) clearCampFinish();
        clearSignupSession();
        await refreshUserProfile();
        // The invite was read before this profile existed (is_athlete false); ask again.
        void queryClient.invalidateQueries({ queryKey: REFERRAL_KEYS.invite });
        trackAccountCreated({
          persona,
          source: camp ? "camp" : inviteToken ? "invite" : joinCoachId ? "share_link" : "direct",
        });
        setAthleteId(athleteId);
        go("extras");
        toast({ title: "Your account is ready", description: camp ? "The camp is on your schedule." : undefined });
        return;
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
    try {
      // send-email writes the email (summary line and sign-up link) from these picks.
      await sendPublicEmail(
        parentInviteEmailRequest({
          email: answers.pemail,
          sport: answers.sport,
          pos: answers.pos,
          level: answers.level,
          pillars: answers.pillars,
          age: ageYears !== null ? String(ageYears) : answers.age,
          zip: answers.zip,
        })
      );
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
              "inline-flex size-8 items-center justify-center rounded-control text-dark hover:bg-light-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
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
                  <span className="absolute inset-x-0 top-[6px] h-1.5 rounded-pill bg-primary" />
                </button>
              ) : (
                <span key={k} className="relative h-[18px] flex-1" aria-hidden={k !== qi}>
                  <span
                    className={cn(
                      "absolute inset-x-0 top-[6px] h-1.5 rounded-pill",
                      k === qi ? "bg-primary" : "bg-light-550"
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
        <p className={cn(meta, "text-center font-medium text-primary")}>
          {step === "who"
            ? "Welcome to AthaNext"
            : camp
              ? `A few questions about ${athleteWord}`
              : isCoach
                ? "Set up your coaching profile"
                : "Find the right coach"}
        </p>
      </div>
    );
  };

  const Head = ({ title, sub }: { title: string; sub?: string }) => (
    <div className="flex flex-col gap-1">
      <h2 className="text-card-title text-dark">{title}</h2>
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
      return <span className="inline-flex items-center rounded-control px-2 py-1.5 -ml-2">{img}</span>;
    }
    return (
      <button
        type="button"
        className="inline-flex items-center rounded-control px-2 py-1.5 -ml-2 hover:bg-light-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
      ageYears !== null && isParent ? `Age ${ageYears}` : "",
    ].filter(Boolean) as string[];
    return bits;
  }, [answers, isCoach, isParent, ageYears]);

  // Screens
  let body: ReactNode = null;

  if (step === "who") {
    body = (
      <div className="flex flex-col gap-3">
        <Head title="Who's signing up?" />
        <Tile on={answers.who === "coach"} title="I'm a coach" detail="Run your coaching business on AthaNext" icon={<ClipboardList className="size-5" strokeWidth={1.5} />} onClick={() => pickWho("coach")} />
        <Tile on={answers.who === "self"} title="I'm an athlete" detail="18 or older" icon={<User className="size-5" strokeWidth={1.5} />} onClick={() => pickWho("self")} />
        <Tile on={answers.who === "parent"} title="I'm a parent or guardian" detail="Of an athlete under 18" icon={<Users className="size-5" strokeWidth={1.5} />} onClick={() => pickWho("parent")} />
        {user ? (
          <p className={cn(meta, "text-center")}>
            Signed in as {user.email}.{" "}
            <button type="button" className="font-medium text-primary hover:underline" onClick={() => void signOut()}>
              Use another account
            </button>
          </p>
        ) : (
          <p className={cn(meta, "text-center")}>
            Already have an account?{" "}
            <Link to={`${ROUTES.AUTH}?mode=signin`} className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        )}
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
        ? they(`Where does ${athleteWord} sit in the boat?`, "Where do you sit in the boat?")
        : they(`What position does ${athleteWord} play?`, "What position do you play?");

    body = (
      <div className="flex flex-col gap-3">
        <Head
          title={isCoach ? "Which sport do you coach?" : "Which sport?"}
          sub={camp ? `From ${campDetails?.campName ?? "the camp"}. Change it if it's not right.` : "Soccer and rowing are live now."}
        />
        <div className="flex flex-col gap-2" role="radiogroup">
          <Tile on={answers.sport === "Soccer"} title="Soccer" onClick={() => pickSport("Soccer")} />
          <Tile on={answers.sport === "Rowing"} title="Rowing" onClick={() => pickSport("Rowing")} />
        </div>
        <div className="flex items-center gap-3 rounded-control border border-dashed border-light-600 bg-light-400 px-3.5 py-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-control border border-light-525 bg-light text-dark-300">+</span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-label-sm">More sports</span>
            <span className={meta}>We're adding new sports to AthaNext</span>
          </span>
          <BrandPill tone="neutral">Coming soon</BrandPill>
        </div>
        {answers.sport ? (
          <div className="flex flex-col gap-2 border-t border-light-525 pt-3">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-subtitle text-dark">{posTitle}</h3>
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
    const list = pillarTitles.map((title) => ({ title, Icon: pillarIcon(title) }));
    // The camp's own pillars stay ticked: families only add what else they work on.
    const fromCamp = (title: string) => camp !== null && campPillars.some((p) => p.toLowerCase() === title.toLowerCase());
    body = (
      <div className="flex flex-col gap-3">
        <Head
          title={
            camp
              ? `Besides ${campDetails?.campName ?? "the camp"} with ${coachFirst}, what else does ${athleteWord} work on?`
              : inviteFlow
                ? they(`Besides training with ${coachFirst}, what else does ${athleteWord} work on?`, `Besides training with ${coachFirst}, what else do you work on?`)
                : they("What do you want your athlete to work on?", "What do you want to work on?", "Which pillars do you coach?")
          }
          sub={camp ? "The camp's focus is already ticked. Add anything else, or continue." : isCoach ? "Pick every pillar you offer sessions in." : "Pick as many as you like."}
        />
        <div className="flex flex-col gap-2">
          {list.map(({ title, Icon }) => (
            <Tile
              key={title}
              multi
              on={answers.pillars.includes(title) || fromCamp(title)}
              title={title}
              detail={fromCamp(title) ? "From the camp" : undefined}
              icon={<Icon className="size-5" strokeWidth={1.5} />}
              onClick={() => {
                if (fromCamp(title)) return;
                patch({
                  pillars: answers.pillars.includes(title)
                    ? answers.pillars.filter((x) => x !== title)
                    : [...answers.pillars, title],
                });
              }}
            />
          ))}
        </div>
        <Continue ok={camp !== null || inviteFlow || answers.pillars.length > 0} onClick={() => nextFrom("pillars")} />
      </div>
    );
  } else if (step === "level") {
    body = (
      <div className="flex flex-col gap-3">
        <Head title={they(`Which best describes ${athleteWord}?`, "Which best describes you?")} />
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
  } else if (step === "dob") {
    const { min, max } = dobBounds();
    const dobError = answers.dob && !validDob(answers.dob) ? "Enter a real birth date" : undefined;
    body = (
      <div className="flex flex-col gap-3">
        <Head title={they("When was your athlete born?", "When were you born?")} sub="We use it to match age groups." />
        <Field text="Birth date" error={dobError}>
          <input
            className={input}
            type="date"
            min={min}
            max={max}
            value={answers.dob}
            onChange={(e) => patch({ dob: e.target.value })}
            autoFocus
          />
        </Field>
        <Continue ok={validDob(answers.dob)} onClick={() => nextFrom("dob")} />
      </div>
    );
  } else if (step === "where") {
    body = (
      <div className="flex flex-col gap-3">
        <Head
          title={they(`Where and how does ${athleteWord} want to train?`, "Where and how do you want to train?")}
          sub="We'll show coaches near you first."
        />
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
        <SessionChoices answers={answers} patch={patch} coach={false} />
        <Continue
          ok={/^\d{5}$/.test(answers.zip) && answers.formats.length > 0 && answers.locations.length > 0}
          onClick={() => nextFrom("where")}
          label={camp && busy ? "Saving…" : "Continue"}
        />
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
        <SessionChoices answers={answers} patch={patch} coach />
        <Continue
          ok={/^\d{5}$/.test(answers.zip) && answers.formats.length > 0 && answers.locations.length > 0}
          onClick={() => nextFrom("cwhere")}
        />
      </div>
    );
  } else if (step === "account") {
    const googleMode = Boolean(user || answers.google);
    body = (
      <div className="flex flex-col gap-3">
        <Head
          title={camp ? "Secure your account" : inviteFlow && !googleMode ? "Create your account" : googleMode ? "Almost done" : isCoach ? "Create your coach account" : "Save your matches"}
          sub={
            camp
              ? googleMode
                ? "You're signed in. A few quick questions about your athlete next."
                : "We have your details from the camp sign-up. Choose a password, then enter the code we email you."
              : inviteFlow && !googleMode
                ? `${coachFirst === "the coach" ? "Your coach" : coachFirst} invited you. We filled in what they told us.`
              : googleMode
              ? "A couple of details Google doesn't share with us."
              : isCoach
                ? "Free to set up. Your profile stays private until you go live."
                : isParent
                  ? "You'll manage the account and get every message."
                  : "Create your account to see your coaches."
          }
        />
        {!camp && !isCoach && !googleMode && summaryPills.length ? (
          <div className="flex flex-wrap gap-1.5">
            {summaryPills.map((p) => (
              <BrandPill key={p} tone="blue">
                {p}
              </BrandPill>
            ))}
          </div>
        ) : null}
        {!googleMode ? (
          <>
            <button type="button" className={wideSecondary} disabled={busy} onClick={startGoogle}>
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
                <span className="w-full border-t border-light-525" />
              </div>
              <div className="relative flex justify-center text-caption">
                <span className="bg-card px-2 text-dark-300">or use your email</span>
              </div>
            </div>
          </>
        ) : null}
        {camp && !googleMode ? (
          <Field text="Email">
            <input className={cn(input, "bg-light-400 text-dark-300")} type="email" value={answers.email} readOnly aria-readonly="true" />
          </Field>
        ) : null}
        {isParent && !camp ? (
          <Field text="Your athlete's first name" error={errors.ath}>
            <input className={input} value={answers.ath} onChange={(e) => patch({ ath: e.target.value })} placeholder="Ava" />
          </Field>
        ) : null}
        {!googleMode && !camp ? (
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
              {invitedEmail ? (
                <span className={cn(meta, "inline-flex items-center gap-1 text-primary")}>
                  <Check className="size-3" strokeWidth={2} aria-hidden="true" />
                  Verified by your invite, no code needed
                </span>
              ) : null}
            </Field>
          </>
        ) : null}
        {!camp ? (
          <Field text="Mobile number" error={errors.phone}>
            <PhoneInput value={answers.phone} onChange={(v) => patch({ phone: v })} />
            <span className={meta}>{isCoach ? "For booking alerts." : "Coaches use it to reach you about sessions."} Never shown publicly.</span>
          </Field>
        ) : null}
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
                className="absolute inset-y-0 right-2 flex items-center rounded-control text-dark-300 hover:text-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
              </button>
            </div>
            {answers.pw ? <PasswordRequirements items={passwordItems} /> : <span className={meta}>8 or more characters with a number and a symbol</span>}
          </Field>
        ) : null}
        {!camp ? (
        <label className="flex items-start gap-2 text-body-m text-dark-300">
          <input
            type="checkbox"
            className="mt-[3px]"
            checked={answers.terms}
            onChange={(e) => patch({ terms: e.target.checked })}
          />
          <span>
            I agree to the <LegalAnchor kind="terms" className="text-primary" /> and the{" "}
            <LegalAnchor kind="privacy" className="text-primary" />
            {isParent ? ", on behalf of my athlete too" : ""}
          </span>
        </label>
        ) : null}
        {errors.terms ? <span className="text-caption text-error-700">{errors.terms}</span> : null}
        <button
          type="button"
          className={signupCta}
          disabled={!answers.terms || busy}
          onClick={createAccount}
        >
          {busy ? "Working…" : camp ? (googleMode ? "Continue" : "Create account") : "Complete signup"}
          <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
        </button>
        {!googleMode && !camp ? (
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
        <Continue
          ok={/^\d{6}$/.test(answers.code.trim())}
          onClick={submitCode}
          label={busy ? "Checking…" : camp ? "Verify email" : "Verify and finish"}
        />
        <button type="button" className={cn(textButton, "self-center")} onClick={resend}>
          Resend code
        </button>
      </div>
    );
  } else if (step === "password") {
    body = (
      <div className="flex flex-col gap-3">
        <Head title="Choose a password" sub="Your email is confirmed. Set a password to sign in next time." />
        <Field text="Password" error={errors.password}>
          <div className="relative">
            <input
              className={cn(input, "pr-10")}
              type={showPassword ? "text" : "password"}
              value={answers.pw}
              onChange={(e) => patch({ pw: e.target.value })}
              autoComplete="new-password"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-2 flex items-center rounded-control text-dark-300 hover:text-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
            </button>
          </div>
          {answers.pw ? <PasswordRequirements items={passwordItems} /> : <span className={meta}>8 or more characters with a number and a symbol</span>}
        </Field>
        <Continue ok={passwordOk} onClick={setPassword} label={busy ? "Saving…" : "Save password"} />
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
              <span className="text-stat tabular-nums text-primary">{matchTotal || matches.length}</span>
              <h2 className="text-card-title text-dark">
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
                <div key={c.id} className="flex gap-3 rounded-card border border-light-525 bg-light-200 p-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-primary-300 bg-primary-50 text-label-sm text-primary">
                    {initials(c.name)}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-label-sm">{c.name}</span>
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
                        <BrandPill key={p} tone="blue">
                          {p}
                        </BrandPill>
                      ))}
                      <BrandPill tone="neutral">
                        {(c.session_types ?? []).some((t) => /virtual|video/i.test(t)) ? "Video call" : (c.locations?.[0] ?? "Nearby")}
                      </BrandPill>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(meta, "inline-flex items-center gap-1 text-primary")}>
                        <Check className="size-3" strokeWidth={2} aria-hidden="true" />
                        {(c.positions?.length ?? 0) > 1 ? "Coaches every position" : `${c.position || pos} specialist`}
                      </span>
                      <span className="whitespace-nowrap text-label-sm">From ${c.hourly_rate ?? 0}</span>
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
      ...answers.formats.map((x) => (x === "Group" ? "Group sessions" : "1-on-1 sessions")),
      ...(answers.locations.includes("Online") ? ["Online sessions"] : []),
    ];
    // The required setup steps (CoachSetup has all 7); going live needs these four.
    const setup = [
      ["Account created", true],
      ["Add a profile photo", false],
      ["Set your prices", false],
      ["Set your weekly availability", false],
      ["Add payout details", false],
    ] as const;

    body = (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col items-center gap-1 text-center">
          <h2 className="text-card-title text-dark">Your profile is started</h2>
          <p className={meta}>This is how families will see you once you go live.</p>
        </div>
        <div className="flex flex-col gap-3 rounded-card border border-light-525 bg-light-200 p-3">
          <div className="flex gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-primary-300 bg-primary-50 text-label-sm text-primary">
              {initials(nm)}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-label-sm">{nm}</span>
                <BrandPill tone="neutral">Draft, only you can see this</BrandPill>
              </div>
              <span className={meta}>
                {answers.sport || "Soccer"} · {spec}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {answers.pillars.map((p) => (
              <BrandPill key={p} tone="blue">
                {p}
              </BrandPill>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {types.map((t) => (
              <BrandPill key={t} tone="teal">
                {t}
              </BrandPill>
            ))}
            {answers.clevels.map((l) => (
              <BrandPill key={l} tone="neutral">
                {l}
              </BrandPill>
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
            <div key={t} className="flex items-center gap-3 rounded-control border border-light-525 bg-light-200 px-3 py-2.5">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-label-xsm",
                  done ? "bg-primary text-light" : "border border-light-600 text-dark-300"
                )}
              >
                {done ? <Check className="size-3" strokeWidth={2.5} /> : k + 1}
              </span>
              <span className="text-body-m">{t}</span>
            </div>
          ))}
        </div>
        <Continue ok onClick={() => { clearSignupSession(); navigate(ROUTES.COACH_SETUP, { replace: true }); }} label="Set up my profile" />
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
              <BrandPill key={p} tone="blue">
                {p}
              </BrandPill>
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
        <p className="flex items-start gap-2 rounded-control border border-primary-300 bg-primary-50 px-3 py-2.5 text-body-m text-primary-700">
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
            go("dob");
          }}
        >
          I'm actually the parent
        </button>
      </div>
    );
  } else if (step === "extras") {
    body = (
      <OptionalProfile
        athleteId={athleteId}
        isParent={isParent}
        athleteWord={athleteWord}
        onDone={async () => {
          if (camp) {
            navigate(ROUTES.DASHBOARD, { replace: true });
            return;
          }
          // Invited families confirm the coach on the invite page.
          if (inviteToken) {
            navigate(`/invite/${inviteToken}`, { replace: true });
            return;
          }
          // Signed up from a shared session link (or a page that needed an account): back there.
          const saved = takeReturnPath();
          if (saved) {
            navigate(saved, { replace: true });
            return;
          }
          await loadMatches();
          go("matches");
        }}
      />
    );
  } else if (step === "sent") {
    body = (
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary-50 text-primary">
          <Mail className="size-7" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <Head title="We emailed your parent" sub={`${answers.pemail} has a link to finish your account. Your matches will be waiting.`} />
        <Link to={`${ROUTES.AUTH}?mode=signin`} className={wideSecondary}>
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
