/**
 * "You're in" after a camp sign-up (mockup screen 5). Reads the camp-signup status: back from
 * Stripe it polls briefly until the payment is confirmed. A direct-pay sign-up shows the held
 * spot. Families without an account can finish it in one step, or skip it.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Check, Clock, Loader2, MapPin } from "@/components/icons";
import { authAPI } from "@/api/auth";
import { campSignupAPI, type CampSignupStatus } from "@/api/campSignup";
import { campsAPI } from "@/api/camps";
import { primaryButton, secondaryButton, textButton } from "@/components/schedule/styles";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { campHeldNextStep, campPath, formatCampDates, formatCampTimes } from "@/utils/camps";
import { formatDateInZone } from "@/utils/viewerTime";
import { finishAccountPath } from "./campFinish";
import { trackCampSignupCompleted } from "@/analytics/events";

const POLLS = 8;
// Match CampSignup / public coach profile width so post-pay doesn't feel like a different layout.
const shell = "mx-auto flex w-full max-w-wrapper flex-col gap-4 px-4 pb-10 pt-6 md:px-10 md:pt-10";
const cardBox = "flex flex-col gap-4 rounded-card border border-light-525 bg-light-300 px-[18px] pb-5 pt-[22px]";

const first = (name: string) => name.trim().split(/\s+/)[0] || name;

export const CampYoureIn = ({ signupId, sessionId }: { signupId: string; sessionId?: string | null }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const polls = useRef(0);
  const trackedCamp = useRef(false);
  const [skipped, setSkipped] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ["camp-signup-status", signupId, sessionId ?? ""],
    queryFn: async () => {
      polls.current += 1;
      return campSignupAPI.status(signupId, sessionId);
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || polls.current >= POLLS) return false;
      // Keep polling while Stripe may still be settling (live hold or unpaid card return).
      if (data.any_pending) return 2000;
      if (data.pay_method === "card" && !data.all_paid && sessionId) return 2000;
      return false;
    },
  });

  // Signed in already: link this sign-up to the account now (claim runs once per session otherwise).
  const claimed = useRef(false);
  useEffect(() => {
    if (!user || !status.data || status.data.any_pending || claimed.current) return;
    const confirmed = status.data.athletes.some((a) => a.status === "paid" || a.status === "held");
    if (!confirmed) return;
    claimed.current = true;
    campsAPI
      .claim()
      .then(() => queryClient.invalidateQueries({ queryKey: ["my-camps"] }))
      .catch(() => undefined);
  }, [user, status.data, queryClient]);

  useEffect(() => {
    if (!status.data || status.data.any_pending || trackedCamp.current) return;
    const confirmed = status.data.athletes.filter((a) => a.status === "paid" || a.status === "held");
    if (!confirmed.length) return;
    trackedCamp.current = true;
    trackCampSignupCompleted({
      pay_method: status.data.pay_method,
      athletes: confirmed.length,
    });
  }, [status.data]);

  if (status.isLoading) {
    return (
      <div className={shell} aria-busy="true">
        <div className="flex items-center gap-2 text-body-m text-dark-300">
          <Loader2 className="size-4 animate-spin" strokeWidth={1.5} aria-hidden="true" />
          Confirming your sign-up…
        </div>
      </div>
    );
  }
  if (status.isError || !status.data) {
    return (
      <div className={shell}>
        <section className={cardBox}>
          <h1 className="text-page-title-phone text-dark">We couldn&apos;t find this sign-up</h1>
          <p className="text-body-m text-dark-300">If you paid, your receipt and the camp details are in your email.</p>
          <Link to={ROUTES.COACHES} className={cn(secondaryButton, "self-start")}>
            Find a coach
          </Link>
        </section>
      </div>
    );
  }

  const s = status.data;
  const coachFirst = first(s.camp.coach_name);
  const confirmed = s.athletes.filter((a) => a.status === "paid" || a.status === "held");
  const pending = s.any_pending;
  const cardStillOpen =
    s.pay_method === "card" && !s.all_paid && Boolean(sessionId) && polls.current < POLLS && confirmed.length === 0;
  const confirming = pending || cardStillOpen;
  const stillPending = confirming && polls.current >= POLLS;
  const lapsed = !confirming && confirmed.length === 0;
  const held = s.pay_method === "direct" && confirmed.some((a) => a.status === "held");
  const dates = formatCampDates(s.camp.starts_on, s.camp.ends_on);

  const startGoogle = async () => {
    setGoogleBusy(true);
    setGoogleError(null);
    const { error } = await authAPI.signInWithOAuth("google", {
      redirectTo: `${window.location.origin}${finishAccountPath(s.parent_email, s.signup_id)}`,
    });
    if (error) {
      setGoogleError(error.message || "Google sign in didn't start. Try again.");
      setGoogleBusy(false);
    }
  };

  let title = "You're in";
  let body = `Your spot is confirmed. Your receipt is on its way to ${s.parent_email}.`;
  if (lapsed) {
    title = "This sign-up isn't active";
    body = "The payment didn't go through or the hold ran out, so nothing was charged. You can sign up again from the camp page.";
  } else if (held) {
    title = "Your spot is held";
    body = `We hold your spot and ${coachFirst} confirms it once you've paid. Nothing is charged in AthaNext.${
      // The hold ends after 7 days (the spot is released then), not at the camp start.
      s.held_until
        ? ` Pay ${coachFirst} by ${formatDateInZone(new Date(s.held_until), "America/New_York", { month: "short", day: "numeric" })} to keep it.`
        : ""
    }`;
  } else if (stillPending) {
    title = "Your payment is still going through";
    body = `We'll email ${s.parent_email} as soon as it's confirmed. You don't need to pay again.`;
  } else if (confirming) {
    title = "Confirming your payment…";
    body = "This takes a few seconds.";
  }

  return (
    <div className={shell}>
      <section className={cardBox}>
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-full border",
            lapsed ? "border-light-600 bg-light-400 text-dark-300" : confirming ? "border-info-300 bg-info-100 text-info-800" : "border-success-300 bg-success-100 text-success-800",
          )}
          aria-hidden="true"
        >
          {confirming && !stillPending ? <Loader2 className="size-5 animate-spin" strokeWidth={1.5} /> : <Check className="size-5" strokeWidth={2} />}
        </span>
        <div className="flex flex-col gap-1.5" aria-live="polite">
          <h1 className="text-page-title-phone text-dark">{title}</h1>
          <p className="text-body-m text-dark-300">{body}</p>
          {held ? <p className="text-body-m text-dark">{campHeldNextStep(coachFirst)}</p> : null}
        </div>
        <CampSummary status={s} dates={dates} />
        {lapsed && s.camp.coach_slug && s.camp.slug ? (
          <Link to={campPath(s.camp.coach_slug, s.camp.slug)} className={cn(primaryButton, "self-start")}>
            Back to the camp
          </Link>
        ) : null}
      </section>

      {!lapsed && !user && !s.account_exists && !skipped ? (
        <section className={cardBox}>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-card-title text-dark">Get the camp on your schedule</h2>
            <p className="text-body-m text-dark-300">
              See the camp schedule, get updates from {coachFirst} and book again. We already have your details, so it&apos;s one step.
            </p>
          </div>
          <button type="button" className={cn(secondaryButton, "h-11 w-full")} disabled={googleBusy} onClick={() => void startGoogle()}>
            <GoogleMark />
            {googleBusy ? "Opening Google…" : "Continue with Google"}
          </button>
          {googleError ? <p className="text-caption text-error-700">{googleError}</p> : null}
          <Link to={finishAccountPath(s.parent_email, s.signup_id)} className={cn(primaryButton, "h-11 w-full")}>
            Finish your account
          </Link>
          <button type="button" className={cn(textButton, "min-h-[44px] self-center text-dark-300 hover:text-dark")} onClick={() => setSkipped(true)}>
            Not now
          </button>
          <p className="text-center text-caption text-dark-300">Your spot doesn&apos;t depend on this. The link is also in your email.</p>
        </section>
      ) : null}

      {!lapsed && !user && s.account_exists ? (
        <section className={cardBox}>
          <p className="text-body-m text-dark-300">You already have an AthaNext account. Sign in to see the camp on your schedule.</p>
          <Link to={`${ROUTES.AUTH}?mode=signin&email=${encodeURIComponent(s.parent_email)}`} className={cn(primaryButton, "h-11 w-full")}>
            Sign in
          </Link>
        </section>
      ) : null}

      {!lapsed && user ? (
        <Link to={ROUTES.DASHBOARD} className={cn(primaryButton, "h-11 w-full")}>
          Go to AthaNext
        </Link>
      ) : null}
    </div>
  );
};

const CampSummary = ({ status, dates }: { status: CampSignupStatus; dates: string | null }) => (
  <div className="flex flex-col gap-3 rounded-control bg-light-400 px-4 py-3.5">
    <b className="text-label-sm text-dark">
      {status.camp.name} with {first(status.camp.coach_name)}
    </b>
    {dates ? (
      <span className="flex items-center gap-2 text-body-m text-dark-300">
        <Calendar className="size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
        {dates}
      </span>
    ) : null}
    {status.camp.location ? (
      <span className="flex items-center gap-2 text-body-m text-dark-300">
        <MapPin className="size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
        {status.camp.location}
      </span>
    ) : null}
    {status.athletes
      .filter((a) => a.status !== "cancelled" && a.status !== "expired")
      .map((a) => (
        <span key={a.id} className="flex items-center gap-2 text-body-m text-dark-300">
          <Clock className="size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
          <span className="min-w-0">
            <b className="font-medium text-dark">{a.first_name}</b>
            {a.group_name ? ` · ${a.group_name}` : ""}
            {a.start_time && a.end_time ? ` · ${formatCampTimes(a.start_time, a.end_time)}` : ""}
          </span>
        </span>
      ))}
  </div>
);

const GoogleMark = () => (
  <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);
