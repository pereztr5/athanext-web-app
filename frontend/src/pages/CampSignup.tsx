/**
 * Public camp page and sign-up at /<coach>/<camp> (mockup "Camp sign-up from a link"). Phone
 * first, no login: Camp page → Details (one screen, siblings, waiver) → Review and pay →
 * Stripe Checkout, or "Hold my spot" when the family pays the coach directly. Stripe returns
 * here with ?signup=…&session_id=…, which shows "You're in".
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ChevronLeft, Compass, CreditCard, Lock, Plus } from "@/components/icons";
import { campSignupAPI, CampSignupError, type CampPage, type CampQuote } from "@/api/campSignup";
import { CampFamilyView } from "@/components/camps/CampFamilyView";
import { campViewFromPage, firstName } from "@/components/camps/campView";
import { CampYoureIn } from "@/components/camps/CampYoureIn";
import { writeCampFinish } from "@/components/camps/campFinish";
import { PhoneInput } from "@/components/common/PhoneInput";
import { LegalAnchor } from "@/components/legal/LegalLinks";
import { input, label as labelClass, primaryButton, secondaryButton, smallButton, textButton, textPanel } from "@/components/schedule/styles";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { coachPricingPath } from "@/utils/coachSlug";
import {
  CAMP_MAX_ATHLETES,
  campFormAthletes,
  campReviewPayment,
  campSourceFromSearch,
  campWaiverUrl,
  emptyAthlete,
  emptyCampForm,
  formatCampDates,
  formatCampMoney,
  formatCampTimes,
  parseCampRoute,
  plural,
  validateCampForm,
  type CampForm,
} from "@/utils/camps";
import { feeRows } from "@/utils/fees";

type Step = "page" | "details" | "review";
type PayMethod = "card" | "direct";

// Same content width as the public coach profile (max-w-wrapper + px-4 / md:px-10).
const shell = "mx-auto flex w-full max-w-wrapper flex-col gap-4 px-4 pb-6 pt-4 md:px-10 md:pt-8";
const footer =
  "sticky bottom-0 z-10 -mx-4 mt-2 flex flex-col gap-2.5 border-t border-light-525 bg-light-300 px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 md:-mx-10 md:px-10";
const fieldBox = "flex min-w-0 flex-col gap-1.5";

/** Signed in on a phone, the app's tab bar sits at the bottom: keep the footer above it. */
const useFooterClass = () => {
  const { user } = useAuth();
  return cn(footer, user && "max-md:bottom-[calc(4rem+env(safe-area-inset-bottom,0px))]");
};

const CampSignup = () => {
  const params = useParams();
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const signupId = search.get("signup");
  const sessionId = search.get("session_id");
  const canceled = search.get("canceled") === "1";
  const route = parseCampRoute(params.coachSlug, params.campSlug);

  // athanext.com/<coach>/pricing is the coach's prices, not a camp.
  if (params.coachSlug && params.campSlug === "pricing") return <Navigate to={coachPricingPath(params.coachSlug)} replace />;
  if (!route) return <CampNotFound />;
  if (signupId && !canceled) return <CampYoureIn signupId={signupId} sessionId={sessionId} />;
  return <CampFlow coachSlug={route.coachSlug} campSlug={route.campSlug} canceled={canceled} />;
};

/** Old links (/camps/<coach>/<camp>) keep working, with their query (Stripe returns there). */
export const LegacyCampRedirect = () => {
  const params = useParams();
  const location = useLocation();
  const route = parseCampRoute(params.coachSlug, params.campSlug);
  if (!route) return <CampNotFound />;
  return <Navigate to={`/${encodeURIComponent(route.coachSlug)}/${encodeURIComponent(route.campSlug)}${location.search}`} replace />;
};

export const CampNotFound = ({ title = "This camp isn't open", body }: { title?: string; body?: string }) => (
  <div className="flex min-h-[calc(100svh-3.8rem)] items-center justify-center px-4 py-10">
    <div className="flex w-full max-w-[420px] flex-col items-center gap-4 rounded-card border border-light-525 bg-light-300 px-[18px] pb-6 pt-7 text-center">
      <span className="inline-flex size-10 items-center justify-center rounded-control border border-light-525 bg-light-400 text-dark-300" aria-hidden="true">
        <Compass className="size-5" strokeWidth={1.5} />
      </span>
      <h1 className="text-page-title-phone text-dark">{title}</h1>
      <p className="text-body-m text-dark-300">
        {body ?? "The link may be out of date, or sign-ups have closed. Ask the coach for a new link."}
      </p>
      <Link to={ROUTES.COACHES} className={primaryButton}>
        Find a coach
      </Link>
    </div>
  </div>
);

const draftKey = (coachSlug: string, campSlug: string) => `athanext:camp-form:${coachSlug}/${campSlug}`;

type SavedDraft = { step: Step; form: CampForm; groupId: string | null; pay: PayMethod };

const readDraft = (key: string): SavedDraft | null => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? "null") as SavedDraft | null;
    return saved && Array.isArray(saved.form?.athletes) ? saved : null;
  } catch {
    return null;
  }
};

/** What we already know about a signed-in family, so they don't type it again. */
const useFamilyPrefill = () => {
  const { user, userProfile } = useAuth();
  const isFamily = Boolean(user) && userProfile?.persona_type !== "coach" && !userProfile?.coach_id;
  const athletes = useQuery({
    queryKey: ["camp-prefill-athletes", user?.id],
    enabled: isFamily,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("athlete_profiles")
        .select("full_name, date_of_birth")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true })
        .limit(CAMP_MAX_ATHLETES);
      if (error) return [];
      return (data ?? []).map((a) => {
        const [first = "", ...rest] = (a.full_name ?? "").trim().split(/\s+/);
        return { first, last: rest.join(" "), year: a.date_of_birth ? a.date_of_birth.slice(0, 4) : "" };
      });
    },
  });
  if (!isFamily) return null;
  return {
    name: userProfile?.name ?? "",
    email: user?.email ?? userProfile?.email ?? "",
    phone: userProfile?.phone_number ?? "",
    athletes: athletes.data ?? [],
    ready: !athletes.isLoading,
  };
};

const CampFlow = ({ coachSlug, campSlug, canceled }: { coachSlug: string; campSlug: string; canceled: boolean }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const src = campSourceFromSearch(location.search);
  const key = draftKey(coachSlug, campSlug);
  const saved = useMemo(() => readDraft(key), [key]);
  const prefill = useFamilyPrefill();
  const footerClass = useFooterClass();

  const { user } = useAuth();
  const page = useQuery({
    // The viewer matters: the camp's coach also sees drafts and the Edit bar.
    queryKey: ["camp-page", coachSlug, campSlug, user?.id ?? null],
    queryFn: () => campSignupAPI.page(coachSlug, campSlug),
    retry: false,
  });

  const [step, setStep] = useState<Step>(() => (canceled && saved ? "review" : saved?.step === "details" ? "details" : "page"));
  const [groupId, setGroupId] = useState<string | null>(saved?.groupId ?? null);
  const [form, setForm] = useState<CampForm>(() => saved?.form ?? emptyCampForm());
  const [pay, setPay] = useState<PayMethod>(saved?.pay ?? "card");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(canceled ? "Payment was canceled. Nothing was charged." : null);
  const [busy, setBusy] = useState(false);
  const prefilled = useRef(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify({ step, form, groupId, pay } satisfies SavedDraft));
    } catch {
      // ignore
    }
  }, [key, step, form, groupId, pay]);

  // Signed-in families: fill what we know once, never over what they typed.
  useEffect(() => {
    if (!prefill?.ready || prefilled.current) return;
    prefilled.current = true;
    setForm((cur) => ({
      ...cur,
      parent: {
        name: cur.parent.name || prefill.name,
        email: cur.parent.email || prefill.email,
        phone: cur.parent.phone || prefill.phone,
      },
      athletes: cur.athletes.map((a, i) =>
        i === 0 && !a.first && !a.last && prefill.athletes[0]
          ? { ...a, first: prefill.athletes[0].first, last: prefill.athletes[0].last, year: prefill.athletes[0].year }
          : a,
      ),
    }));
  }, [prefill]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  if (page.isLoading) {
    return (
      <div className={shell} aria-busy="true">
        <div className="h-[200px] animate-pulse rounded-card bg-light-400" />
        <div className="h-[240px] animate-pulse rounded-card bg-light-400" />
      </div>
    );
  }
  if (page.isError) {
    return (
      <CampNotFound
        title="Couldn't open this camp"
        body={page.error instanceof Error ? page.error.message : "Check your connection and try again."}
      />
    );
  }
  if (!page.data) return <CampNotFound />;

  const camp = page.data;
  const view = campViewFromPage(camp);
  const coachFirst = firstName(camp.coach.name);
  const group = camp.groups.find((g) => g.id === groupId) ?? null;
  const allFull = camp.groups.length > 0 && camp.groups.every((g) => g.full);

  const startDetails = () => {
    if (!group || group.full) return;
    setForm((cur) => ({ ...cur, athletes: cur.athletes.map((a, i) => (i === 0 || !a.groupId ? { ...a, groupId: group.id } : a)) }));
    setStep("details");
  };

  const toReview = () => {
    const next = validateCampForm(form, camp.groups);
    setErrors(next);
    if (Object.keys(next).length) {
      window.setTimeout(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus(), 0);
      return;
    }
    setSubmitError(null);
    setStep("review");
  };

  const submit = async (quote: CampQuote | undefined) => {
    const method: PayMethod = pay === "direct" && quote?.direct_allowed ? "direct" : "card";
    setBusy(true);
    setSubmitError(null);
    try {
      const result = await campSignupAPI.signup({
        campId: camp.id,
        src,
        payMethod: method,
        parent: { name: form.parent.name.trim(), email: form.parent.email.trim(), phone: form.parent.phone.trim() || null },
        waiver: form.waiver,
        photoConsent: form.waiver,
        athletes: campFormAthletes(form),
      });
      const first = form.athletes[0];
      writeCampFinish({
        signupId: result.signup_id,
        email: form.parent.email.trim().toLowerCase(),
        parentName: form.parent.name.trim(),
        phone: form.parent.phone.trim(),
        athleteFirst: first.first.trim(),
        athleteLast: first.last.trim(),
        birthYear: Number(first.year) || null,
      });
      if (result.status === "held") {
        sessionStorage.removeItem(key);
        navigate(`${location.pathname}?signup=${encodeURIComponent(result.signup_id)}`, { replace: true });
        return;
      }
      sessionStorage.setItem(key, JSON.stringify({ step: "review", form, groupId, pay } satisfies SavedDraft));
      window.location.assign(result.url);
    } catch (err) {
      setBusy(false);
      if (err instanceof CampSignupError) {
        const formErrors = Object.fromEntries(Object.entries(err.fields).filter(([k]) => k.startsWith("parent.") || k.startsWith("athletes.") || k === "waiver"));
        if (Object.keys(formErrors).length) {
          setErrors(formErrors);
          setStep("details");
          return;
        }
        // Full group or camp: show the spots as they are now.
        if (err.status === 409) void queryClient.invalidateQueries({ queryKey: ["camp-page", coachSlug, campSlug] });
      }
      setSubmitError(err instanceof Error ? err.message : "Could not save your spot. Try again.");
    }
  };

  if (step === "details" && group) {
    return (
      <Details
        camp={camp}
        group={group}
        form={form}
        setForm={setForm}
        errors={errors}
        setErrors={setErrors}
        onBack={() => setStep("page")}
        onNext={toReview}
      />
    );
  }

  if (step === "review" && group) {
    return (
      <Review
        camp={camp}
        src={src}
        form={form}
        pay={pay}
        setPay={setPay}
        busy={busy}
        error={submitError}
        onBack={() => setStep("details")}
        onSubmit={submit}
      />
    );
  }

  return (
    <div className={shell}>
      {camp.can_edit ? <OwnerBar camp={camp} /> : null}
      {submitError ? <Notice>{submitError}</Notice> : null}
      <CampFamilyView view={view} groupId={groupId} onGroup={(id) => setGroupId(id)} />
      <div className={footerClass}>
        {camp.published === false ? (
          <p className="text-center text-caption text-dark-300">This is a draft. Publish it to let families sign up.</p>
        ) : !camp.open ? (
          <p className="text-center text-caption text-dark-300">Sign-ups for this camp are closed.</p>
        ) : allFull ? (
          <p className="text-center text-caption text-dark-300">Every group is fully booked.</p>
        ) : !group ? (
          <p className="text-center text-caption text-dark-300">Pick a group to continue.</p>
        ) : (
          <p className="text-center text-caption text-dark-300">
            {group.name} · {formatCampMoney(camp.price_cents)} per athlete
          </p>
        )}
        <button type="button" className={cn(primaryButton, "h-11 w-full")} disabled={camp.published === false || !camp.open || !group || group.full} onClick={startDetails}>
          Sign up
        </button>
        <span className="text-center text-caption text-dark-300">No account needed. With {coachFirst}.</span>
      </div>
    </div>
  );
};

/** The camp's coach (or an admin) sees the page as families do, with Edit and Registrations on top. */
const OwnerBar = ({ camp }: { camp: CampPage }) => (
  <div className="flex flex-col gap-3 rounded-control border border-primary-300 bg-primary-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 flex-col gap-0.5">
      <b className="text-label-sm text-dark">This is how families see your camp</b>
      <span className="text-caption text-dark-300">{camp.published === false ? "Draft: only you can see it." : "Only you see this bar."}</span>
    </div>
    <div className="flex flex-wrap gap-2">
      <Link to={`${ROUTES.CAMPS}?camp=${camp.id}&view=registrations`} className={cn(secondaryButton, smallButton)}>
        Registrations
      </Link>
      <Link to={`${ROUTES.CAMPS}?camp=${camp.id}&view=edit`} className={cn(primaryButton, smallButton)}>
        Edit camp
      </Link>
    </div>
  </div>
);

const Notice = ({ children }: { children: ReactNode }) => (
  <p role="alert" className="flex items-start gap-2 rounded-control border border-info-300 bg-info-50 px-3 py-2.5 text-body-m text-info-800">
    <AlertCircle className="mt-[1px] size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
    {children}
  </p>
);

const FieldError = ({ id, text }: { id: string; text?: string }) =>
  text ? (
    <span id={id} className="flex items-center gap-1.5 text-caption text-error-700">
      <AlertCircle className="size-3.5 flex-none text-error-600" strokeWidth={2} aria-hidden="true" />
      {text}
    </span>
  ) : null;

const Field = ({
  id,
  label,
  error,
  help,
  optional,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  help?: string;
  optional?: boolean;
  children: ReactNode;
}) => (
  <div className={fieldBox}>
    <label htmlFor={id} className={labelClass}>
      {label}
      {optional ? <span className="font-normal"> (optional)</span> : null}
    </label>
    {children}
    {error ? <FieldError id={`${id}-error`} text={error} /> : help ? <span className="text-caption text-dark-300">{help}</span> : null}
  </div>
);

const fieldInput = (error?: string) =>
  cn(input, "h-11 text-body-l md:h-input md:text-body-m", error && "border-error-600 hover:border-error-600");

const StepHead = ({ back, onBack, step, line }: { back: string; onBack: () => void; step: 1 | 2; line: string }) => (
  <div className="flex flex-col gap-3">
    <div className="flex items-center justify-between gap-3">
      <button type="button" className="inline-flex min-h-[44px] items-center gap-1 text-body-m text-dark-300 hover:text-dark" onClick={onBack}>
        <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden="true" />
        {back}
      </button>
      <span className="min-w-0 truncate text-caption text-dark-300">{line}</span>
    </div>
    <div className="flex items-center gap-1.5" aria-label={`Step ${step} of 2`}>
      <i className="h-1 flex-1 rounded-pill bg-primary" />
      <i className={cn("h-1 flex-1 rounded-pill", step === 2 ? "bg-primary" : "bg-light-550")} />
    </div>
  </div>
);

const Details = ({
  camp,
  group,
  form,
  setForm,
  errors,
  setErrors,
  onBack,
  onNext,
}: {
  camp: CampPage;
  group: CampPage["groups"][number];
  form: CampForm;
  setForm: (update: (cur: CampForm) => CampForm) => void;
  errors: Record<string, string>;
  setErrors: (update: (cur: Record<string, string>) => Record<string, string>) => void;
  onBack: () => void;
  onNext: () => void;
}) => {
  const coachFirst = firstName(camp.coach.name);
  const waiverHref = campWaiverUrl(camp.waiver_url);
  const footerClass = useFooterClass();
  const clear = (key: string) =>
    setErrors((cur) => {
      if (!cur[key]) return cur;
      const next = { ...cur };
      delete next[key];
      return next;
    });
  const setParent = (field: keyof CampForm["parent"], value: string) => {
    setForm((cur) => ({ ...cur, parent: { ...cur.parent, [field]: value } }));
    clear(`parent.${field}`);
  };
  const setAthlete = (index: number, field: keyof CampForm["athletes"][number], value: string, errorKey?: string) => {
    setForm((cur) => ({ ...cur, athletes: cur.athletes.map((a, i) => (i === index ? { ...a, [field]: value } : a)) }));
    if (errorKey) clear(`athletes.${index}.${errorKey}`);
  };
  const removeAthlete = (index: number) => {
    setForm((cur) => ({ ...cur, athletes: cur.athletes.filter((_, i) => i !== index) }));
    setErrors(() => ({}));
  };
  const count = form.athletes.length;
  const err = (key: string) => errors[key];
  const aria = (key: string) => ({ "aria-invalid": err(key) ? ("true" as const) : undefined, "aria-describedby": err(key) ? `${key}-error` : undefined });

  return (
    <div className={shell}>
      <StepHead back="Camp" onBack={onBack} step={1} line={`${group.name} · ${formatCampMoney(camp.price_cents)}`} />
      <div className="flex flex-col gap-1.5">
        <h1 className="text-page-title-phone text-dark">About your athlete</h1>
        <p className="text-body-m text-dark-300">Only what {coachFirst} needs for the first morning. No account needed to sign up.</p>
      </div>

      <section className="flex flex-col gap-4 rounded-card border border-light-525 bg-light-300 px-[18px] pb-5 pt-[22px]">
        <h2 className="text-subtitle text-dark">Parent or guardian</h2>
        <Field id="parent.name" label="Full name" error={err("parent.name")}>
          <input id="parent.name" className={fieldInput(err("parent.name"))} autoComplete="name" value={form.parent.name} onChange={(e) => setParent("name", e.target.value)} {...aria("parent.name")} />
        </Field>
        <Field id="parent.email" label="Email" error={err("parent.email")} help="Your receipt goes here.">
          <input id="parent.email" type="email" inputMode="email" autoComplete="email" className={fieldInput(err("parent.email"))} value={form.parent.email} onChange={(e) => setParent("email", e.target.value)} {...aria("parent.email")} />
        </Field>
        <Field id="parent.phone" label="Mobile" error={err("parent.phone")} help={`So ${coachFirst} can reach you on camp days.`}>
          <PhoneInput id="parent.phone" value={form.parent.phone} onChange={(v) => setParent("phone", v)} invalid={Boolean(err("parent.phone"))} />
        </Field>
      </section>

      {form.athletes.map((athlete, i) => {
        const k = (f: string) => `athletes.${i}.${f}`;
        return (
          <section key={i} className="flex flex-col gap-4 rounded-card border border-light-525 bg-light-300 px-[18px] pb-5 pt-[22px]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-subtitle text-dark">{count > 1 ? `Athlete ${i + 1}` : "Athlete"}</h2>
              {i > 0 ? (
                <button type="button" className={cn(textButton, "min-h-[44px] text-dark-300 hover:text-dark")} onClick={() => removeAthlete(i)}>
                  Remove
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field id={k("first_name")} label="First name" error={err(k("first_name"))}>
                <input id={k("first_name")} className={fieldInput(err(k("first_name")))} autoComplete="off" value={athlete.first} onChange={(e) => setAthlete(i, "first", e.target.value, "first_name")} {...aria(k("first_name"))} />
              </Field>
              <Field id={k("last_name")} label="Last name" error={err(k("last_name"))}>
                <input id={k("last_name")} className={fieldInput(err(k("last_name")))} autoComplete="off" value={athlete.last} onChange={(e) => setAthlete(i, "last", e.target.value, "last_name")} {...aria(k("last_name"))} />
              </Field>
            </div>
            <Field id={k("birth_year")} label="Birth year" error={err(k("birth_year"))} help="Used for age groups. No full birthday needed.">
              <input
                id={k("birth_year")}
                className={fieldInput(err(k("birth_year")))}
                inputMode="numeric"
                maxLength={4}
                placeholder="2013"
                value={athlete.year}
                onChange={(e) => setAthlete(i, "year", e.target.value.replace(/\D/g, "").slice(0, 4), "birth_year")}
                {...aria(k("birth_year"))}
              />
            </Field>
            {i > 0 || camp.groups.length > 1 ? (
              <Field id={k("group_id")} label="Group" error={err(k("group_id"))}>
                <select
                  id={k("group_id")}
                  className={fieldInput(err(k("group_id")))}
                  value={athlete.groupId}
                  onChange={(e) => setAthlete(i, "groupId", e.target.value, "group_id")}
                  {...aria(k("group_id"))}
                >
                  <option value="">Pick a group</option>
                  {camp.groups.map((g) => (
                    <option key={g.id} value={g.id} disabled={g.full}>
                      {g.name} · {formatCampTimes(g.start_time, g.end_time)}
                      {g.full ? " · Fully booked" : ""}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            <Field id={k("note")} label="Allergies, injuries, anything else" optional error={err(k("note"))} help={`Only ${coachFirst} sees this.`}>
              <textarea
                id={k("note")}
                rows={2}
                maxLength={500}
                className={cn(fieldInput(err(k("note"))), "h-auto py-2.5")}
                value={athlete.note}
                onChange={(e) => setAthlete(i, "note", e.target.value, "note")}
              />
            </Field>
          </section>
        );
      })}

      {count < CAMP_MAX_ATHLETES ? (
        <button
          type="button"
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-control border border-dashed border-light-600 text-label-sm text-dark-300 hover:bg-light-200 hover:text-dark"
          onClick={() => setForm((cur) => ({ ...cur, athletes: [...cur.athletes, emptyAthlete(group.id)] }))}
        >
          <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
          Add another athlete
        </button>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label className="flex cursor-pointer items-start gap-2.5 text-body-m text-dark">
          <input
            type="checkbox"
            className="mt-[1px] size-5 flex-none accent-primary"
            checked={form.waiver}
            aria-invalid={err("waiver") ? "true" : undefined}
            aria-describedby={err("waiver") ? "waiver-error" : undefined}
            onChange={(e) => {
              setForm((cur) => ({ ...cur, waiver: e.target.checked }));
              clear("waiver");
            }}
          />
          <span>
            I agree to {coachFirst}&apos;s{" "}
            {waiverHref ? (
              <a
                href={waiverHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-primary-700"
                onClick={(e) => e.stopPropagation()}
              >
                camp waiver
              </a>
            ) : (
              "camp waiver"
            )}{" "}
            and to photos of my athlete being used by {camp.coach.name}.
          </span>
        </label>
        <FieldError id="waiver-error" text={err("waiver")} />
      </div>

      <div className={footerClass}>
        <div className="flex items-center justify-between text-body-m">
          <span className="text-dark-300">{plural(count, "athlete")}</span>
          <b className="tabular-nums">{formatCampMoney(camp.price_cents * count)}</b>
        </div>
        <button type="button" className={cn(primaryButton, "h-11 w-full")} onClick={onNext}>
          Continue to payment
        </button>
      </div>
    </div>
  );
};

const Review = ({
  camp,
  src,
  form,
  pay,
  setPay,
  busy,
  error,
  onBack,
  onSubmit,
}: {
  camp: CampPage;
  src: "link" | null;
  form: CampForm;
  pay: PayMethod;
  setPay: (pay: PayMethod) => void;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: (quote: CampQuote | undefined) => void;
}) => {
  const coachFirst = firstName(camp.coach.name);
  const [policyOpen, setPolicyOpen] = useState(false);
  const footerClass = useFooterClass();
  const count = form.athletes.length;
  const quote = useQuery({
    queryKey: ["camp-quote", camp.id, src, count],
    queryFn: () => campSignupAPI.quote({ campId: camp.id, src, athletes: count }),
    retry: 1,
  });
  // No platform fee on camps: card processing on the card option only.
  const { direct, directOffered, feeCents, totalCents: total } = campReviewPayment(quote.data, pay, camp.price_cents * count);
  const card = quote.data?.card;
  const groupLine = (id: string) => {
    const g = camp.groups.find((x) => x.id === id);
    return g ? [g.name, formatCampTimes(g.start_time, g.end_time)].filter(Boolean).join(" · ") : "";
  };
  const when = [formatCampDates(camp.starts_on, camp.ends_on), camp.location].filter(Boolean).join(" · ");

  return (
    <div className={shell}>
      <StepHead back="Details" onBack={onBack} step={2} line={camp.name} />
      <h1 className="text-page-title-phone text-dark">Review and pay</h1>

      <section className="flex flex-col gap-3 rounded-card border border-light-525 bg-light-300 px-[18px] pb-5 pt-[22px]">
        <div className="flex flex-col gap-0.5">
          <b className="text-label-sm">{camp.name}</b>
          {when ? <span className="text-caption text-dark-300">{when}</span> : null}
        </div>
        <div className="h-px bg-light-525" />
        {form.athletes.map((a, i) => (
          <div key={i} className="flex items-start justify-between gap-3 text-body-m">
            <span className="flex min-w-0 flex-col">
              <b className="truncate text-label-sm">
                {a.first} {a.last}
              </b>
              <span className="text-caption text-dark-300">{groupLine(a.groupId)}</span>
            </span>
            <span className="tabular-nums">{formatCampMoney(camp.price_cents)}</span>
          </div>
        ))}
        {!direct && card
          ? feeRows(card).map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 text-body-m text-dark-300">
                <span>{row.label === "Card processing" ? "Card processing fee" : row.label}</span>
                <span className="tabular-nums">{formatCampMoney(row.cents)}</span>
              </div>
            ))
          : null}
        <div className="h-px bg-light-525" />
        <div className="flex items-center justify-between gap-3">
          <b className="text-label-sm">Total</b>
          <b className="text-subtitle tabular-nums">{total != null ? formatCampMoney(total) : "…"}</b>
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <span className={labelClass}>Pay with</span>
        {direct ? (
          <div className="flex min-h-[44px] items-center gap-3 rounded-control border border-primary bg-primary-50 px-3.5 py-3">
            <span className="flex size-4 flex-none items-center justify-center rounded-full border border-primary bg-light-50" aria-hidden="true">
              <span className="size-2 rounded-full bg-primary" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <b className="text-label-sm">Pay {coachFirst} directly</b>
              <span className="text-caption text-dark-300">Paying {coachFirst} directly, no fee.</span>
            </span>
          </div>
        ) : (
          <div className="flex min-h-[44px] items-center gap-3 rounded-control border border-primary bg-primary-50 px-3.5 py-3">
            <CreditCard className="size-5 flex-none text-primary" strokeWidth={1.5} aria-hidden="true" />
            <span className="flex min-w-0 flex-1 flex-col">
              <b className="text-label-sm">Card, Apple Pay or Google Pay</b>
              <span className="text-caption text-dark-300">On Stripe&apos;s secure page</span>
            </span>
            {feeCents != null ? <span className="flex-none text-caption text-dark-300">+ {formatCampMoney(feeCents)} card processing</span> : null}
          </div>
        )}
        {directOffered ? (
          <button type="button" className={cn(textButton, "min-h-[44px] self-start", !direct && "text-dark-300 hover:text-dark")} onClick={() => setPay(direct ? "card" : "direct")}>
            {direct ? "Pay by card instead" : "Paying offline?"}
          </button>
        ) : null}
        <p className="text-body-m text-dark-300">
          {direct
            ? `We hold your spot and ${coachFirst} confirms it once you've paid. Nothing is charged in AthaNext.`
            : "Your spot is confirmed as soon as payment goes through."}
        </p>
        {quote.isError ? (
          <Notice>{quote.error instanceof Error ? quote.error.message : "Could not load the price."}</Notice>
        ) : null}
      </section>

      {error ? <Notice>{error}</Notice> : null}

      <div className={footerClass}>
        <button
          type="button"
          className={cn(primaryButton, "h-11 w-full")}
          disabled={busy || (!direct && !card)}
          onClick={() => onSubmit(quote.data)}
        >
          {busy ? (direct ? "Holding your spot…" : "Opening Stripe…") : direct ? "Hold my spot" : total != null ? `Pay ${formatCampMoney(total)}` : "Pay"}
        </button>
        {!direct ? (
          <span className="flex items-center justify-center gap-1.5 text-caption text-dark-300">
            <Lock className="size-3 flex-none" strokeWidth={2} aria-hidden="true" />
            Payments by Stripe. AthaNext never sees your card.
          </span>
        ) : null}
        <span className="text-center text-caption text-dark-300">
          By signing up you agree to the <LegalAnchor kind="terms">Terms of Service</LegalAnchor> and{" "}
          {camp.coach.cancellation_policy ? (
            <button type="button" className="underline underline-offset-2 hover:text-primary" aria-expanded={policyOpen} onClick={() => setPolicyOpen((v) => !v)}>
              {coachFirst}&apos;s cancellation policy
            </button>
          ) : (
            `${coachFirst}'s cancellation policy`
          )}
          .
        </span>
        {policyOpen && camp.coach.cancellation_policy ? (
          <p className={cn(textPanel, "whitespace-pre-line text-caption text-dark-400")}>{camp.coach.cancellation_policy}</p>
        ) : null}
      </div>
    </div>
  );
};

export default CampSignup;
