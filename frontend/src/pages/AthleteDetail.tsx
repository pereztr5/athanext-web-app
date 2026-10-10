/**
 * One athlete on the coach's roster (Working Copy 2): name and one line, Book session and
 * Message; a strip with the next session, credits (or what is due) and sessions so far; one
 * Sessions list with the summary and next focus of each previous session and Add feedback where
 * it's due; family contact, the season goal and a private note.
 */
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Mail, MessageCircle, Phone, Plus } from "lucide-react";
import { bookingRequestsAPI } from "@/api/bookingRequests";
import { invoicesAPI } from "@/api/invoices";
import { rosterAPI } from "@/api/roster";
import { BookAthleteDialog } from "@/components/athletes/BookAthleteDialog";
import { GoalDialog } from "@/components/athletes/detail/GoalDialog";
import { PackageOfferDialog } from "@/components/athletes/detail/PackageOfferDialog";
import { dueText, linkButton, listLabel, sinceLabel, usualTime, zoned } from "@/components/athletes/detail/helpers";
import { SessionRow } from "@/components/athletes/detail/parts";
import { cap, h3, spCard } from "@/components/coach-session/styles";
import { input, meta, primaryButton, secondaryButton, smallButton, textButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { getZonedISODate } from "@/utils/dateHelpers";
import { MAX_REMINDERS, money } from "@/utils/payments";
import { formatDayISO } from "@/utils/schedule";

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

const AthleteDetailPage = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { isCoach, ready } = useRole();
  const timeZone = useViewerTimeZone();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const detail = useQuery({
    queryKey: ["coach-athlete", id],
    enabled: isCoach && Boolean(id),
    queryFn: () => rosterAPI.athlete(id),
  });
  const [note, setNote] = useState("");
  const [booking, setBooking] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [dialog, setDialog] = useState<"goal" | "offer" | null>(null);

  useEffect(() => {
    if (detail.data) setNote(detail.data.note);
  }, [detail.data]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["coach-athlete", id] });
  const fail = (error: unknown) =>
    toast({ title: "Something went wrong", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });

  const save = useMutation({
    mutationFn: (value: string) => rosterAPI.saveNote(id, value),
    onSuccess: refresh,
    onError: fail,
  });
  // Opens the athlete's thread; plain Messages if that fails.
  const message = useMutation({
    mutationFn: () => bookingRequestsAPI.openConversation(id),
    onSuccess: (conversationId) => navigate(conversationId ? `${ROUTES.CHAT}?conversationId=${conversationId}` : ROUTES.CHAT),
    onError: () => navigate(ROUTES.CHAT),
  });
  const remind = useMutation({
    mutationFn: (invoiceId: string) => invoicesAPI.remind(invoiceId),
    onSuccess: (r) => {
      toast({ title: "Reminder sent", description: r.emailed ? "We emailed the family." : undefined });
      refresh();
    },
    onError: fail,
  });

  if (!ready) return null;
  if (!isCoach) return <Navigate to={ROUTES.BOOK} replace />;

  if (detail.isLoading) {
    return <p className={cn(meta, "px-4 py-8 md:px-5")}>Loading…</p>;
  }
  if (detail.isError || !detail.data) {
    return (
      <div className="px-4 py-8 md:px-5">
        <p className="text-[16px] font-medium">Athlete not found</p>
        <p className={cn(meta, "mt-1")}>They may have left your roster.</p>
        <Link to={ROUTES.ATHLETES} className={cn(secondaryButton, "mt-4")}>Back to My Athletes</Link>
      </div>
    );
  }

  const { athlete, upcoming, past, goal, relation, packageExpires, due } = detail.data;
  const first = athlete.name.split(" ")[0] || athlete.name;
  const minor = athlete.age != null && athlete.age < 18;
  const contactName = minor && athlete.accountName && athlete.accountName !== athlete.name ? athlete.accountName : athlete.name;
  const hasPackage = athlete.packageTotal != null;
  const credits = athlete.credits;
  const history = showAll ? past : past.slice(0, 4);
  const line = [athlete.age != null ? String(athlete.age) : null, athlete.team, athlete.position].filter(Boolean).join(" · ");
  const today = getZonedISODate(new Date(), timeZone);
  const since = sinceLabel(athlete.joinedOn, today);
  const next = athlete.next ? zoned(athlete.next.date, athlete.next.startTime, timeZone) : null;
  const usual = upcoming.length ? null : usualTime(first, past, timeZone);

  const actions = (
    <>
      <button type="button" className={primaryButton} onClick={() => setBooking(true)}>
        <Plus strokeWidth={1.5} aria-hidden="true" />
        Book session
      </button>
      <button type="button" className={secondaryButton} disabled={message.isPending} onClick={() => message.mutate()}>
        <MessageCircle strokeWidth={1.5} aria-hidden="true" />
        Message
      </button>
    </>
  );

  const creditsCaption = due ? (
    <>
      <span className={dueText}>{money(due.amount)} due</span>
      {due.reminders < MAX_REMINDERS ? (
        <>
          {" · "}
          <button type="button" className={linkButton} disabled={remind.isPending} onClick={() => remind.mutate(due.invoiceId)}>
            Remind
          </button>
        </>
      ) : null}
    </>
  ) : hasPackage && credits <= 1 ? (
    <button type="button" className={cn(linkButton, "text-left")} onClick={() => setDialog("offer")}>
      Send a package offer
    </button>
  ) : hasPackage && packageExpires ? (
    `Expires ${formatDayISO(packageExpires.slice(0, 10), { month: "short", day: "numeric" })}`
  ) : (
    "Nothing due"
  );

  const stat = "flex min-w-0 flex-col gap-1 p-3 md:px-[18px] md:py-[14px]";
  const statValue = "text-[16px] font-bold tracking-[-0.02em] md:text-[20px]";

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-4">
        <Link to={ROUTES.ATHLETES} className={cn(textButton, "-mb-1.5 self-start text-[#767980]")}>
          <ChevronLeft strokeWidth={1.5} aria-hidden="true" />
          My Athletes
        </Link>
        <header className="flex items-center gap-4">
          <div className="flex min-w-0 grow items-center gap-4">
            {athlete.imageUrl ? (
              <img src={athlete.imageUrl} alt="" className="size-[52px] flex-none rounded-full bg-[#C1C1B8] object-cover md:size-[60px]" />
            ) : (
              <span
                className="flex size-[52px] flex-none items-center justify-center rounded-full bg-[#E5EDF7] text-[18px] font-medium tracking-[-0.03em] text-[#0054B4] md:size-[60px]"
                aria-hidden="true"
              >
                {initialsOf(athlete.name)}
              </span>
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-[24px] font-bold leading-[1.15] tracking-[-0.05em] text-[#1A202C] md:text-[32px] md:leading-[1.1]">{athlete.name}</h1>
              <span className="text-[14px] text-[#767980]">{line || "Athlete"}</span>
            </div>
          </div>
          <div className="hidden gap-2 md:flex">{actions}</div>
        </header>
        <div className="grid grid-cols-[1.3fr_1fr] gap-2 md:hidden [&>*]:w-full">{actions}</div>

        <div className="grid grid-cols-3 divide-x divide-[#EAEADF] rounded-[12px] border border-[#EAEADF] bg-[#F7F7F0]">
          <div className={stat}>
            <span className={cap}>Next session</span>
            <b className={statValue}>
              {next ? `${formatDayISO(next.day, { weekday: "short" })} ${next.clock.replace(":00", "")}` : "Not booked"}
            </b>
            <span className={cap}>
              {next ? (
                formatDayISO(next.day, { month: "short", day: "numeric" })
              ) : (
                <button type="button" className={linkButton} onClick={() => setBooking(true)}>Book one</button>
              )}
            </span>
          </div>
          <div className={stat}>
            <span className={cap}>Credits</span>
            <b className={statValue}>{hasPackage || credits ? (credits > 0 ? `${credits} left` : "Used up") : "Pay per session"}</b>
            <span className={cap}>{creditsCaption}</span>
          </div>
          <div className={stat}>
            <span className={cap}>Sessions</span>
            <b className={statValue}>{athlete.sessionsCount}</b>
            <span className={cap}>{since ? `Since ${since}` : ""}</span>
          </div>
        </div>

        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section className={spCard}>
            <span className={h3}>Sessions</span>
            <div className="flex flex-col">
              <span className={listLabel}>Upcoming</span>
              {upcoming.length ? (
                <div className="flex flex-col [&>*:last-child]:border-b-0">
                  {upcoming.slice(0, 3).map((s) => (
                    <SessionRow key={s.id} session={s} timeZone={timeZone}>
                      <span className={cap}>{zoned(s.date, s.startTime, timeZone).clock} · {!s.place || s.place === "in-person" ? "In person" : s.place === "online" ? "Video call" : s.place}</span>
                    </SessionRow>
                  ))}
                </div>
              ) : (
                <span className={cn(cap, "py-2")}>Nothing booked.{usual ? ` ${usual}` : ""}</span>
              )}
              <span className={listLabel}>Previous</span>
              {history.length ? (
                <div className="flex flex-col [&>*:last-child]:border-b-0">
                  {history.map((s) => {
                    const clock = zoned(s.date, s.startTime, timeZone).clock;
                    if (!s.hasFeedback && !s.noShow) {
                      return (
                        <SessionRow
                          key={s.id}
                          session={s}
                          timeZone={timeZone}
                          right={
                            <Link to={`${ROUTES.COACH_SESSION_FEEDBACK}?slotId=${s.id}`} className={cn(primaryButton, smallButton, "flex-none")}>
                              Add feedback
                            </Link>
                          }
                        >
                          <span className={cap}>{clock}</span>
                          <span className={dueText}>Feedback due</span>
                        </SessionRow>
                      );
                    }
                    return (
                      <SessionRow key={s.id} session={s} timeZone={timeZone}>
                        {s.summary ? (
                          <span className="line-clamp-2 text-[13px] leading-[1.35] text-[#484D56]">{s.summary}</span>
                        ) : (
                          <span className={cap}>{clock}</span>
                        )}
                        {s.note ? <span className={cap}>Next: {s.note}</span> : null}
                        {s.noShow ? <span className={dueText}>{s.kind === "group" ? "Absent" : "No-show"}</span> : null}
                      </SessionRow>
                    );
                  })}
                </div>
              ) : (
                <span className={cn(cap, "py-2")}>No sessions yet.</span>
              )}
            </div>
            {past.length > 4 ? (
              <button type="button" className={cn(textButton, "self-start")} onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Show fewer" : `See all ${past.length} sessions`}
              </button>
            ) : null}
          </section>

          <div className="flex min-w-0 flex-col gap-4">
            <section className={spCard}>
              <span className={h3}>{minor ? "Family" : "Contact"}</span>
              <div className="flex items-center gap-2.5">
                <span
                  className="flex size-9 flex-none items-center justify-center rounded-full bg-[#F1F1E6] text-[12px] font-medium tracking-[-0.03em] text-[#484D56]"
                  aria-hidden="true"
                >
                  {initialsOf(contactName)}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[14px] font-medium">{contactName}</span>
                  <span className={cap}>{minor ? `${relation || "Parent"} · gets every message about ${first}` : "Manages their own account"}</span>
                </span>
              </div>
              {athlete.email ? (
                <span className="flex items-center gap-2 text-[14px] text-[#484D56]">
                  <Mail className="size-[15px] flex-none text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
                  <span className="min-w-0 break-words">{athlete.email}</span>
                </span>
              ) : null}
              {athlete.phone ? (
                <span className="flex items-center gap-2 text-[14px] text-[#484D56]">
                  <Phone className="size-[15px] flex-none text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
                  {athlete.phone}
                </span>
              ) : null}
            </section>

            <section className={spCard}>
              <div className="flex items-center justify-between gap-3">
                <span className={h3}>Goal and notes</span>
                <button type="button" className={textButton} onClick={() => setDialog("goal")}>Edit goal</button>
              </div>
              <div className="flex flex-col gap-1">
                <span className={cap}>Season goal</span>
                <span className="text-[14px]">{goal || "No goal set yet"}</span>
              </div>
              <label className="flex flex-col gap-1">
                <span className={cap}>Private note · only you see this</span>
                <textarea
                  className={cn(input, "h-auto py-2")}
                  rows={3}
                  maxLength={2000}
                  placeholder={`Anything to remember about ${first}`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onBlur={() => {
                    if (note !== detail.data.note) save.mutate(note);
                  }}
                />
              </label>
            </section>
          </div>
        </div>
      </div>
      <BookAthleteDialog athleteId={booking ? athlete.id : null} name={athlete.name} onClose={() => setBooking(false)} />
      <GoalDialog
        open={dialog === "goal"}
        athleteId={athlete.id}
        first={first}
        goal={goal}
        onClose={() => setDialog(null)}
        onSaved={() => {
          setDialog(null);
          toast({ title: "Goal saved" });
          refresh();
        }}
        onError={fail}
      />
      <PackageOfferDialog
        open={dialog === "offer"}
        athleteId={athlete.id}
        first={first}
        to={contactName}
        current={athlete.packageName}
        onClose={() => setDialog(null)}
        onSent={() => {
          setDialog(null);
          toast({ title: "Package offer sent" });
        }}
        onError={fail}
      />
    </div>
  );
};

export default AthleteDetailPage;
