/**
 * Coach Account Settings (ATH-87). Five tabs that edit in place: Account, Notifications,
 * Booking and calendar, Privacy and safety, Password and account. Account fields show a save
 * bar once something changes; switches save as soon as they flip. AthaNext stores no card,
 * bank or payout details here.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarSync, Download, Lock, LogOut, ShieldCheck, User, Wallet } from "lucide-react";
import { coachesAPI, userProfilesAPI } from "@/api";
import { scheduleAPI } from "@/api/schedule";
import { BookingRulesSection, CalendarSyncSection } from "@/components/schedule/BookingSettings";
import { card, dangerButton, input, label, meta, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { TimeZoneSelect } from "@/components/common/TimeZoneSelect";
import { Switch } from "@/components/ui/switch";
import { ToastAction } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useCoachDetails } from "@/hooks/useCoachDetails";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { getZonedISODate } from "@/utils/dateHelpers";
import { downloadJson } from "@/utils/download";
import {
  COACH_NOTIFICATIONS,
  DEACTIVATE_WORD,
  joinName,
  notificationOn,
  passwordStrength,
  splitName,
  type NotificationChannel,
} from "@/utils/settings";

type Tab = "account" | "notifications" | "booking" | "privacy" | "security";

const TABS: [Tab, string][] = [
  ["account", "Account"],
  ["notifications", "Notifications"],
  ["booking", "Booking and calendar"],
  ["privacy", "Privacy and safety"],
  ["security", "Password and account"],
];

const cardTitle = "flex items-center gap-2 text-[20px] font-medium leading-[22px] tracking-[-1px] text-[#1A202C]";
export const sub = "text-[14px] leading-[18px] tracking-[-0.42px] text-[#484D56]";

export const Card = ({ icon, title, children, className }: { icon?: ReactNode; title: string; children: ReactNode; className?: string }) => (
  <section className={cn(card, className)}>
    <h2 className={cardTitle}>
      {icon}
      {title}
    </h2>
    {children}
  </section>
);

export const Field = ({ label: text, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string }) => (
  <label className="flex flex-col gap-1.5">
    <span className={label}>{text}</span>
    {children}
    {error ? <span className="text-[12px] text-[#972B2B]">{error}</span> : hint ? <span className={meta}>{hint}</span> : null}
  </label>
);

export const ToggleRow = ({ title, detail, checked, onChange, ariaLabel, disabled }: {
  title: string;
  detail: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
}) => (
  <div className="flex items-center justify-between gap-4">
    <div className="flex flex-col gap-1">
      <span className="text-[14px] font-medium leading-[18px] text-[#1A202C]">{title}</span>
      <span className={meta}>{detail}</span>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} aria-label={ariaLabel} disabled={disabled} />
  </div>
);

/** Page frame shared by coach and athlete settings: header, tab list and the open tab. */
export const SettingsShell = <T extends string>({
  subtitle,
  tabs,
  defaultTab,
  dirty,
  onDiscard,
  banner,
  render,
}: {
  subtitle: string;
  tabs: [T, string][];
  defaultTab: T;
  dirty?: boolean;
  onDiscard?: () => void;
  banner?: ReactNode;
  render: (tab: T) => ReactNode;
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab = (tabs.some(([key]) => key === tabParam) ? tabParam : defaultTab) as T;

  const openTab = (next: T) => {
    if (next === tab) return;
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    onDiscard?.();
    setSearchParams(next === defaultTab ? {} : { tab: next }, { replace: true });
  };

  return (
    <div className="overflow-x-hidden px-4 pb-16 md:px-10">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
        <header className="flex flex-col gap-[10px]">
          <h1 className="text-[32px] font-bold leading-[28px] tracking-[-1.6px] text-[#1A202C]">Account Settings</h1>
          <p className="text-[16px] leading-[18px] text-[#767980]">{subtitle}</p>
        </header>

        {banner}

        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          <nav className={cn(card, "gap-1 p-2 md:p-3")} aria-label="Settings">
            <span className={cn(label, "hidden px-2 pb-1 md:block")}>Settings</span>
            <div className="flex gap-1 overflow-x-auto md:flex-col">
              {tabs.map(([key, text]) => (
                <button
                  key={key}
                  type="button"
                  aria-current={tab === key ? "page" : undefined}
                  onClick={() => openTab(key)}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-[8px] px-3 py-2 text-left text-[14px] font-medium leading-[18px] tracking-[-0.42px] transition-colors",
                    tab === key ? "bg-[#E5EDF7] text-[#0054B4]" : "text-[#484D56] hover:bg-[#F1F1E6]"
                  )}
                >
                  {text}
                </button>
              ))}
            </div>
          </nav>

          <div className="flex min-w-0 flex-col gap-6">{render(tab)}</div>
        </div>
      </div>
    </div>
  );
};

export const CoachSettings = () => {
  const { profile } = useProfile();
  const coachId = profile?.userProfile?.coach_id ?? undefined;
  const { coach } = useCoachDetails(coachId);
  const [accountDirty, setAccountDirty] = useState(false);
  const deactivated = Boolean((coach as { deactivated_at?: string | null } | undefined)?.deactivated_at);

  return (
    <SettingsShell<Tab>
      subtitle="Account, notifications, booking and calendar."
      tabs={TABS}
      defaultTab="account"
      dirty={accountDirty}
      onDiscard={() => setAccountDirty(false)}
      banner={deactivated && coachId ? <DeactivatedBanner coachId={coachId} /> : null}
      render={(tab) => (
        <>
          {tab === "account" ? <AccountTab coach={coach} onDirtyChange={setAccountDirty} /> : null}
          {tab === "notifications" ? (
            <NotificationsTab kinds={COACH_NOTIFICATIONS} caption="Messages from a parent about an athlete under 18 always notify you in the app." />
          ) : null}
          {tab === "booking" && coachId ? (
            <BookingTab
              coachId={coachId}
              payMode={(coach as { pay_mode?: string } | undefined)?.pay_mode === "self" ? "self" : "app"}
              payNote={(coach as { pay_note?: string | null } | undefined)?.pay_note ?? ""}
            />
          ) : null}
          {tab === "privacy" && coachId ? <PrivacyTab coachId={coachId} listed={(coach as { listed?: boolean } | undefined)?.listed !== false} /> : null}
          {tab === "security" && coachId ? (
            <SecurityTab danger={!deactivated ? <DeactivateCard coachId={coachId} /> : null} />
          ) : null}
        </>
      )}
    />
  );
};

/* ---------- Account ---------- */

type AccountDraft = { first: string; last: string; phone: string; company: string };

const AccountTab = ({ coach, onDirtyChange }: {
  coach: { id: string; name?: string | null; company?: string | null } | undefined;
  onDirtyChange: (dirty: boolean) => void;
}) => {
  const { user, userProfile, refreshUserProfile, setUserName } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const saved = useMemo<AccountDraft>(() => {
    const { first, last } = splitName(coach?.name || userProfile?.name);
    return { first, last, phone: userProfile?.phone_number ?? "", company: coach?.company ?? "" };
  }, [coach?.name, coach?.company, userProfile?.name, userProfile?.phone_number]);
  const [draft, setDraft] = useState<AccountDraft>(saved);
  const [errors, setErrors] = useState<Partial<Record<keyof AccountDraft, string>>>({});

  useEffect(() => setDraft(saved), [saved]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const set = (key: keyof AccountDraft) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft((d) => ({ ...d, [key]: e.target.value }));
    setErrors((errs) => ({ ...errs, [key]: undefined }));
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!coach?.id || !user?.id) throw new Error("Your profile is still loading");
      const name = joinName(draft.first, draft.last);
      const coachResult = await coachesAPI.updateCoach(coach.id, { name, company: draft.company.trim() || null });
      if (coachResult.error) throw new Error(coachResult.error.message);
      const profileResult = await userProfilesAPI.updateUserProfile(user.id, { name, phone_number: draft.phone.trim() || null });
      if (profileResult.error) throw new Error(profileResult.error.message);
      return name;
    },
    onSuccess: async (name) => {
      setUserName(name);
      await refreshUserProfile();
      queryClient.invalidateQueries({ queryKey: ["coach-details"] });
      toast({ title: "Changes saved" });
    },
    onError: (err) => toast({ title: "Couldn't save", description: err instanceof Error ? err.message : undefined, variant: "destructive" }),
  });

  const submit = () => {
    const next: typeof errors = {};
    if (!draft.first.trim()) next.first = "Required";
    if (!draft.last.trim()) next.last = "Required";
    if (draft.phone.trim() && draft.phone.replace(/\D/g, "").length < 10) next.phone = "Enter a full phone number";
    setErrors(next);
    if (!Object.keys(next).length) save.mutate();
  };

  return (
    <Card icon={<User className="size-5 text-[#767980]" strokeWidth={1.5} />} title="Account">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" error={errors.first}>
          <input className={input} value={draft.first} onChange={set("first")} autoComplete="given-name" />
        </Field>
        <Field label="Last name" error={errors.last}>
          <input className={input} value={draft.last} onChange={set("last")} autoComplete="family-name" />
        </Field>
        <Field label="Email" hint="Your sign-in email. Contact support to change it.">
          <input className={cn(input, "text-[#767980]")} value={userProfile?.email || user?.email || ""} readOnly />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <input className={input} type="tel" value={draft.phone} onChange={set("phone")} autoComplete="tel" />
        </Field>
        <Field label="Business name" hint="Optional. Shown on your profile.">
          <input className={input} value={draft.company} onChange={set("company")} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className={label}>Time zone</span>
          <TimeZoneSelect className="h-[38px] w-full rounded-[8px] border-[#EAEADF] bg-[#F9F9F5]" />
          <span className={meta}>Saves straight away. My Schedule creates sessions in this zone.</span>
        </div>
      </div>
      {dirty ? (
        <div className="sticky bottom-20 flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[#CCDDF0] bg-[#E5EDF7] px-4 py-3 md:bottom-4">
          <span className={sub}>You have unsaved changes</span>
          <div className="flex gap-2">
            <button type="button" className={secondaryButton} onClick={() => { setDraft(saved); setErrors({}); }} disabled={save.isPending}>
              Discard
            </button>
            <button type="button" className={primaryButton} onClick={submit} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      ) : null}
    </Card>
  );
};

/* ---------- Notifications ---------- */

export const NotificationsTab = ({ kinds, caption }: { kinds: typeof COACH_NOTIFICATIONS; caption: string }) => {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const stored = (userProfile as { notification_prefs?: unknown } | null)?.notification_prefs;
    setPrefs(stored && typeof stored === "object" ? (stored as Record<string, boolean>) : {});
  }, [userProfile]);

  const toggle = async (kind: string, channel: NotificationChannel, on: boolean) => {
    if (!user?.id) return;
    const previous = prefs;
    const next = { ...prefs, [`${kind}_${channel}`]: on };
    setPrefs(next);
    const { error } = await userProfilesAPI.updateUserProfile(user.id, { notification_prefs: next as unknown as Json });
    if (error) {
      setPrefs(previous);
      toast({ title: "Couldn't save", description: "Please try again.", variant: "destructive" });
      return;
    }
    void refreshUserProfile();
  };

  return (
    <Card icon={<Bell className="size-5 text-[#767980]" strokeWidth={1.5} />} title="Notifications">
      <div className="grid grid-cols-[minmax(0,1fr)_56px_56px] items-center gap-x-2 gap-y-4">
        <span className={label}>Notify me about</span>
        <span className={cn(label, "text-center")}>Email</span>
        <span className={cn(label, "text-center")}>App</span>
        {kinds.map(([kind, title, detail]) => (
          <div key={kind} className="contents">
            <div className="flex flex-col gap-1">
              <span className="text-[14px] font-medium leading-[18px] text-[#1A202C]">{title}</span>
              <span className={meta}>{detail}</span>
            </div>
            {(["email", "app"] as NotificationChannel[]).map((channel) => (
              <div key={channel} className="flex justify-center">
                <Switch
                  checked={notificationOn(prefs, kind, channel)}
                  onCheckedChange={(on) => toggle(kind, channel, on)}
                  aria-label={`${title} by ${channel}`}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className={meta}>{caption}</p>
    </Card>
  );
};

/* ---------- Booking and calendar ---------- */

const PAY_MODES: { value: "app" | "self"; title: string; detail: string }[] = [
  { value: "app", title: "Through AthaNext", detail: "Families pay by card when they book. Stripe pays you out." },
  {
    value: "self",
    title: "Booking only",
    detail: "Families book and schedule through AthaNext and pay you themselves, in cash, Venmo or however you like.",
  },
];

/** How families pay (ATH-86): in the app, or booking only with a note on how to pay the coach. */
const HowFamiliesPay = ({ coachId, payMode, payNote }: { coachId: string; payMode: "app" | "self"; payNote: string }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState(payMode);
  const [note, setNote] = useState(payNote);
  useEffect(() => setMode(payMode), [payMode]);
  useEffect(() => setNote(payNote), [payNote]);

  const save = async (patch: { pay_mode?: "app" | "self"; pay_note?: string | null }) => {
    const { error } = await coachesAPI.updateCoach(coachId, patch);
    if (error) throw new Error(error.message);
    queryClient.invalidateQueries({ queryKey: ["coach-details"] });
  };

  const choose = async (next: "app" | "self") => {
    if (next === mode) return;
    const previous = mode;
    setMode(next);
    try {
      await save({ pay_mode: next });
      toast({
        title: next === "self" ? "Booking only is on" : "Families pay through AthaNext again",
        description: "Only new bookings change. Sessions already paid in AthaNext stay as they are.",
        duration: 10000,
        action: (
          <ToastAction
            altText="Undo"
            onClick={() => {
              setMode(previous);
              void save({ pay_mode: previous }).catch(() => undefined);
            }}
          >
            Undo
          </ToastAction>
        ),
      });
    } catch (err) {
      setMode(previous);
      toast({ title: "Couldn't save", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  return (
    <Card icon={<Wallet className="size-5 text-[#767980]" strokeWidth={1.5} />} title="How families pay">
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="How families pay">
        {PAY_MODES.map((option) => {
          const on = mode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => void choose(option.value)}
              className={cn(
                "flex items-start gap-3 rounded-[8px] border px-4 py-3 text-left transition-colors",
                on ? "border-[#CCDDF0] bg-[#E5EDF7]" : "border-[#EAEADF] bg-[#F9F9F5] hover:bg-[#F4F4EB]"
              )}
            >
              <span
                className={cn("mt-[3px] size-3 shrink-0 rounded-full border bg-white", on ? "border-[3px] border-[#0054B4]" : "border-[#C1C1B8]")}
                aria-hidden="true"
              />
              <span className="flex flex-col gap-1">
                <b className="text-[14px] font-medium">{option.title}</b>
                <span className={meta}>{option.detail}</span>
              </span>
            </button>
          );
        })}
      </div>
      {mode === "self" ? (
        <Field label="How families pay you (optional)" hint="Shown to families when they book. AthaNext doesn't charge or track these payments.">
          <input
            className={input}
            value={note}
            maxLength={200}
            placeholder="For example, Venmo @your-name or cash at the session"
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if (note.trim() === payNote.trim()) return;
              save({ pay_note: note.trim() || null })
                .then(() => toast({ title: "Saved" }))
                .catch(() => toast({ title: "Couldn't save the note", variant: "destructive" }));
            }}
          />
        </Field>
      ) : (
        <p className={meta}>AthaNext never stores your card or bank details.</p>
      )}
    </Card>
  );
};

const BookingTab = ({ coachId, payMode, payNote }: { coachId: string; payMode: "app" | "self"; payNote: string }) => {
  const today = getZonedISODate(new Date(), "America/New_York");
  const schedule = useQuery({ queryKey: ["coach-schedule", today, today], queryFn: () => scheduleAPI.get(today, today) });

  return (
    <>
      <HowFamiliesPay coachId={coachId} payMode={payMode} payNote={payNote} />
      <Card icon={<CalendarSync className="size-5 text-[#767980]" strokeWidth={1.5} />} title="Booking and calendar">
        {schedule.isLoading ? <p className={meta}>Loading…</p> : null}
        <BookingRulesSection rules={schedule.data?.rules} />
        <div className="h-px bg-[#EAEADF]" />
        <CalendarSyncSection calendar={schedule.data?.calendar ?? null} />
      </Card>
    </>
  );
};

/* ---------- Privacy and safety ---------- */

const PrivacyTab = ({ coachId, listed }: { coachId: string; listed: boolean }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [on, setOn] = useState(listed);
  useEffect(() => setOn(listed), [listed]);

  const setListed = async (next: boolean) => {
    setOn(next);
    const { error } = await coachesAPI.updateCoach(coachId, { listed: next });
    if (error) {
      setOn(!next);
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["coach-details"] });
    toast({ title: next ? "Your profile is on the marketplace" : "Hidden from the marketplace. Families you invite can still book" });
  };

  const exportData = useMutation({
    mutationFn: async () => {
      const [coachRow, profileRow, packages, sessions, bookings, clients, reviews] = await Promise.all([
        supabase.from("coaches").select("*").eq("id", coachId).maybeSingle(),
        supabase.from("user_profiles").select("*").eq("id", user!.id).maybeSingle(),
        supabase.from("coach_packages").select("*").eq("coach_id", coachId),
        supabase.from("coach_availability_slot_occurrences").select("*").eq("coach_id", coachId),
        supabase.from("coach_slot_bookings").select("*").eq("coach_id", coachId),
        supabase.from("coach_client_referrals").select("*").eq("coach_id", coachId),
        supabase.from("coach_reviews").select("*").eq("coach_id", coachId),
      ]);
      downloadJson(
        {
          exported_at: new Date().toISOString(),
          coach: coachRow.data,
          account: profileRow.data,
          packages: packages.data ?? [],
          sessions: sessions.data ?? [],
          bookings: bookings.data ?? [],
          clients: clients.data ?? [],
          reviews: reviews.data ?? [],
        },
        `athanext-data-${new Date().toISOString().slice(0, 10)}.json`
      );
    },
    onSuccess: () => toast({ title: "Your data is downloading" }),
    onError: () => toast({ title: "Couldn't download your data", description: "Please try again.", variant: "destructive" }),
  });

  return (
    <Card icon={<ShieldCheck className="size-5 text-[#767980]" strokeWidth={1.5} />} title="Privacy and safety">
      <div className="flex items-start gap-2 rounded-[8px] bg-[#F1F1E6] px-3 py-2.5">
        <Lock className="mt-[1px] size-4 shrink-0 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
        <span className={sub}>
          Athlete profiles are visible only to you and the account holder. Never upload photos of minors without parent consent.
        </span>
      </div>
      <ToggleRow
        title="Show my profile on the marketplace"
        detail="Turn off to only work with families you invite"
        checked={on}
        onChange={setListed}
        ariaLabel="Show my profile on the marketplace"
      />
      <button type="button" className={cn(secondaryButton, "self-start")} disabled={exportData.isPending} onClick={() => exportData.mutate()}>
        <Download strokeWidth={1.5} aria-hidden="true" />
        {exportData.isPending ? "Preparing…" : "Download my data"}
      </button>
    </Card>
  );
};

/* ---------- Password and account ---------- */

export const SecurityTab = ({ danger }: { danger: ReactNode }) => {
  const { user, changePassword, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const provider = (user?.app_metadata as { provider?: string } | undefined)?.provider || user?.identities?.[0]?.provider;
  const canChangePassword = provider === "email" || provider === "password";

  const [pwOpen, setPwOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const strength = passwordStrength(next);


  const resetPw = () => {
    setPwOpen(false);
    setCurrent("");
    setNext("");
    setConfirm("");
    setPwError(null);
  };

  const updatePassword = useMutation({
    mutationFn: async () => {
      const { error } = await changePassword(current, next);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      resetPw();
      toast({ title: "Password updated", description: "You'll be signed out so you can sign in with it." });
      setTimeout(async () => {
        await signOut();
        navigate(ROUTES.AUTH);
      }, 2500);
    },
    onError: (err) => setPwError(err instanceof Error ? err.message : "Couldn't update your password"),
  });

  const submitPassword = () => {
    if (!current) return setPwError("Enter your current password");
    if (strength.score < 3) return setPwError("Use 8 or more characters with a number and a symbol");
    if (next !== confirm) return setPwError("Passwords don't match");
    setPwError(null);
    updatePassword.mutate();
  };

  const signOutOthers = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
    },
    onSuccess: () => toast({ title: "Signed out of your other devices" }),
    onError: () => toast({ title: "Couldn't sign out other devices", variant: "destructive" }),
  });

  const passwordInput = (id: string, text: string, value: string, onChange: (v: string) => void, auto: string) => (
    <Field label={text}>
      <input id={id} className={input} type="password" value={value} onChange={(e) => onChange(e.target.value)} autoComplete={auto} />
    </Field>
  );

  return (
    <>
      <Card icon={<Lock className="size-5 text-[#767980]" strokeWidth={1.5} />} title="Password">
        {!canChangePassword ? (
          <p className={sub}>You sign in with {provider === "google" ? "Google" : "a connected account"}, so there's no AthaNext password to change.</p>
        ) : pwOpen ? (
          <div className="flex flex-col gap-3">
            {passwordInput("pw-current", "Current password", current, setCurrent, "current-password")}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {passwordInput("pw-new", "New password", next, setNext, "new-password")}
              {passwordInput("pw-confirm", "Confirm new password", confirm, setConfirm, "new-password")}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-[#EAEADF]" aria-hidden="true">
                <div
                  className={cn("h-full rounded-full transition-all", strength.score < 2 ? "bg-[#E05A5A]" : strength.score < 3 ? "bg-[#E0A23A]" : "bg-[#1E7431]")}
                  style={{ width: `${strength.score * 25}%` }}
                />
              </div>
              <span className={meta} aria-live="polite">{strength.hint}</span>
            </div>
            {pwError ? <p role="alert" className="text-[14px] text-[#972B2B]">{pwError}</p> : null}
            <div className="flex gap-2">
              <button type="button" className={primaryButton} onClick={submitPassword} disabled={updatePassword.isPending}>
                {updatePassword.isPending ? "Updating…" : "Update password"}
              </button>
              <button type="button" className={secondaryButton} onClick={resetPw}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className={sub}>Signed in as {user?.email}</span>
            <button type="button" className={secondaryButton} onClick={() => setPwOpen(true)}>Change password</button>
          </div>
        )}
      </Card>

      <Card icon={<LogOut className="size-5 text-[#767980]" strokeWidth={1.5} />} title="Sessions">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={sub}>Signed in somewhere you don't recognize?</span>
          <button type="button" className={secondaryButton} disabled={signOutOthers.isPending} onClick={() => signOutOthers.mutate()}>
            Sign out other devices
          </button>
        </div>
      </Card>

      {danger}
    </>
  );
};

/** A red card whose action needs a word typed to confirm (DEACTIVATE for coaches, DELETE for athletes). */
export const ConfirmWordCard = ({
  title,
  body,
  word,
  actionLabel,
  pending,
  onConfirm,
}: {
  title: string;
  body: string;
  word: string;
  actionLabel: string;
  pending: boolean;
  onConfirm: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  return (
    <Card title={title} className="border-[#FDB5B5]">
      <p className={sub}>{body}</p>
      {open ? (
        <div className="flex flex-col gap-2">
          <span className={label}>Type {word} to confirm</span>
          <div className="flex flex-wrap gap-2">
            <input
              className={cn(input, "max-w-[220px]")}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={word}
              aria-label={`Type ${word} to confirm`}
              autoFocus
            />
            <button type="button" className={dangerButton} disabled={typed.trim() !== word || pending} onClick={onConfirm}>
              {actionLabel}
            </button>
            <button type="button" className={secondaryButton} onClick={() => { setOpen(false); setTyped(""); }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={cn(dangerButton, "self-start")} onClick={() => setOpen(true)}>
          {actionLabel}
        </button>
      )}
    </Card>
  );
};

const DeactivateCard = ({ coachId }: { coachId: string }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deactivate = useMutation({
    mutationFn: async () => {
      const { error } = await coachesAPI.updateCoach(coachId, { deactivated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-details"] });
      toast({ title: "Account deactivated", description: "Families can no longer book you. Reactivate any time from here." });
    },
    onError: (err) => toast({ title: "Couldn't deactivate", description: err instanceof Error ? err.message : undefined, variant: "destructive" }),
  });
  return (
    <ConfirmWordCard
      title="Deactivate account"
      body="Your profile leaves the marketplace and families can no longer book you. Upcoming sessions stay on your calendar until you cancel them."
      word={DEACTIVATE_WORD}
      actionLabel="Deactivate account"
      pending={deactivate.isPending}
      onConfirm={() => deactivate.mutate()}
    />
  );
};

const DeactivatedBanner = ({ coachId }: { coachId: string }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const reactivate = useMutation({
    mutationFn: async () => {
      const { error } = await coachesAPI.updateCoach(coachId, { deactivated_at: null });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-details"] });
      toast({ title: "Welcome back", description: "Families can book you again." });
    },
    onError: () => toast({ title: "Couldn't reactivate", variant: "destructive" }),
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#FDB5B5] bg-[#FEECEC] px-4 py-3">
      <span className="text-[14px] leading-[18px] text-[#972B2B]">
        <b className="font-medium">Your account is deactivated.</b> You're off the marketplace and families can't book you.
      </span>
      <button type="button" className={primaryButton} disabled={reactivate.isPending} onClick={() => reactivate.mutate()}>
        Reactivate
      </button>
    </div>
  );
};
