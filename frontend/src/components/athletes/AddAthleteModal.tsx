/**
 * Add athlete (ATH-78): one modal with three ways in. Email sends invites right away,
 * Import a list takes pasted rows or a CSV, and Share link is a sign-up link the coach
 * approves in Invites.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, FileUp, Info, Link as LinkIcon, Mail, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  dialogContent, input, label, primaryButton, secondaryButton, segButton, segGroup, textButton,
} from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { useAddClientReferrals, useCoachReferrals } from "@/hooks/useReferrals";
import { cn } from "@/lib/utils";
import { joinLinkFor } from "@/utils/referralHelpers";
import {
  EMAIL_RE, cleanFamily, emptyFamily, isReadyFamily, parseInviteList, sendLabel, type FamilyInvite,
} from "@/utils/invites";
import { plural } from "@/utils/schedule";

type Tab = "email" | "import" | "link";

const TABS: [Tab, string, typeof Mail][] = [["email", "Email", Mail], ["import", "Import a list", FileUp], ["link", "Share link", LinkIcon]];
const cap = "text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]";
const field = "flex min-w-0 flex-col gap-1.5";
const MAX_ROWS = 50;

interface AddAthleteModalProps {
  open: boolean;
  onClose: () => void;
  coachId: string | undefined;
  /** Tab to open on, e.g. "import" from Invites. */
  initialTab?: Tab;
}

export const AddAthleteModal = ({ open, onClose, coachId, initialTab = "email" }: AddAthleteModalProps) => {
  const [tab, setTab] = useState<Tab>(initialTab);
  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);
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
    setTab(initialTab);
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
        notEmailed ? `${notEmailed} email${notEmailed === 1 ? "" : "s"} didn't go out; copy the link from Invites` : "",
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
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Copy failed", description: shareLink, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent
        className={cn(dialogContent, "sm:max-w-[640px]")}
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          firstNameRef.current?.focus();
        }}
      >
        <DialogHeader className="border-b border-[#EAEADF] px-4 py-5 pr-14 text-left sm:px-[25px]">
          <DialogTitle className="text-[20px] font-semibold leading-[24px] tracking-[-0.05em] sm:text-[24px] sm:leading-[30px]">Add athlete</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-4 py-5 sm:px-[25px]">
          <div className={segGroup} role="tablist" aria-label="How to add">
            {TABS.map(([key, text, Icon]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={segButton(tab === key)}
                onClick={() => setTab(key)}
              >
                <Icon strokeWidth={1.5} aria-hidden="true" />
                {text}
              </button>
            ))}
          </div>

          {tab === "email" ? (
            <>
              <div className="flex flex-col gap-3">
                {families.map((family, index) => (
                  <div key={index} className="flex flex-col gap-[10px] [&+&]:border-t [&+&]:border-[#EAEADF] [&+&]:pt-3">
                    {families.length > 1 ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[14px] font-medium">Family {index + 1}</span>
                        <button
                          type="button"
                          aria-label={`Remove family ${index + 1}`}
                          className="inline-flex size-[30px] flex-none items-center justify-center rounded-[8px] text-[#767980] hover:bg-[#F4F4EB] hover:text-[#1A202C]"
                          onClick={() => setFamilies((prev) => prev.filter((_, i) => i !== index))}
                        >
                          <X className="size-4" strokeWidth={1.5} />
                        </button>
                      </div>
                    ) : null}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label className={field}>
                        <span className={label}>Name</span>
                        <input
                          className={input}
                          ref={index === 0 ? firstNameRef : undefined}
                          autoFocus={index > 0 && index === families.length - 1}
                          autoComplete="off"
                          placeholder="Parent, or athlete if 18+"
                          value={family.name}
                          onChange={(e) => updateFamily(index, "name", e.target.value)}
                        />
                      </label>
                      <label className={field}>
                        <span className={label}>Email</span>
                        <input
                          className={cn(input, family.email.trim() && !EMAIL_RE.test(family.email.trim()) && "ring-[1.5px] ring-inset ring-[#C93939]")}
                          type="email"
                          inputMode="email"
                          autoComplete="off"
                          placeholder="name@email.com"
                          value={family.email}
                          onChange={(e) => updateFamily(index, "email", e.target.value)}
                        />
                      </label>
                    </div>
                    <label className={field}>
                      <span className={label}>Athlete first name <span className="text-[#A3A6AB]">(optional)</span></span>
                      <input
                        className={input}
                        autoComplete="off"
                        placeholder="For example, Leo"
                        value={family.athleteFirstName}
                        onChange={(e) => updateFamily(index, "athleteFirstName", e.target.value)}
                      />
                    </label>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className={cn(textButton, "self-start")}
                disabled={families.length >= MAX_ROWS}
                onClick={() => setFamilies((prev) => [...prev, emptyFamily()])}
              >
                <Plus strokeWidth={1.5} aria-hidden="true" /> Add another family
              </button>
            </>
          ) : null}

          {tab === "import" ? (
            <>
              <label className={field}>
                <span className={label}>Paste from a spreadsheet</span>
                <textarea
                  className={cn(input, "h-auto resize-none whitespace-pre py-[10px] leading-[18px]")}
                  rows={5}
                  placeholder="Maria Gomez, maria.gomez@email.com, Leo"
                  value={listText}
                  onChange={(e) => setListText(e.target.value)}
                />
              </label>
              <p className={cap}>
                One family per row: parent name, parent email, athlete first name. Or{" "}
                <button type="button" className="font-medium text-[#0054B4] hover:text-[#004390]" onClick={() => fileRef.current?.click()}>
                  upload a CSV
                </button>
                .
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => readFile(e.target.files?.[0])}
                />
              </p>
              {parsed.lines.length ? (
                <div className="flex max-h-[260px] flex-col overflow-y-auto">
                  {parsed.lines.map((row) => (
                    <div key={row.line} className="flex items-center gap-3 py-3 text-[14px] [&+&]:border-t [&+&]:border-[#EAEADF]">
                      {row.reason ? (
                        <Info className="size-4 flex-none text-[#C93939]" strokeWidth={1.5} aria-label="Skipped" />
                      ) : (
                        <Check className="size-4 flex-none text-[#289A42]" strokeWidth={1.5} aria-label="Ready" />
                      )}
                      <span className="min-w-0 grow truncate">{row.name || "(no name)"}</span>
                      <span className={cn(cap, "shrink-0", row.reason && "text-[#972B2B]")}>
                        {row.reason ? `${row.reason}, skipped` : row.athleteFirstName}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}

          {tab === "link" ? (
            <>
              <label className={field}>
                <span className={label}>Your invite link</span>
                <span className="flex gap-2">
                  <input
                    className={cn(input, "min-w-0 flex-1 bg-[#F4F4EB] text-[#767980]")}
                    readOnly
                    value={shareLink}
                    onFocus={(e) => e.target.select()}
                  />
                  <button type="button" className={secondaryButton} onClick={copyLink} disabled={!shareLink}>
                    <Copy strokeWidth={1.5} aria-hidden="true" /> Copy
                  </button>
                </span>
              </label>
              <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
                Share it in your group chat, email signature or club newsletter. Parents who sign up through it appear in Invites for you to approve.
              </p>
            </>
          ) : null}

          <p className={cap}>
            Invites go to a parent or guardian, or to the athlete if they&apos;re 18 or older. They add their athlete after accepting.
          </p>
        </div>

        <div className={cn("flex flex-wrap gap-[10px] border-t border-[#EAEADF] px-4 py-4 sm:px-[25px]", tab === "link" ? "justify-end" : "justify-between")}>
          {tab === "link" ? (
            <button type="button" className={primaryButton} onClick={close}>Done</button>
          ) : (
            <>
              <button type="button" className={secondaryButton} onClick={close}>Cancel</button>
              <button
                type="button"
                className={primaryButton}
                disabled={!ready.length || addClients.isPending}
                onClick={send}
              >
                {addClients.isPending
                  ? "Sending…"
                  : tab === "import"
                    ? ready.length ? `Send ${plural(ready.length, "invite")}` : "Send invites"
                    : sendLabel(ready.length)}
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
