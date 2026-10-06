/**
 * Add athlete (ATH-78): one modal with three ways in. Email sends invites right away,
 * Import a list takes pasted rows or a CSV, and Share link is a sign-up link the coach
 * approves on My Clients.
 */
import { useMemo, useRef, useState } from "react";
import { Copy, Plus, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  dialogContent, input, label, meta, primaryButton, secondaryButton, segButton, segGroup, textButton,
} from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { useAddClientReferrals, useCoachReferrals } from "@/hooks/useReferrals";
import { cn } from "@/lib/utils";
import { joinLinkFor } from "@/utils/referralHelpers";
import {
  cleanFamily, emptyFamily, isReadyFamily, parseInviteList, sendLabel, type FamilyInvite,
} from "@/utils/invites";
import { plural } from "@/utils/schedule";

type Tab = "email" | "import" | "link";

const TABS: [Tab, string][] = [["email", "Email"], ["import", "Import a list"], ["link", "Share link"]];
const MAX_ROWS = 50;

interface AddAthleteModalProps {
  open: boolean;
  onClose: () => void;
  coachId: string | undefined;
}

export const AddAthleteModal = ({ open, onClose, coachId }: AddAthleteModalProps) => {
  const [tab, setTab] = useState<Tab>("email");
  const [families, setFamilies] = useState<FamilyInvite[]>([emptyFamily()]);
  const [listText, setListText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const addClients = useAddClientReferrals();
  const referrals = useCoachReferrals(coachId);

  const knownEmails = useMemo(
    () => (referrals.data ?? []).filter((r) => r.status !== "declined").map((r) => r.client_email),
    [referrals.data],
  );
  const parsed = useMemo(() => parseInviteList(listText, knownEmails), [listText, knownEmails]);
  const ready = tab === "email" ? families.filter(isReadyFamily).map(cleanFamily) : parsed.rows;

  const reset = () => {
    setTab("email");
    setFamilies([emptyFamily()]);
    setListText("");
  };
  const close = () => {
    reset();
    onClose();
  };

  const updateFamily = (index: number, field: keyof FamilyInvite, value: string) =>
    setFamilies((prev) => prev.map((f, i) => (i === index ? { ...f, [field]: value } : f)));

  const send = async () => {
    try {
      const data = await addClients.mutateAsync({
        clients: ready.slice(0, MAX_ROWS).map((r) => ({
          name: r.name,
          email: r.email,
          athlete_first_name: r.athleteFirstName || undefined,
        })),
      });
      const results = data?.results ?? [];
      const sent = results.filter((r) => r.invite_link).length;
      const already = results.filter((r) => r.status === "already_exists").length;
      const notEmailed = results.filter((r) => r.invite_link && !r.emailed).length;
      const failed = results.filter((r) => r.status === "error").length;
      const notes = [
        already ? `${plural(already, "family", "families")} already on your list` : "",
        failed ? `${failed} couldn't be added` : "",
        notEmailed ? `${notEmailed} email${notEmailed === 1 ? "" : "s"} didn't go out; copy the link from My Clients` : "",
      ].filter(Boolean);
      toast({
        title: sent ? `${plural(sent, "invite")} sent` : "No new invites",
        description: notes.join(". ") || "They add their athlete after accepting.",
        variant: sent ? undefined : "destructive",
      });
      if (sent) close();
    } catch (e) {
      toast({
        title: "Couldn't send invites",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    }
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setListText((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text));
    if (fileRef.current) fileRef.current.value = "";
  };

  const shareLink = coachId ? joinLinkFor(coachId) : "";
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      toast({ title: "Link copied", description: "Sign-ups through it wait for your approval." });
    } catch {
      toast({ title: "Copy failed", description: shareLink, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent
        className={dialogContent}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          firstNameRef.current?.focus();
        }}
      >
        <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
          <DialogTitle className="text-[22px] font-semibold leading-[28px] tracking-[-0.05em]">Add athlete</DialogTitle>
          <DialogDescription className={meta}>
            Invites go to a parent or guardian, or to the athlete if 18 or older. They add their athlete after accepting.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-5 pb-5 sm:px-[25px]">
          <div className={segGroup} role="tablist" aria-label="How to add">
            {TABS.map(([key, text]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={segButton(tab === key)}
                onClick={() => setTab(key)}
              >
                {text}
              </button>
            ))}
          </div>

          {tab === "email" ? (
            <div className="flex flex-col gap-3">
              {families.map((family, index) => (
                <div key={index} className="relative flex flex-col gap-2 rounded-[8px] border border-[#EAEADF] bg-[#F9F9F5] p-3">
                  {families.length > 1 ? (
                    <button
                      type="button"
                      aria-label={`Remove family ${index + 1}`}
                      className="absolute right-2 top-2 text-[#767980] hover:text-[#1A202C]"
                      onClick={() => setFamilies((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <X className="size-4" strokeWidth={1.5} />
                    </button>
                  ) : null}
                  <label className="flex flex-col gap-1.5">
                    <span className={label}>Name</span>
                    <input
                      className={cn(input, "bg-white")}
                      ref={index === 0 ? firstNameRef : undefined}
                      autoFocus={index > 0 && index === families.length - 1}
                      placeholder="Parent or athlete name"
                      value={family.name}
                      onChange={(e) => updateFamily(index, "name", e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className={label}>Email</span>
                    <input
                      className={cn(input, "bg-white")}
                      type="email"
                      inputMode="email"
                      placeholder="name@email.com"
                      value={family.email}
                      onChange={(e) => updateFamily(index, "email", e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className={label}>Athlete first name (optional)</span>
                    <input
                      className={cn(input, "bg-white")}
                      placeholder="If you're inviting a parent"
                      value={family.athleteFirstName}
                      onChange={(e) => updateFamily(index, "athleteFirstName", e.target.value)}
                    />
                  </label>
                </div>
              ))}
              <button
                type="button"
                className={cn(textButton, "self-start")}
                disabled={families.length >= MAX_ROWS}
                onClick={() => setFamilies((prev) => [...prev, emptyFamily()])}
              >
                <Plus strokeWidth={1.5} aria-hidden="true" /> Add another family
              </button>
            </div>
          ) : null}

          {tab === "import" ? (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={label}>One family per line: parent name, parent email, athlete first name</span>
                <textarea
                  className={cn(input, "h-36 resize-y py-2 leading-[18px]")}
                  placeholder={"Dana Lee, dana@email.com, Mia\nSam Ray, sam@email.com"}
                  value={listText}
                  onChange={(e) => setListText(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" className={secondaryButton} onClick={() => fileRef.current?.click()}>
                  <Upload strokeWidth={1.5} aria-hidden="true" /> Upload a CSV
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => readFile(e.target.files?.[0])}
                />
                {listText.trim() ? (
                  <span className={meta}>
                    {plural(parsed.rows.length, "family", "families")} ready
                    {parsed.skipped.length ? ` · ${parsed.skipped.length} skipped` : ""}
                  </span>
                ) : null}
              </div>
              {parsed.skipped.length ? (
                <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-[8px] bg-[#F1F1E6] px-3 py-2.5">
                  {parsed.skipped.map((row) => (
                    <li key={row.line} className="flex justify-between gap-3 text-[12px] leading-[16px]">
                      <span className="min-w-0 truncate text-[#484D56]">Line {row.line}: {row.text}</span>
                      <span className="shrink-0 text-[#972B2B]">{row.reason}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {tab === "link" ? (
            <div className="flex flex-col gap-3">
              <p className="text-[14px] leading-[18px] text-[#484D56]">
                Share this link with families. Anyone who signs up through it shows up on My Clients for you to approve.
              </p>
              <div className="flex gap-2">
                <input className={cn(input, "min-w-0 flex-1")} readOnly value={shareLink} aria-label="Invite link" onFocus={(e) => e.target.select()} />
                <button type="button" className={primaryButton} onClick={copyLink} disabled={!shareLink}>
                  <Copy strokeWidth={1.5} aria-hidden="true" /> Copy
                </button>
              </div>
            </div>
          ) : null}

          {tab !== "link" ? (
            <div className="flex justify-end gap-2">
              <button type="button" className={secondaryButton} onClick={close}>Cancel</button>
              <button
                type="button"
                className={primaryButton}
                disabled={!ready.length || addClients.isPending}
                onClick={send}
              >
                {addClients.isPending ? "Sending…" : sendLabel(ready.length)}
              </button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
