/**
 * Athlete Account Settings (ATH-91): Parent or guardian (or Account for athletes 18+),
 * Notifications, Privacy and safety, Password and account. The Athlete and Payment methods
 * tabs are gone: athlete details live on Home, and nothing about cards is saved here.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Download, Lock, ShieldCheck, User } from "lucide-react";
import { userProfilesAPI } from "@/api";
import { TimeZoneSelect } from "@/components/common/TimeZoneSelect";
import { input, label, meta, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { ATHLETE_NOTIFICATIONS, DELETE_WORD, DELETION_GRACE_DAYS } from "@/utils/settings";
import { downloadJson } from "@/utils/download";
import { Card, ConfirmWordCard, Field, NotificationsTab, SecurityTab, SettingsShell, sub } from "./CoachSettings";

type Tab = "account" | "notifications" | "privacy" | "security";
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
  ];

  return (
    <SettingsShell<Tab>
      subtitle={isParent ? `${athleteFirst}'s account, managed by you. Edit anything right here.` : "Your account, notifications and privacy."}
      tabs={tabs}
      defaultTab="account"
      dirty={dirty}
      onDiscard={() => setDirty(false)}
      banner={extras.deletion_requested_at ? <DeletionBanner requestedAt={extras.deletion_requested_at} /> : null}
      render={(tab) => (
        <>
          {tab === "account" ? <AccountTab isParent={isParent} athleteFirst={athleteFirst} onDirtyChange={setDirty} /> : null}
          {tab === "notifications" ? (
            <NotificationsTab kinds={ATHLETE_NOTIFICATIONS} caption="Email on the web app, push on the mobile app. Safety messages always come through." />
          ) : null}
          {tab === "privacy" ? <PrivacyTab athleteId={athlete?.id} athleteFirst={athleteFirst} isParent={isParent} /> : null}
          {tab === "security" ? (
            <SecurityTab danger={extras.deletion_requested_at ? null : <DeleteCard isParent={isParent} athleteFirst={athleteFirst} />} />
          ) : null}
        </>
      )}
    />
  );
};

/* ---------- Parent or guardian / Account ---------- */

type Draft = { name: string; relationship: string; phone: string };

const AccountTab = ({ isParent, athleteFirst, onDirtyChange }: {
  isParent: boolean;
  athleteFirst: string;
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
    <Card icon={<User className="size-5 text-[#767980]" strokeWidth={1.5} />} title={isParent ? "Parent or guardian" : "Account"}>
      {isParent ? (
        <div className="flex items-start gap-2 rounded-[8px] bg-[#F1F1E6] px-3 py-2.5">
          <ShieldCheck className="mt-[1px] size-4 shrink-0 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
          <span className={sub}>You hold {athleteFirst}'s account: you book, pay and message coaches for {athleteFirst}.</span>
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
        <Field label="Email" hint="Sign-in email and receipts. Contact support to change it.">
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
      <div className="flex items-start gap-2 rounded-[8px] bg-[#F1F1E6] px-3 py-2.5">
        <Lock className="mt-[1px] size-4 shrink-0 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
        <span className={sub}>
          Coaches you book with see {whose} profile and the notes they write after sessions.
        </span>
      </div>
      <button type="button" className={cn(secondaryButton, "self-start")} disabled={exportData.isPending} onClick={() => exportData.mutate()}>
        <Download strokeWidth={1.5} aria-hidden="true" />
        {exportData.isPending ? "Preparing…" : `Download ${whose} data`}
      </button>
    </Card>
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
      body={`Removes ${isParent ? `${athleteFirst}'s` : "your"} profile, sessions and notes ${DELETION_GRACE_DAYS} days after you ask. Sign in before then to undo.`}
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
