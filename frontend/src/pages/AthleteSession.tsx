/**
 * The athlete's page for one session (ATH-97), laid out like the coach's (ATH-80): title, one
 * status tag and the type; one facts card (when, where with Directions, how it was paid, the
 * coach); a spot count for groups, never other athletes' names; feedback after the session.
 */
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarPlus, ChevronLeft, ChevronRight, Clock, CreditCard, MapPin, MessageCircle, Ticket, Users, Video } from "lucide-react";
import { BrandPill } from "@/components/brand";
import { athleteSessionAPI } from "@/api/athleteSession";
import { startOccurrenceCheckout } from "@/api/bookings";
import { card, meta, primaryButton, secondaryButton, textButton } from "@/components/schedule/styles";
import { useProfile } from "@/contexts/ProfileContext";
import { useToast } from "@/hooks/use-toast";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { coachProfilePath } from "@/utils/coachSlug";
import { getZonedISODate } from "@/utils/dateHelpers";
import { formatDayISO, plural, sessionEnd, sessionStart } from "@/utils/schedule";
import { formatInstantSpan } from "@/utils/viewerTime";

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

const AthleteSessionPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const timeZone = useViewerTimeZone();
  const { profile } = useProfile();
  const athleteId = profile?.userProfile?.athlete_id ?? "";
  const query = useQuery({ queryKey: ["athlete-session", id], enabled: Boolean(id), queryFn: () => athleteSessionAPI.get(id!) });
  const s = query.data;

  const pay = useMutation({
    mutationFn: () => startOccurrenceCheckout(s!.id, athleteId),
    onError: (err: unknown) =>
      toast({ title: "Couldn't open checkout", description: err instanceof Error ? err.message : undefined, variant: "destructive" }),
  });

  if (query.isLoading) return <div className="px-4 py-10 md:px-10"><p className={meta}>Loading…</p></div>;
  if (!s) {
    return (
      <div className="mx-auto flex max-w-[640px] flex-col items-center gap-3 px-4 py-16 text-center">
        <h1 className="text-[24px] font-semibold">Session not found</h1>
        <Link to={ROUTES.MY_SESSIONS} className={secondaryButton}>Back to My Sessions</Link>
      </div>
    );
  }

  const start = sessionStart({ date: s.date, startTime: s.startTime });
  const end = sessionEnd({ date: s.date, endTime: s.endTime });
  const group = s.sessionType === "group";
  const status = s.booking.status;
  const cancelled = status === "canceled" || status === "refunded";
  const coachFirst = s.coach.name.split(" ")[0];
  const title = group ? s.sessionName || "Group session" : `${s.pillar || "1-on-1"} with ${coachFirst}`;
  const where = s.location === "online" ? "Video call" : s.place || "In person";
  const missed = s.ended && s.attendance && s.attendance !== "present";

  const tag = cancelled ? (
    <BrandPill tone="neutral">Cancelled</BrandPill>
  ) : status === "requested" ? (
    <BrandPill tone="amber">Request sent</BrandPill>
  ) : status === "pending_payment" ? (
    <BrandPill tone="amber">Payment due</BrandPill>
  ) : missed ? (
    <BrandPill tone="amber">Missed</BrandPill>
  ) : s.ended ? (
    <BrandPill tone="neutral">Completed</BrandPill>
  ) : s.started ? (
    <BrandPill tone="green">Happening now</BrandPill>
  ) : (
    <BrandPill tone="green">Confirmed</BrandPill>
  );

  const payLine = cancelled
    ? s.booking.cancellationReason || "Cancelled"
    : status === "requested"
      ? `Waiting for ${coachFirst} to accept. You're only charged if they do.`
      : status === "pending_payment"
        ? `${money(s.price)} due to confirm your spot`
        : s.booking.paymentStatus === "paid"
          ? s.booking.paidAmount
            ? `Paid ${money(s.booking.paidAmount)} by card`
            : "Paid"
          : s.booking.paymentStatus === "refunded"
            ? "Refunded"
            : "Not paid yet";

  const fact = (Icon: typeof Clock, a: string, b?: string | null, right?: JSX.Element | null) => (
    <div className="flex items-start gap-3 py-3">
      <Icon className="mt-[2px] size-4 flex-none text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="text-[14px] font-medium">{a}</b>
        {b ? <span className={meta}>{b}</span> : null}
      </span>
      {right}
    </div>
  );

  return (
    <div className="px-4 pb-16 md:px-10">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
        <button type="button" className={cn(textButton, "self-start text-[#767980]")} onClick={() => navigate(-1)}>
          <ChevronLeft strokeWidth={1.5} aria-hidden="true" />
          Back
        </button>
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[28px] font-bold leading-[30px] tracking-[-1.2px] text-[#1A202C]">{title}</h1>
              {tag}
            </div>
            <span className={meta}>
              {group ? `Group · ${plural(s.taken, "spot")} of ${s.capacity} taken` : `1-on-1 · ${s.durationMinutes} min`}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {status === "pending_payment" && !s.started ? (
              <button type="button" className={primaryButton} disabled={pay.isPending} onClick={() => pay.mutate()}>
                <CreditCard strokeWidth={1.5} aria-hidden="true" />
                {pay.isPending ? "Opening checkout…" : `Pay ${money(s.price)}`}
              </button>
            ) : null}
            <Link to={ROUTES.CHAT} className={secondaryButton}>
              <MessageCircle strokeWidth={1.5} aria-hidden="true" />
              Message {coachFirst}
            </Link>
            {s.ended || cancelled ? (
              <Link to={`${ROUTES.BOOK}?coach=${s.coach.id}`} className={secondaryButton}>
                <CalendarPlus strokeWidth={1.5} aria-hidden="true" />
                Book again
              </Link>
            ) : null}
          </div>
        </header>

        <section className={cn(card, "gap-0 divide-y divide-[#EAEADF] py-2")}>
          {fact(Clock, formatDayISO(getZonedISODate(start, timeZone), { weekday: "short", month: "short", day: "numeric" }), formatInstantSpan(start, end, timeZone))}
          {s.location === "online"
            ? fact(Video, "Video call", "The link comes from your coach before the session")
            : fact(
                MapPin,
                where,
                null,
                s.place ? (
                  <a className={textButton} href={`https://www.google.com/maps/search/${encodeURIComponent(s.place)}`} target="_blank" rel="noreferrer">
                    Directions
                  </a>
                ) : null
              )}
          {fact(Ticket, payLine)}
          {group ? fact(Users, `${plural(s.taken, "athlete")} booked`, `${s.capacity - s.taken > 0 ? plural(s.capacity - s.taken, "spot") + " left" : "Full"}. Only your coach sees who's coming.`) : null}
          <Link to={coachProfilePath(s.coach.slug || s.coach.id)} className="flex items-center gap-3 py-3 hover:bg-[#F4F4EB]">
            <span className="flex size-[36px] items-center justify-center overflow-hidden rounded-full bg-[#E5EDF7] text-[12px] font-semibold text-[#0054B4]">
              {s.coach.photo ? <img src={s.coach.photo} alt="" className="size-full object-cover" /> : s.coach.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <b className="text-[14px] font-medium">{s.coach.name}</b>
              <span className={meta}>Coach</span>
            </span>
            <ChevronRight className="size-4 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </section>

        {s.ended && !cancelled ? (
          <section className={card}>
            <h2 className="text-[18px] font-medium">{missed ? "Missed session" : "Feedback"}</h2>
            {missed ? (
              <p className={meta}>{coachFirst} marked this session as missed.</p>
            ) : s.summary || s.note ? (
              <>
                {s.summary ? <p className="whitespace-pre-line text-[14px] leading-[20px] text-[#1A202C]">{s.summary}</p> : null}
                {s.note ? (
                  <div className="flex flex-col gap-1 rounded-[8px] bg-[#F1F1E6] px-3 py-2.5">
                    <span className={meta}>Just for you</span>
                    <p className="whitespace-pre-line text-[14px] leading-[20px] text-[#1A202C]">{s.note}</p>
                  </div>
                ) : null}
              </>
            ) : (
              <p className={meta}>{coachFirst} hasn't shared feedback yet.</p>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
};

export default AthleteSessionPage;
