/**
 * My Organization dialogs (ATH-90): invite a coach, coach detail, change rate, remove, and a
 * read-only session view.
 */
import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info, Send } from "lucide-react";
import { organizationsAPI } from "@/api/organizations";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dangerButton, dangerTextButton, dialogContent, input, label, meta, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { getZonedISODate, zonedWallTimeToUtc } from "@/utils/dateHelpers";
import { EMAIL_RE } from "@/utils/invites";
import {
  attendanceLabel,
  isValidRate,
  money,
  rateLabel,
  splitExample,
  type MyOrganization,
  type OrgCoach,
  type OrgSession,
} from "@/utils/organizations";
import { formatClock, formatDayISO, plural } from "@/utils/schedule";

const Shell = ({
  open,
  onClose,
  title,
  sub,
  children,
  foot,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  children: ReactNode;
  foot: ReactNode;
}) => (
  <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className={dialogContent}>
      <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
        <DialogTitle className="text-[22px] font-semibold leading-[28px] tracking-[-0.05em]">{title}</DialogTitle>
        {sub ? <DialogDescription className={meta}>{sub}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
      </DialogHeader>
      <div className="flex flex-col gap-4 px-5 pb-5 sm:px-[25px] sm:pb-[25px]">
        {children}
        <div className="flex flex-wrap justify-end gap-2">{foot}</div>
      </div>
    </DialogContent>
  </Dialog>
);

const InfoNote = ({ children }: { children: ReactNode }) => (
  <div className="flex items-start gap-2 rounded-[8px] bg-[#E5EDF7] px-3 py-2.5 text-[13px] leading-[18px] text-[#00326C]">
    <Info className="mt-px size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
    <span>{children}</span>
  </div>
);

const KV = ({ items }: { items: [string, ReactNode][] }) => (
  <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
    {items.map(([k, v]) => (
      <div key={k} className="flex flex-col gap-1">
        <dt className={label}>{k}</dt>
        <dd className="text-[14px] text-[#1A202C]">{v}</dd>
      </div>
    ))}
  </dl>
);

const sentToast = (emailed: boolean, link: string | null, done: string) =>
  emailed || !link
    ? { title: done }
    : { title: done, description: `The email didn't go out. Share this link: ${link}` };

export const InviteCoachDialog = ({ org, open, onClose }: { org: MyOrganization; open: boolean; onClose: () => void }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [rate, setRate] = useState("20");
  const [tried, setTried] = useState(false);
  const r = Math.max(0, Math.min(100, Number(rate) || 0));
  const emailOk = EMAIL_RE.test(email.trim());
  const send = useMutation({
    mutationFn: () => organizationsAPI.invite(email.trim().toLowerCase(), Number(rate)),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["my-organization"] });
      toast(sentToast(res.emailed, res.link, `Invite sent to ${email.trim()}`));
      setEmail("");
      setTried(false);
      onClose();
    },
    onError: (e: Error) => toast({ title: "Couldn't send the invite", description: e.message, variant: "destructive" }),
  });
  const submit = () => {
    setTried(true);
    if (emailOk && isValidRate(rate)) send.mutate();
  };

  return (
    <Shell
      open={open}
      onClose={onClose}
      title="Invite a coach"
      foot={
        <>
          <button type="button" className={secondaryButton} onClick={onClose}>Cancel</button>
          <button type="button" className={primaryButton} disabled={send.isPending} onClick={submit}>
            <Send strokeWidth={1.5} aria-hidden="true" />
            {send.isPending ? "Sending…" : "Send invite"}
          </button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5">
        <span className={label}>Coach's email</span>
        <input className={input} type="email" placeholder="name@email.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={tried && !emailOk} />
        {tried && !emailOk ? <span className="text-[12px] text-[#972B2B]">Add an email address</span> : null}
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Org share of each paid session (%)</span>
        <input className={input} type="number" min={0} max={100} value={rate} onChange={(e) => setRate(e.target.value)} aria-invalid={tried && !isValidRate(rate)} />
        {tried && !isValidRate(rate) ? <span className="text-[12px] text-[#972B2B]">Between 0 and 100</span> : null}
      </label>
      <InfoNote>
        They see the rate in the invite and accept it to join. From then on, every paid session splits {rateLabel(r)} to {org.name},{" "}
        {rateLabel(100 - r)} to the coach.
      </InfoNote>
    </Shell>
  );
};

export const ChangeRateDialog = ({ coach, price, onClose }: { coach: OrgCoach | null; price: number; onClose: () => void }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rate, setRate] = useState("");
  const first = coach?.name.split(" ")[0] ?? "";
  const value = rate === "" ? String(coach?.pendingRate ?? coach?.rate ?? "") : rate;
  const r = Math.max(0, Math.min(100, Number(value) || 0));
  const ex = splitExample(price, r);
  const send = useMutation({
    mutationFn: () => organizationsAPI.changeRate(coach!.coachId, Number(value)),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["my-organization"] });
      toast(
        (res as { unchanged?: boolean }).unchanged
          ? { title: "Rate unchanged" }
          : sentToast(res.emailed, res.link, `Sent to ${first}. ${rateLabel(r)} starts once they accept`)
      );
      setRate("");
      onClose();
    },
    onError: (e: Error) => toast({ title: "Couldn't send the new rate", description: e.message, variant: "destructive" }),
  });
  const close = () => {
    setRate("");
    onClose();
  };

  return (
    <Shell
      open={Boolean(coach)}
      onClose={close}
      title={`Change ${first}'s rate`}
      foot={
        <>
          <button type="button" className={secondaryButton} onClick={close}>Cancel</button>
          <button type="button" className={primaryButton} disabled={!isValidRate(value) || send.isPending} onClick={() => send.mutate()}>
            {send.isPending ? "Sending…" : `Send to ${first}`}
          </button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5">
        <span className={label}>Org share of each paid session (%)</span>
        <input className={input} type="number" min={0} max={100} value={value} onChange={(e) => setRate(e.target.value)} />
      </label>
      <div className="flex flex-col gap-1 rounded-[8px] bg-[#F1F1E6] px-3 py-2.5">
        <span className={meta}>On a {money(price)} session</span>
        <span className="text-[14px]">
          {money(ex.toOrg)} to the org · {money(ex.toCoach)} to {first}
        </span>
      </div>
      <InfoNote>
        {first} gets an email and has to accept before the new rate starts. It applies to sessions booked after that, never to ones
        already paid. Current rate: {rateLabel(coach?.rate ?? 0)}.
      </InfoNote>
    </Shell>
  );
};

export const RemoveCoachDialog = ({ coach, onClose, onRemoved }: { coach: OrgCoach | null; onClose: () => void; onRemoved: () => void }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const first = coach?.name.split(" ")[0] ?? "";
  const remove = useMutation({
    mutationFn: () => organizationsAPI.removeCoach(coach!.coachId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-organization"] });
      qc.invalidateQueries({ queryKey: ["org-sessions"] });
      qc.invalidateQueries({ queryKey: ["organizations-public"] });
      toast({ title: `${first} removed from the org` });
      onRemoved();
    },
    onError: (e: Error) => toast({ title: "Couldn't remove the coach", description: e.message, variant: "destructive" }),
  });
  return (
    <Shell
      open={Boolean(coach)}
      onClose={onClose}
      title={`Remove ${first} from the org?`}
      foot={
        <>
          <button type="button" className={secondaryButton} onClick={onClose}>Cancel</button>
          <button type="button" className={dangerButton} disabled={remove.isPending} onClick={() => remove.mutate()}>
            {remove.isPending ? "Removing…" : "Remove"}
          </button>
        </>
      }
    >
      <p className="text-[14px] leading-[20px] text-[#484D56]">
        They keep their own profile, athletes and payments. Splits stop for sessions booked from now on, and they come off the org page.
      </p>
    </Shell>
  );
};

export const CoachDetailDialog = ({
  coach,
  sessions,
  onClose,
  onRate,
  onRemove,
  onSessions,
}: {
  coach: OrgCoach | null;
  /** This month's sessions for the coach. */
  sessions: OrgSession[];
  onClose: () => void;
  onRate: () => void;
  onRemove: () => void;
  onSessions: () => void;
}) => {
  const timeZone = useViewerTimeZone();
  if (!coach) return null;
  const first = coach.name.split(" ")[0];
  const athletes = sessions.reduce((sum, s) => sum + (s.marked ? s.athletes : 0), 0);
  const came = sessions.reduce((sum, s) => sum + (s.marked ? s.came : 0), 0);
  const last = sessions[0];
  const lastAt = last ? zonedWallTimeToUtc(last.date, last.startTime) : null;
  return (
    <Shell
      open
      onClose={onClose}
      title={coach.name}
      sub={coach.isOwner ? "Owner" : `Coach since ${new Date(coach.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`}
      foot={
        <>
          {coach.isOwner ? null : (
            <>
              <button type="button" className={`${dangerTextButton} mr-auto`} onClick={onRemove}>Remove from org</button>
              <button type="button" className={secondaryButton} onClick={onRate}>Change rate</button>
            </>
          )}
          <button type="button" className={secondaryButton} onClick={onSessions}>See sessions</button>
        </>
      }
    >
      <KV
        items={[
          ["Sessions this month", sessions.length],
          ["Brought in", money(sessions.reduce((sum, s) => sum + s.paid, 0))],
          ["Attendance", athletes ? `${Math.round((came / athletes) * 100)}%` : "–"],
          [
            "Last session",
            lastAt ? `${formatDayISO(getZonedISODate(lastAt, timeZone), { month: "short", day: "numeric" })}, ${formatClock(lastAt, timeZone)}` : "–",
          ],
          [
            "Org rate",
            coach.isOwner
              ? "All yours"
              : `${rateLabel(coach.rate ?? 0)}${coach.pendingRate != null ? ` (${rateLabel(coach.pendingRate)} waiting for ${first})` : ""}`,
          ],
          ["Pillars", coach.pillars.join(", ") || "–"],
        ]}
      />
    </Shell>
  );
};

export const OrgSessionDialog = ({ session, coachName, onClose }: { session: OrgSession | null; coachName: string; onClose: () => void }) => {
  const timeZone = useViewerTimeZone();
  if (!session) return null;
  const start = zonedWallTimeToUtc(session.date, session.startTime);
  const end = zonedWallTimeToUtc(session.date, session.endTime);
  const when = start
    ? `${formatDayISO(getZonedISODate(start, timeZone), { weekday: "short", month: "short", day: "numeric" })}, ${formatClock(start, timeZone)}${end ? `–${formatClock(end, timeZone)}` : ""}`
    : session.date;
  return (
    <Shell
      open
      onClose={onClose}
      title={session.name}
      sub={`${coachName} · ${when}`}
      foot={<button type="button" className={primaryButton} onClick={onClose}>Done</button>}
    >
      <KV
        items={[
          ["Type", session.type === "group" ? "Group" : "Individual"],
          ["Pillar", session.pillar || "–"],
          ["Athletes", session.type === "group" ? `${session.athletes} of ${session.capacity}` : plural(session.athletes, "athlete")],
          ["Attendance", attendanceLabel(session)],
          ["Paid", money(session.paid)],
        ]}
      />
      <p className={meta}>Read only. The score and what {coachName.split(" ")[0]} wrote to families stay private.</p>
    </Shell>
  );
};
