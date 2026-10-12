/**
 * Coach Account Settings (ATH-87 + ATH-102/103 Plan tab). Tabs edit in place: Account,
 * Notifications, Booking and calendar, Plan, Privacy and safety, Password and account.
 * Account fields show a save bar once something changes; switches save as soon as they flip.
 * AthaNext stores no card or bank details; payouts and the $29 plan are set up on Stripe's pages.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Bell, CalendarSync, CreditCard, Download, Eye, EyeOff, Lock, LogOut, ShieldCheck, User, Wallet } from "lucide-react";
import { coachesAPI, userProfilesAPI } from "@/api";
import { scheduleAPI } from "@/api/schedule";
import { BookingRulesSection, CalendarSyncSection } from "@/components/schedule/BookingSettings";
import { card, dangerButton, input, label, meta, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { TimeZoneSelect } from "@/components/common/TimeZoneSelect";
import { Switch } from "@/components/ui/switch";
import { LegalCard } from "@/components/legal/LegalLinks";
import { CoachPlanCard } from "@/components/settings/CoachPlanCard";
import { PayoutsCard } from "@/components/settings/PayoutsCard";
import { useAuth } from "@/contexts/AuthContext";
import { PASSWORD_RULE_MESSAGE, usePasswordValidation } from "@/hooks/usePasswordValidation";
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
  activeOfflineMethods,
  OFFLINE_METHODS,
  parseOfflinePay,
  type OfflineMethodKey,
  type OfflinePay,
} from "@/utils/offlinePay";
import {
  COACH_NOTIFICATIONS,
  DEACTIVATE_WORD,
  joinName,
  notificationOn,
  passwordStrength,
  splitName,
  type NotificationChannel,
} from "@/utils/settings";

type Tab = "account" | "notifications" | "booking" | "plan" | "privacy" | "security" | "legal";

const TABS: [Tab, string][] = [
  ["account", "Account"],
  ["notifications", "Notifications"],
  ["booking", "Booking and calendar"],
  ["plan", "Plan"],
  ["privacy", "Privacy and safety"],
  ["security", "Password and account"],
  ["legal", "Legal"],
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
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
        <header className="flex flex-col gap-[10px]">
          <h1 className="text-[26px] md:text-[32px] font-bold leading-[26px] md:leading-[28px] tracking-[-1.6px] text-[#1A202C]">Account Settings</h1>
          <p className="text-[16px] leading-[18px] text-[#767980]">{subtitle}</p>
        </header>

        {banner}

        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
          <nav className={cn(card, "gap-3 p-[18px] md:p-[22px]")} aria-label="Settings">
            <span className={cn(label, "px-0")}>Settings</span>
            <div className="flex gap-1 overflow-x-auto md:flex-col">
              {tabs.map(([key, text]) => (
                <button
                  key={key}
                  type="button"
                  aria-current={tab === key ? "page" : undefined}
                  onClick={() => openTab(key)}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-[8px] px-3 py-2 text-left text-[14px] font-medium leading-[18px] tracking-[-0.42px] transition-colors",
                    tab === key ? "bg-[#F4F4EB] text-[#1A202C]" : "text-[#767980] hover:bg-[#F1F1E6] hover:text-[#1A202C]"
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
      subtitle="Account, notifications, booking, plan and calendar."
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
              offlinePay={(coach as { offline_pay?: unknown } | undefined)?.offline_pay}
            />
          ) : null}
          {tab === "plan" ? <CoachPlanCard /> : null}
          {tab === "privacy" && coachId ? <PrivacyTab coachId={coachId} listed={(coach as { listed?: boolean } | undefined)?.listed !== false} /> : null}
          {tab === "security" && coachId ? (
            <SecurityTab danger={!deactivated ? <DeactivateCard coachId={coachId} /> : null} />
          ) : null}
          {tab === "legal" ? <LegalCard role="coach" /> : null}
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

/** Card always on; optional offline pay for invited clients (WC4). */
const HowFamiliesPay = ({ coachId, offlinePay }: { coachId: string; offlinePay: unknown }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pay, setPay] = useState<OfflinePay>(() => parseOfflinePay(offlinePay));
  useEffect(() => setPay(parseOfflinePay(offlinePay)), [offlinePay]);

  const save = async (next: OfflinePay) => {
    const { error } = await coachesAPI.updateCoach(coachId, {
      offline_pay: next as unknown as Json,
      pay_mode: "app",
      pay_note: next.note.trim() || null,
    });
    if (error) throw new Error(error.message);
    queryClient.invalidateQueries({ queryKey: ["coach-details"] });
    queryClient.invalidateQueries({ queryKey: ["coach-pay-mode"] });
  };

  const patch = async (next: OfflinePay, okTitle?: string) => {
    const previous = pay;
    setPay(next);
    try {
      await save(next);
      if (okTitle) toast({ title: okTitle });
    } catch (err) {
      setPay(previous);
      toast({ title: "Couldn't save", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  const ready = activeOfflineMethods(pay).length > 0;
  const row = (key: OfflineMethodKey) => {
    const def = OFFLINE_METHODS.find((m) => m.key === key)!;
    const m = pay.methods[key];
    const missing = m.on && def.needsHandle && !m.handle.trim();
    return (
      <div key={key} className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[14px] font-medium">
            <input
              type="checkbox"
              className="size-4 rounded border-[#C1C1B8]"
              checked={m.on}
              onChange={(e) => {
                const next = {
                  ...pay,
                  methods: { ...pay.methods, [key]: { ...m, on: e.target.checked } },
                };
                void patch(next);
              }}
            />
            {def.label}
          </label>
          {def.needsHandle ? (
            <input
              className={cn(input, "min-w-0 flex-1", missing ? "border-[#E05A5A]" : "")}
              value={m.handle}
              disabled={!m.on}
              placeholder={def.placeholder}
              maxLength={80}
              aria-label={`${def.label} ${def.placeholder}`}
              onChange={(e) => setPay({ ...pay, methods: { ...pay.methods, [key]: { ...m, handle: e.target.value } } })}
              onBlur={() => {
                const saved = parseOfflinePay(offlinePay).methods[key].handle;
                if (m.handle.trim() === saved.trim()) return;
                void patch(pay);
              }}
            />
          ) : (
            <span className={cn(meta, "grow")}>Paid in person at the session</span>
          )}
        </div>
        {missing ? (
          <span className="text-[12px] text-[#972B2B]">
            Add your {def.label} {key === "venmo" ? "username" : "email or phone number"} so families know where to send it
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <Card icon={<Wallet className="size-5 text-[#767980]" strokeWidth={1.5} />} title="How families pay">
      <div className="flex items-start gap-3 rounded-[8px] border border-[#EAEADF] bg-[#F9F9F5] px-4 py-3">
        <CreditCard className="mt-0.5 size-5 flex-none text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
        <span className="flex min-w-0 grow flex-col gap-1">
          <b className="text-[14px] font-medium">Card and Apple Pay</b>
          <span className={meta}>
            Families pay when they book. A payment processing fee of 2.9% + $0.30 is added at checkout as its own line. Stripe pays you out.
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-[#EAEADF] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#484D56]">
          Always on
        </span>
      </div>
      <div className="flex items-start gap-3 rounded-[8px] border border-[#EAEADF] bg-[#F9F9F5] px-4 py-3">
        <Banknote className="mt-0.5 size-5 flex-none text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
        <span className="flex min-w-0 grow flex-col gap-1">
          <b className="text-[14px] font-medium">Offline payment</b>
          <span className={meta}>
            Let your existing clients choose to pay you directly. They pay your price with no processing fee, and AthaNext doesn&apos;t handle the
            money.
          </span>
        </span>
        <Switch
          checked={pay.on}
          aria-label="Offline payment"
          onCheckedChange={(on) => {
            const next = { ...pay, on };
            void patch(next, on ? "Families can now choose to pay you directly" : "Offline payment is off. Families pay by card");
          }}
        />
      </div>
      {pay.on ? (
        <>
          <div className="flex flex-col gap-3">
            <span className={label}>Methods you accept</span>
            {OFFLINE_METHODS.map((m) => row(m.key))}
          </div>
          <Field label="Note for families (optional)">
            <input
              className={input}
              value={pay.note}
              maxLength={200}
              placeholder="For example, please pay before the session starts"
              onChange={(e) => setPay({ ...pay, note: e.target.value })}
              onBlur={() => {
                if (pay.note.trim() === parseOfflinePay(offlinePay).note.trim()) return;
                void patch(pay, "Saved");
              }}
            />
          </Field>
          {ready ? (
            <>
              <p className={cn(meta, "rounded-[8px] bg-[#F4F4EB] px-3 py-2")}>
                Only families you invited see this option. Marketplace families always pay by card in AthaNext.
              </p>
              <p className={cn(meta, "rounded-[8px] bg-[#F4F4EB] px-3 py-2")}>
                Offline payments show as pending until you confirm you received them. The session itself is booked right away.
              </p>
            </>
          ) : (
            <p className={cn(meta, "rounded-[8px] bg-[#F7F0E0] px-3 py-2 text-[#906A29]")}>
              Turn on at least 1 method to offer offline payment. Until then, families only see card at checkout.
            </p>
          )}
        </>
      ) : null}
    </Card>
  );
};

const BookingTab = ({ coachId, offlinePay }: { coachId: string; offlinePay: unknown }) => {
  const today = getZonedISODate(new Date(), "America/New_York");
  const schedule = useQuery({ queryKey: ["coach-schedule", today, today], queryFn: () => scheduleAPI.get(today, today) });

  return (
    <>
      <HowFamiliesPay coachId={coachId} offlinePay={offlinePay} />
      <PayoutsCard />
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
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const strength = passwordStrength(next);
  // The same rules as sign-up: upper and lower case, a number and a symbol.
  const { allValid: meetsRules } = usePasswordValidation(next);


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
    if (!meetsRules) return setPwError(PASSWORD_RULE_MESSAGE.replace("New password", "Your new password"));
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

  const passwordInput = (
    id: string,
    text: string,
    value: string,
    onChange: (v: string) => void,
    auto: string,
    show: boolean,
    onToggle: () => void
  ) => (
    <Field label={text}>
      <div className="relative">
        <input
          id={id}
          className={cn(input, "pr-10")}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={auto}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute inset-y-0 right-2 flex items-center rounded-[4px] text-[#767980] hover:text-[#1A202C]"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
        </button>
      </div>
    </Field>
  );

  return (
    <>
      <Card icon={<Lock className="size-5 text-[#767980]" strokeWidth={1.5} />} title="Password">
        {!canChangePassword ? (
          <p className={sub}>You sign in with {provider === "google" ? "Google" : "a connected account"}, so there's no AthaNext password to change.</p>
        ) : pwOpen ? (
          <div className="flex flex-col gap-3">
            {passwordInput("pw-current", "Current password", current, setCurrent, "current-password", showCurrent, () => setShowCurrent((v) => !v))}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {passwordInput("pw-new", "New password", next, setNext, "new-password", showNext, () => setShowNext((v) => !v))}
              {passwordInput("pw-confirm", "Confirm new password", confirm, setConfirm, "new-password", showConfirm, () => setShowConfirm((v) => !v))}
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
