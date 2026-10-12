/**
 * Athlete Account Settings (ATH-91): Parent or guardian (or Account for athletes 18+),
 * Notifications, Privacy and safety, Password and account. The Athlete and Payment methods
 * tabs are gone: athlete details live on Home, and nothing about cards is saved here.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Download, Lock, Plus, ShieldCheck, User, UserPlus } from "lucide-react";
import { userProfilesAPI } from "@/api";
import { BrandPill } from "@/components/brand";
import { TimeZoneSelect } from "@/components/common/TimeZoneSelect";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dialogContent, input, label, meta, primaryButton, secondaryButton, smallButton } from "@/components/schedule/styles";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { ATHLETE_NOTIFICATIONS, DELETE_WORD, DELETION_GRACE_DAYS } from "@/utils/settings";
import { downloadJson } from "@/utils/download";
import { LegalCard } from "@/components/legal/LegalLinks";
import { Card, ConfirmWordCard, Field, NotificationsTab, SecurityTab, SettingsShell, ToggleRow, sub } from "./CoachSettings";

type Tab = "account" | "notifications" | "privacy" | "security" | "legal";
const RELATIONSHIPS = ["Parent", "Guardian", "Other family member"] as const;

type ProfileExtras = {
  name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  persona_type?: string | null;
  guardian_relationship?: string | null;
  deletion_requested_at?: string | null;
};

export const AthleteSettings = () => {
  const { userProfile } = useAuth();
  const { profile } = useProfile();
  const extras = (userProfile ?? {}) as ProfileExtras;
  const isParent = extras.persona_type === "parent";
  const athlete = profile?.type === "athlete" ? (profile.data as { id?: string; full_name?: string | null }) : null;
  const athleteFirst = (athlete?.full_name || "your athlete").split(" ")[0];
  const [dirty, setDirty] = useState(false);

  const tabs: [Tab, string][] = [
    ["account", isParent ? "Parent or guardian" : "Account"],
    ["notifications", "Notifications"],
    ["privacy", "Privacy and safety"],
    ["security", "Password and account"],
    ["legal", "Legal"],
  ];

  return (
    <SettingsShell<Tab>
      subtitle={isParent ? `${athleteFirst}'s account, managed by ${extras.name || "you"}. Edit anything right here.` : "Your account, notifications and privacy."}
      tabs={tabs}
      defaultTab="account"
      dirty={dirty}
      onDiscard={() => setDirty(false)}
      banner={extras.deletion_requested_at ? <DeletionBanner requestedAt={extras.deletion_requested_at} /> : null}
      render={(tab) => (
        <>
          {tab === "account" ? <AccountTab isParent={isParent} athleteFirst={athleteFirst} parentName={extras.name || "you"} onDirtyChange={setDirty} /> : null}
          {tab === "notifications" ? (
            <NotificationsTab kinds={ATHLETE_NOTIFICATIONS} caption="Email on the web app, push on the mobile app. Safety messages always come through." />
          ) : null}
          {tab === "privacy" ? <PrivacyTab athleteId={athlete?.id} athleteFirst={athleteFirst} isParent={isParent} /> : null}
          {tab === "security" ? (
            <SecurityTab danger={extras.deletion_requested_at ? null : <DeleteCard isParent={isParent} athleteFirst={athleteFirst} />} />
          ) : null}
          {tab === "legal" ? <LegalCard role="athlete" /> : null}
        </>
      )}
    />
  );
};

/* ---------- Parent or guardian / Account ---------- */

type Draft = { name: string; relationship: string; phone: string };

const AccountTab = ({ isParent, athleteFirst, parentName, onDirtyChange }: {
  isParent: boolean;
  athleteFirst: string;
  parentName: string;
  onDirtyChange: (dirty: boolean) => void;
}) => {
  const { user, userProfile, refreshUserProfile, setUserName } = useAuth();
  const { toast } = useToast();
  const extras = (userProfile ?? {}) as ProfileExtras;
  const saved = useMemo<Draft>(
    () => ({ name: extras.name ?? "", relationship: extras.guardian_relationship ?? "Parent", phone: extras.phone_number ?? "" }),
    [extras.name, extras.guardian_relationship, extras.phone_number]
  );
  const [draft, setDraft] = useState<Draft>(saved);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  useEffect(() => setDraft(saved), [saved]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sign in again to save");
      const { error } = await userProfilesAPI.updateUserProfile(user.id, {
        name: draft.name.trim(),
        phone_number: draft.phone.trim() || null,
        ...(isParent ? { guardian_relationship: draft.relationship } : {}),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      if (!isParent) setUserName(draft.name.trim());
      await refreshUserProfile();
      toast({ title: "Changes saved" });
    },
    onError: (err) => toast({ title: "Couldn't save", description: err instanceof Error ? err.message : undefined, variant: "destructive" }),
  });

  const submit = () => {
    const next: typeof errors = {};
    if (!draft.name.trim()) next.name = "Required";
    if (draft.phone.trim() && draft.phone.replace(/\D/g, "").length < 10) next.phone = "Enter a full phone number";
    setErrors(next);
    if (!Object.keys(next).length) save.mutate();
  };

  return (
    <>
    <Card icon={<User className="size-5 text-[#767980]" strokeWidth={1.5} />} title={isParent ? "Parent or guardian" : "Account"}>
      {isParent ? (
        <div className="-mt-1 flex flex-wrap items-center gap-2">
          <BrandPill tone="blue">Account holder</BrandPill>
        </div>
      ) : null}
      {isParent ? (
        <div className="flex items-start gap-2 rounded-[8px] bg-[#F1F1E6] px-3 py-2.5">
          <ShieldCheck className="mt-[1px] size-4 shrink-0 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
          <span className={sub}>
            {athleteFirst} is under 18, so {parentName} holds the account. {parentName} is part of every message about {athleteFirst} and sees session notes. No separate parent login is needed.
          </span>
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" error={errors.name}>
          <input
            className={input}
            value={draft.name}
            onChange={(e) => { setDraft((d) => ({ ...d, name: e.target.value })); setErrors((x) => ({ ...x, name: undefined })); }}
            autoComplete="name"
          />
        </Field>
        {isParent ? (
          <Field label="Relationship">
            <select className={input} value={draft.relationship} onChange={(e) => setDraft((d) => ({ ...d, relationship: e.target.value }))}>
              {RELATIONSHIPS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Email" hint="Sign-in email and receipts">
          <input className={cn(input, "text-[#767980]")} value={extras.email || user?.email || ""} readOnly />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <input
            className={input}
            type="tel"
            value={draft.phone}
            onChange={(e) => { setDraft((d) => ({ ...d, phone: e.target.value })); setErrors((x) => ({ ...x, phone: undefined })); }}
            autoComplete="tel"
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className={label}>Time zone</span>
          <TimeZoneSelect className="h-[38px] w-full rounded-[8px] border-[#EAEADF] bg-[#F9F9F5]" />
          <span className={meta}>Saves straight away. Session times show in this zone.</span>
        </div>
      </div>
      <p className={meta}>
        {isParent ? `${athleteFirst}'s` : "Your"} details (name, birthday, position, team) are on{" "}
        <Link to={ROUTES.DASHBOARD} className="font-medium text-[#0054B4] hover:underline">Home</Link>.
      </p>
      {isParent ? <ReceiptsToggle name={parentName} /> : null}
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
    {isParent ? <GuardianCard athleteFirst={athleteFirst} holder={parentName} /> : null}
  </>
  );
};

const prefKey = (kind: string, id: string) => `athanext.pref.${kind}.${id}`;
const readPref = (kind: string, id: string, fallback = false) => {
  try {
    const raw = localStorage.getItem(prefKey(kind, id));
    return raw == null ? fallback : raw === "1";
  } catch {
    return fallback;
  }
};
const writePref = (kind: string, id: string, value: boolean) => {
  try {
    localStorage.setItem(prefKey(kind, id), value ? "1" : "0");
  } catch {
    /* ignore */
  }
};

const ReceiptsToggle = ({ name }: { name: string }) => {
  const { user } = useAuth();
  const id = user?.id || "me";
  const [on, setOn] = useState(() => readPref("receipts", id, true));
  return (
    <ToggleRow
      title="Copy on receipts and reminders"
      detail={`Send booking receipts and session reminders to ${name}`}
      checked={on}
      onChange={(next) => {
        setOn(next);
        writePref("receipts", id, next);
      }}
      ariaLabel="Copy on receipts"
    />
  );
};

type Invite = { name: string; email: string; rel: string };
const invitesKey = (id: string) => `athanext.guardians.${id}`;
const readInvites = (id: string): Invite[] => {
  try {
    const raw = localStorage.getItem(invitesKey(id));
    return raw ? (JSON.parse(raw) as Invite[]) : [];
  } catch {
    return [];
  }
};

const GuardianCard = ({ athleteFirst, holder }: { athleteFirst: string; holder: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const id = user?.id || "me";
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Invite[]>(() => readInvites(id));
  const [form, setForm] = useState({ name: "", email: "", rel: "Parent" });
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const persist = (next: Invite[]) => {
    setList(next);
    try {
      localStorage.setItem(invitesKey(id), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const send = () => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Enter a valid email";
    setErrors(next);
    if (Object.keys(next).length) return;
    persist([...list, { name: form.name.trim(), email: form.email.trim(), rel: form.rel }]);
    setOpen(false);
    setForm({ name: "", email: "", rel: "Parent" });
    toast({ title: "Invite sent" });
  };

  return (
    <>
      <Card icon={<UserPlus className="size-5 text-[#767980]" strokeWidth={1.5} />} title="Second guardian">
        <p className={sub}>Add another parent or guardian who can book and message coaches for {athleteFirst}.</p>
        <button type="button" className={cn(secondaryButton, smallButton, "self-start")} onClick={() => setOpen(true)}>
          <Plus strokeWidth={1.5} aria-hidden="true" />
          Invite a guardian
        </button>
        {list.map((g) => (
          <div key={g.email} className="flex items-center gap-2.5 rounded-[8px] bg-[#F1F1E6] px-3 py-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#E5EDF7] text-[12px] font-medium text-[#0054B4]">
              {g.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "G"}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[14px] font-medium">{g.name}</span>
              <span className={meta}>{g.email} · invite sent</span>
            </span>
            <button
              type="button"
              className="text-[14px] font-medium text-[#767980] hover:text-[#1A202C]"
              onClick={() => {
                persist(list.filter((x) => x.email !== g.email));
                toast({ title: "Guardian removed" });
              }}
            >
              Remove
            </button>
          </div>
        ))}
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={dialogContent}>
          <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
            <DialogTitle className="text-[22px] font-semibold leading-[28px] tracking-[-0.05em]">Invite a guardian</DialogTitle>
            <DialogDescription className={meta}>
              They can book, pay and message coaches for {athleteFirst}. {holder} stays the account holder.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 px-5 pb-5 sm:px-[25px]">
            <Field label="Full name" error={errors.name}>
              <input className={input} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Email" error={errors.email}>
              <input className={input} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </Field>
            <Field label="Relationship">
              <select className={input} value={form.rel} onChange={(e) => setForm((f) => ({ ...f, rel: e.target.value }))}>
                {RELATIONSHIPS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className={secondaryButton} onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className={primaryButton} onClick={send}>Send invite</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

/* ---------- Privacy and safety ---------- */

const PrivacyTab = ({ athleteId, athleteFirst, isParent }: { athleteId?: string; athleteFirst: string; isParent: boolean }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const whose = isParent ? `${athleteFirst}'s` : "your";

  const exportData = useMutation({
    mutationFn: async () => {
      const [account, athlete, bookings, notes, coaches] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("id", user!.id).maybeSingle(),
        athleteId ? supabase.from("athlete_profiles").select("*").eq("id", athleteId).maybeSingle() : Promise.resolve({ data: null }),
        athleteId ? supabase.from("coach_slot_bookings").select("*").eq("athlete_id", athleteId) : Promise.resolve({ data: [] }),
        athleteId ? supabase.from("slot_feedback_v2").select("*").eq("athlete_id", athleteId) : Promise.resolve({ data: [] }),
        athleteId ? supabase.from("coach_client_referrals").select("*").eq("athlete_id", athleteId) : Promise.resolve({ data: [] }),
      ]);
      downloadJson(
        {
          exported_at: new Date().toISOString(),
          account: account.data,
          athlete: athlete.data,
          bookings: bookings.data ?? [],
          session_notes: notes.data ?? [],
          coaches: coaches.data ?? [],
        },
        `athanext-data-${new Date().toISOString().slice(0, 10)}.json`
      );
    },
    onSuccess: () => toast({ title: "Your data is downloading" }),
    onError: () => toast({ title: "Couldn't download the data", description: "Please try again.", variant: "destructive" }),
  });

  return (
    <Card icon={<ShieldCheck className="size-5 text-[#767980]" strokeWidth={1.5} />} title="Privacy and safety">
      <HideNameToggle athleteFirst={athleteFirst} storageId={athleteId || user?.id || "me"} />
      <div className="flex items-start gap-2 rounded-[8px] bg-[#F1F1E6] px-3 py-2.5">
        <Lock className="mt-[1px] size-4 shrink-0 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
        <span className={sub}>
          {isParent
            ? `${athleteFirst}'s profile is visible only to you and ${athleteFirst}'s coaches. No photos of athletes are shown on AthaNext.`
            : "Your profile is visible only to you and your coaches. No photos of athletes are shown on AthaNext."}
        </span>
      </div>
      <button type="button" className={cn(secondaryButton, "self-start")} disabled={exportData.isPending} onClick={() => exportData.mutate()}>
        <Download strokeWidth={1.5} aria-hidden="true" />
        {exportData.isPending ? "Preparing…" : `Download ${whose} data`}
      </button>
    </Card>
  );
};

const HideNameToggle = ({ athleteFirst, storageId }: { athleteFirst: string; storageId: string }) => {
  const [on, setOn] = useState(() => readPref("hideRoster", storageId, false));
  return (
    <ToggleRow
      title={`Keep ${athleteFirst}'s name private in group sessions`}
      detail="Other athletes see a spot count, not names"
      checked={on}
      onChange={(next) => {
        setOn(next);
        writePref("hideRoster", storageId, next);
      }}
      ariaLabel="Hide name in groups"
    />
  );
};

/* ---------- Delete account ---------- */

const deletionDate = (requestedAt: string) =>
  new Date(new Date(requestedAt).getTime() + DELETION_GRACE_DAYS * 86_400_000).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const DeleteCard = ({ isParent, athleteFirst }: { isParent: boolean; athleteFirst: string }) => {
  const { user, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  const request = useMutation({
    mutationFn: async () => {
      const { error } = await userProfilesAPI.updateUserProfile(user!.id, { deletion_requested_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await refreshUserProfile();
      toast({ title: "Account deletion scheduled", description: `You can undo it from here for ${DELETION_GRACE_DAYS} days.` });
    },
    onError: (err) => toast({ title: "Couldn't schedule deletion", description: err instanceof Error ? err.message : undefined, variant: "destructive" }),
  });
  return (
    <ConfirmWordCard
      title="Delete account"
      body={`Deletes ${isParent ? `${athleteFirst}'s` : "your"} account and personal details ${DELETION_GRACE_DAYS} days after you ask, and cancels upcoming sessions. Coaches keep a record of past sessions without the name. Sign in before then to undo.`}
      word={DELETE_WORD}
      actionLabel="Delete account"
      pending={request.isPending}
      onConfirm={() => request.mutate()}
    />
  );
};

const DeletionBanner = ({ requestedAt }: { requestedAt: string }) => {
  const { user, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  const undo = useMutation({
    mutationFn: async () => {
      const { error } = await userProfilesAPI.updateUserProfile(user!.id, { deletion_requested_at: null });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await refreshUserProfile();
      toast({ title: "Account restored" });
    },
    onError: () => toast({ title: "Couldn't undo", variant: "destructive" }),
  });
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#FDB5B5] bg-[#FEECEC] px-4 py-3">
      <span className="text-[14px] leading-[18px] text-[#972B2B]">
        <b className="font-medium">This account is scheduled for deletion on {deletionDate(requestedAt)}.</b>
      </span>
      <button type="button" className={primaryButton} disabled={undo.isPending} onClick={() => undo.mutate()}>
        Undo
      </button>
    </div>
  );
};
