/**
 * Org coaches and Org sessions (ATH-90), shown as tabs on Business for org owners
 * (Working Copy): this month's numbers and the coach table, and the read-only sessions list.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Mail, UserPlus } from "lucide-react";
import { organizationsAPI } from "@/api/organizations";
import {
  ChangeRateDialog,
  CoachDetailDialog,
  InviteCoachDialog,
  OrgSessionDialog,
  RemoveCoachDialog,
} from "@/components/organization/OrgDialogs";
import { card, meta, primaryButton, secondaryButton, segButton, segGroup, textButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { getZonedISODate, zonedWallTimeToUtc } from "@/utils/dateHelpers";
import {
  attendanceLabel,
  coachRows,
  initials,
  money,
  monthKey,
  orgTotals,
  rateLabel,
  type MyOrganization as Org,
  type OrgCoach,
  type OrgSession,
} from "@/utils/organizations";
import { addDaysISO, formatClock, formatDayISO, plural } from "@/utils/schedule";

const pill = (text: string, tone: "blue" | "teal" = "blue") => (
  <span
    key={text}
    className={cn(
      "inline-flex rounded-[4px] px-2 py-[3px] text-[12px] font-medium leading-[13px]",
      tone === "blue" ? "bg-[#E5EDF7] text-[#0054B4]" : "bg-[#E7F4F8] text-[#117A96]"
    )}
  >
    {text}
  </span>
);

const Avatar = ({ coach, size = 28 }: { coach: OrgCoach; size?: number }) =>
  coach.photo ? (
    <img src={coach.photo} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full bg-[#C1C1B8] object-cover" />
  ) : (
    <span style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-full bg-[#CCDDF0] text-[11px] font-semibold text-[#00326C]">
      {initials(coach.name)}
    </span>
  );

const Stat = ({ title, value, note }: { title: string; value: string | number; note: string }) => (
  <section className={cn(card, "gap-[6px]")}>
    <span className="text-[14px] font-medium tracking-[-0.03em] text-[#767980]">{title}</span>
    <span className="text-[28px] font-bold leading-[30px] tracking-[-0.03em] text-[#1A202C] tabular-nums">{value}</span>
    <span className={meta}>{note}</span>
  </section>
);

const RateCell = ({ coach }: { coach: OrgCoach }) =>
  coach.isOwner ? (
    <span className={meta}>All yours</span>
  ) : (
    <span className="flex flex-col">
      <span className="font-medium">{rateLabel(coach.rate ?? 0)}</span>
      {coach.pendingRate != null ? <span className={meta}>{rateLabel(coach.pendingRate)} waiting</span> : null}
    </span>
  );

const Overview = ({
  org,
  month,
  monthName,
  onInvite,
  onCoach,
}: {
  org: Org;
  month: OrgSession[];
  monthName: string;
  onInvite: () => void;
  onCoach: (c: OrgCoach) => void;
}) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const rows = coachRows(org.coaches, month);
  const totals = orgTotals(rows);
  const resend = useMutation({
    mutationFn: (id: string) => organizationsAPI.resend(id),
    onSuccess: (res, id) => {
      qc.invalidateQueries({ queryKey: ["my-organization"] });
      const to = org.invites.find((i) => i.id === id)?.email ?? "the coach";
      toast(res.emailed || !res.link ? { title: `Invite resent to ${to}` } : { title: `Invite renewed for ${to}`, description: `The email didn't go out. Share this link: ${res.link}` });
    },
    onError: (e: Error) => toast({ title: "Couldn't resend", description: e.message, variant: "destructive" }),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => organizationsAPI.cancelInvite(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["my-organization"] });
      toast({ title: `Invite to ${org.invites.find((i) => i.id === id)?.email ?? "the coach"} cancelled` });
    },
    onError: (e: Error) => toast({ title: "Couldn't cancel", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat title="Sessions this month" value={totals.sessions} note={`Across ${plural(org.coaches.length, "coach", "coaches")}`} />
        <Stat title="Brought in" value={money(totals.broughtIn)} note={`Paid by families in ${monthName}`} />
        <Stat title="Org share" value={money(totals.share)} note={`From coaches · ${money(totals.paidToCoaches)} paid to them`} />
      </div>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[20px] font-medium leading-[18px] tracking-[-0.05em]">Coaches</h2>
          <span className="flex items-center gap-3">
            <span className={cn(meta, "hidden md:inline")}>{monthName}</span>
            <button type="button" className={secondaryButton} onClick={onInvite}>
              <UserPlus strokeWidth={1.5} aria-hidden="true" />
              Invite a coach
            </button>
          </span>
        </div>

        <div className="hidden md:block">
          <table className="w-full table-fixed text-left text-[14px]">
            <thead>
              <tr className="border-b border-[#EAEADF] text-[12px] font-medium text-[#767980]">
                <th className="w-[24%] py-2 font-medium">Coach</th>
                <th className="w-[22%] py-2 font-medium">Pillars</th>
                <th className="py-2 font-medium">Sessions</th>
                <th className="py-2 font-medium">Brought in</th>
                <th className="py-2 font-medium">Rate</th>
                <th className="py-2 font-medium">To the org</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.coach.coachId}
                  className="cursor-pointer border-b border-[#EAEADF] hover:bg-[#F4F4EB]"
                  onClick={() => onCoach(r.coach)}
                >
                  <td className="py-2.5">
                    <button type="button" className="flex min-w-0 items-center gap-2.5 text-left" onClick={() => onCoach(r.coach)}>
                      <Avatar coach={r.coach} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{r.coach.name}</span>
                        {r.coach.isOwner ? <span className={meta}>Owner</span> : null}
                      </span>
                    </button>
                  </td>
                  <td className="py-2.5">
                    <span className="flex flex-wrap gap-1">{r.coach.pillars.map((p) => pill(p))}</span>
                  </td>
                  <td className="py-2.5 tabular-nums">{r.sessions}</td>
                  <td className="py-2.5 tabular-nums">{money(r.broughtIn)}</td>
                  <td className="py-2.5"><RateCell coach={r.coach} /></td>
                  <td className="py-2.5 tabular-nums">{money(r.toOrg)}</td>
                  <td className="py-2.5 text-[#A3A6AB]"><ChevronRight className="size-4" strokeWidth={1.5} aria-hidden="true" /></td>
                </tr>
              ))}
              <tr className="font-medium">
                <td className="py-2.5">Total</td>
                <td />
                <td className="py-2.5 tabular-nums">{totals.sessions}</td>
                <td className="py-2.5 tabular-nums">{money(totals.broughtIn)}</td>
                <td />
                <td className="py-2.5">
                  <span className="flex flex-col">
                    <span className="tabular-nums">{money(totals.withOwn)}</span>
                    <span className={cn(meta, "font-normal")}>incl. your own sessions</span>
                  </span>
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex flex-col md:hidden">
          {rows.map((r) => (
            <button
              key={r.coach.coachId}
              type="button"
              className="flex items-start gap-3 border-b border-[#EAEADF] py-3 text-left last:border-0"
              onClick={() => onCoach(r.coach)}
            >
              <Avatar coach={r.coach} size={36} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-medium">{r.coach.name}</span>
                <span className={meta}>
                  {plural(r.sessions, "session")} · {money(r.broughtIn)} · {r.coach.isOwner ? "all yours" : `${rateLabel(r.coach.rate ?? 0)} to the org`}
                </span>
                <span className="flex flex-wrap gap-1">{r.coach.pillars.map((p) => pill(p))}</span>
              </span>
            </button>
          ))}
        </div>

        <p className={meta}>
          Org share is worked out on what families paid, after AthaNext fees. Your own sessions stay 100% yours. Each paid session is split
          by the coach's rate and paid out with their normal payout.
        </p>

        {org.invites.length ? (
          <div className="flex flex-col gap-1">
            <span className={meta}>Invites waiting</span>
            {org.invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 border-b border-[#EAEADF] py-2.5 last:border-0">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#F1F1E6] text-[#767980]">
                  <Mail className="size-4" strokeWidth={1.5} aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[14px] font-medium">{inv.email}</span>
                  <span className={meta}>
                    {rateLabel(inv.rate)} to the org · sent {new Date(inv.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </span>
                <button type="button" className={textButton} disabled={resend.isPending} onClick={() => resend.mutate(inv.id)}>Resend</button>
                <button type="button" className={cn(textButton, "text-[#767980]")} disabled={cancel.isPending} onClick={() => cancel.mutate(inv.id)}>Cancel</button>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
};

const PAGE = 15;

const Sessions = ({
  org,
  all,
  today,
  coachFilter,
  setCoachFilter,
  onOpen,
}: {
  org: Org;
  all: OrgSession[];
  today: string;
  coachFilter: string;
  setCoachFilter: (v: string) => void;
  onOpen: (s: OrgSession) => void;
}) => {
  const timeZone = useViewerTimeZone();
  const [range, setRange] = useState("7");
  const [type, setType] = useState("all");
  const [limit, setLimit] = useState(PAGE);
  const since = addDaysISO(today, -(Number(range) - 1));
  const list = all.filter(
    (s) => s.date >= since && (coachFilter === "all" || s.coachId === coachFilter) && (type === "all" || s.type === type)
  );
  const name = (id: string) => org.coaches.find((c) => c.coachId === id)?.name ?? "Coach";
  const sel = "h-[34px] rounded-[8px] border border-[#EAEADF] bg-[#F9F9F5] px-3 text-[14px]";
  const when = (s: OrgSession) => {
    const at = zonedWallTimeToUtc(s.date, s.startTime);
    return at
      ? { day: formatDayISO(getZonedISODate(at, timeZone), { weekday: "short", month: "short", day: "numeric" }), time: formatClock(at, timeZone) }
      : { day: s.date, time: "" };
  };
  const reset = (fn: () => void) => {
    fn();
    setLimit(PAGE);
  };

  return (
    <div className="flex flex-col gap-3">
      <section className={card}>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Coach" className={sel} value={coachFilter} onChange={(e) => reset(() => setCoachFilter(e.target.value))}>
            <option value="all">All coaches</option>
            {org.coaches.map((c) => <option key={c.coachId} value={c.coachId}>{c.name}</option>)}
          </select>
          <select aria-label="Dates" className={sel} value={range} onChange={(e) => reset(() => setRange(e.target.value))}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
          <select aria-label="Type" className={sel} value={type} onChange={(e) => reset(() => setType(e.target.value))}>
            <option value="all">All types</option>
            <option value="group">Group</option>
            <option value="individual">Individual</option>
          </select>
          <span className={cn(meta, "ml-auto")}>{plural(list.length, "session")}</span>
        </div>

        {list.length ? (
          <>
            <div className="hidden md:block">
              <table className="w-full table-fixed text-left text-[14px]">
                <thead>
                  <tr className="border-b border-[#EAEADF] text-[12px] text-[#767980]">
                    <th className="w-[16%] py-2 font-medium">When</th>
                    <th className="w-[19%] py-2 font-medium">Coach</th>
                    <th className="py-2 font-medium">Session</th>
                    <th className="w-[10%] py-2 font-medium">Athletes</th>
                    <th className="w-[13%] py-2 font-medium">Attendance</th>
                    <th className="w-[16%] py-2 font-medium">Pillar</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {list.slice(0, limit).map((s) => {
                    const w = when(s);
                    return (
                      <tr key={s.id} className="cursor-pointer border-b border-[#EAEADF] hover:bg-[#F4F4EB]" onClick={() => onOpen(s)}>
                        <td className="py-2.5">
                          <span className="flex flex-col">
                            <span className="font-medium">{w.day}</span>
                            <span className={meta}>{w.time}</span>
                          </span>
                        </td>
                        <td className="truncate py-2.5">{name(s.coachId)}</td>
                        <td className="py-2.5">
                          <span className="flex flex-col items-start gap-1">
                            <button type="button" className="truncate text-left" onClick={() => onOpen(s)}>{s.name}</button>
                            {s.type === "group" ? pill("Group", "teal") : pill("Individual")}
                          </span>
                        </td>
                        <td className="py-2.5 tabular-nums">{s.type === "group" ? `${s.athletes} of ${s.capacity}` : s.athletes}</td>
                        <td className="py-2.5 text-[#767980]">{attendanceLabel(s)}</td>
                        <td className="py-2.5">{s.pillar ? pill(s.pillar) : null}</td>
                        <td className="py-2.5 text-[#A3A6AB]"><ChevronRight className="size-4" strokeWidth={1.5} aria-hidden="true" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col md:hidden">
              {list.slice(0, limit).map((s) => {
                const w = when(s);
                return (
                  <button key={s.id} type="button" className="flex items-center gap-3 border-b border-[#EAEADF] py-3 text-left last:border-0" onClick={() => onOpen(s)}>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate font-medium">{s.name}</span>
                      <span className={meta}>
                        {name(s.coachId).split(" ")[0]} · {w.day}, {w.time}
                        {s.pillar ? ` · ${s.pillar}` : ""}
                      </span>
                    </span>
                    {s.type === "group" ? pill("Group", "teal") : pill("Individual")}
                  </button>
                );
              })}
            </div>
            {list.length > limit ? (
              <button type="button" className={cn(textButton, "self-start")} onClick={() => setLimit((l) => l + PAGE)}>
                Show {Math.min(PAGE, list.length - limit)} more
              </button>
            ) : null}
          </>
        ) : (
          <p className="text-[14px] text-[#767980]">No sessions match these filters.</p>
        )}
      </section>
      <p className={meta}>Open a session to see who came. Session scores and what coaches write to families stay private to each coach.</p>
    </div>
  );
};

export type OrgMoneyTab = "coaches" | "sessions";

export const OrgMoneyTabs = ({ org, tab, onTab }: { org: Org; tab: OrgMoneyTab; onTab: (tab: OrgMoneyTab) => void }) => {
  const timeZone = useViewerTimeZone();
  const [coachFilter, setCoachFilter] = useState("all");
  const [inviting, setInviting] = useState(false);
  const [detail, setDetail] = useState<OrgCoach | null>(null);
  const [rating, setRating] = useState<OrgCoach | null>(null);
  const [removing, setRemoving] = useState<OrgCoach | null>(null);
  const [opened, setOpened] = useState<OrgSession | null>(null);

  const today = getZonedISODate(new Date(), timeZone);
  const monthStart = `${today.slice(0, 7)}-01`;
  const from = [monthStart, addDaysISO(today, -29)].sort()[0];
  const sessions = useQuery({
    queryKey: ["org-sessions", from, today],
    queryFn: () => organizationsAPI.sessions(from, today),
  });
  const all = useMemo(() => sessions.data ?? [], [sessions.data]);
  const month = useMemo(() => all.filter((s) => monthKey(s.date) === monthKey(today)), [all, today]);
  const monthName = new Date(`${today}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const detailSessions = detail ? month.filter((s) => s.coachId === detail.coachId) : [];
  const coachName = (id: string) => org.coaches.find((c) => c.coachId === id)?.name ?? "Coach";

  return (
    <>
      {sessions.isError ? <p className="text-[14px] text-[#972B2B]">Couldn't load sessions. {(sessions.error as Error).message}</p> : null}
      {tab === "coaches" ? (
        <Overview org={org} month={month} monthName={monthName} onInvite={() => setInviting(true)} onCoach={setDetail} />
      ) : (
        <Sessions org={org} all={all} today={today} coachFilter={coachFilter} setCoachFilter={setCoachFilter} onOpen={setOpened} />
      )}

      <InviteCoachDialog org={org} open={inviting} onClose={() => setInviting(false)} />
      <CoachDetailDialog
        coach={detail}
        sessions={detailSessions}
        onClose={() => setDetail(null)}
        onRate={() => {
          setRating(detail);
          setDetail(null);
        }}
        onRemove={() => {
          setRemoving(detail);
          setDetail(null);
        }}
        onSessions={() => {
          setCoachFilter(detail!.coachId);
          setDetail(null);
          onTab("sessions");
        }}
      />
      <ChangeRateDialog coach={rating} price={rating?.hourlyRate || 70} onClose={() => setRating(null)} />
      <RemoveCoachDialog coach={removing} onClose={() => setRemoving(null)} onRemoved={() => setRemoving(null)} />
      <OrgSessionDialog session={opened} coachName={opened ? coachName(opened.coachId) : ""} onClose={() => setOpened(null)} />
    </>
  );
};
