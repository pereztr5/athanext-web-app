/**
 * One athlete on the coach's roster (ATH-74, simplified in ATH-79): name and one line, Book
 * session and Message; next session, credits and sessions so far; one Sessions list with the
 * summary of each previous session and Add feedback where it's due; contact and a private note.
 * Gear bought and total spent live in Payments, not here.
 */
import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Mail, MessageCircle, Phone, Plus } from "lucide-react";
import { rosterAPI } from "@/api/roster";
import { BookAthleteDialog } from "@/components/athletes/BookAthleteDialog";
import { BrandPill } from "@/components/brand";
import { card, input, meta, primaryButton, secondaryButton, textButton } from "@/components/schedule/styles";
import { useRole } from "@/hooks/useRole";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { getZonedISODate, zonedWallTimeToUtc } from "@/utils/dateHelpers";
import { formatClock, formatDayISO, plural } from "@/utils/schedule";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";

const when = (date: string, start: string, timeZone: string) => {
  const at = zonedWallTimeToUtc(date, start) ?? new Date(NaN);
  return `${formatDayISO(getZonedISODate(at, timeZone), { weekday: "short", month: "short", day: "numeric" })}, ${formatClock(at, timeZone)}`;
};

const placeLabel = (place: string | null) =>
  !place || place === "in-person" ? "In person" : place === "online" ? "Video call" : place;

const AthleteDetailPage = () => {
  const { id = "" } = useParams();
  const { isCoach, ready } = useRole();
  const timeZone = useViewerTimeZone();
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["coach-athlete", id],
    enabled: isCoach && Boolean(id),
    queryFn: () => rosterAPI.athlete(id),
  });
  const [note, setNote] = useState("");
  const [booking, setBooking] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (detail.data) setNote(detail.data.note);
  }, [detail.data]);

  const save = useMutation({
    mutationFn: (value: string) => rosterAPI.saveNote(id, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coach-athlete", id] }),
  });

  if (!ready) return null;
  if (!isCoach) return <Navigate to={ROUTES.BOOK} replace />;

  if (detail.isLoading) {
    return <p className={cn(meta, "px-4 py-8 md:px-10")}>Loading…</p>;
  }
  if (detail.isError || !detail.data) {
    return (
      <div className="px-4 py-8 md:px-10">
        <p className="text-[16px] font-medium">Athlete not found</p>
        <p className={cn(meta, "mt-1")}>They may have left your roster.</p>
        <Link to={ROUTES.ATHLETES} className={cn(secondaryButton, "mt-4")}>Back to My Athletes</Link>
      </div>
    );
  }

  const { athlete, upcoming, past } = detail.data;
  const first = athlete.name.split(" ")[0] || athlete.name;
  const minor = athlete.age != null && athlete.age < 18;
  const contactName = minor && athlete.accountName && athlete.accountName !== athlete.name ? athlete.accountName : athlete.name;
  const left = athlete.packageTotal != null ? Math.max(0, athlete.packageTotal - (athlete.packageUsed ?? 0)) : null;
  const history = showAll ? past : past.slice(0, 4);
  const line = [athlete.age != null ? String(athlete.age) : null, athlete.team, athlete.position].filter(Boolean).join(", ");

  return (
    <div className="overflow-x-hidden px-4 pb-16 md:px-10">
      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-5">
        <Link to={ROUTES.ATHLETES} className={cn(textButton, "self-start text-[#767980]")}>
          <ChevronLeft strokeWidth={1.5} aria-hidden="true" />
          My Athletes
        </Link>
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-2">
            <h1 className="text-[32px] font-bold leading-[28px] tracking-[-1.6px] text-[#1A202C]">{athlete.name}</h1>
            <p className="text-[16px] leading-[18px] text-[#767980]">{line || "Athlete"}</p>
          </div>
          <span className="flex gap-2">
            <Link to={ROUTES.CHAT} className={secondaryButton}>
              <MessageCircle strokeWidth={1.5} aria-hidden="true" />
              Message {minor ? "family" : first}
            </Link>
            <button type="button" className={primaryButton} onClick={() => setBooking(true)}>
              <Plus strokeWidth={1.5} aria-hidden="true" />
              Book session
            </button>
          </span>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Next session", athlete.next ? when(athlete.next.date, athlete.next.startTime, timeZone) : "Not booked"],
            ["Credits", athlete.credits ? plural(athlete.credits, "credit") : left != null ? `${left} left` : "Per session"],
            ["Sessions so far", String(athlete.sessionsCount)],
          ].map(([label, value]) => (
            <section key={label} className={card}>
              <span className={meta}>{label}</span>
              <b className="text-[20px] font-semibold tracking-[-0.04em]">{value}</b>
            </section>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <section className={card}>
            <h2 className="text-[20px] font-medium tracking-[-0.04em]">Sessions</h2>
            <span className="text-[12px] font-medium uppercase tracking-[0.02em] text-[#767980]">Upcoming</span>
            {upcoming.length ? (
              upcoming.slice(0, 3).map((s) => (
                <Link key={s.id} to={`/sessions/${s.id}`} className="flex items-center gap-3 border-t border-[#EAEADF] py-3 hover:bg-[#F4F4EB]">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="text-[14px] font-medium">{s.name}</b>
                    <span className={meta}>{when(s.date, s.startTime, timeZone)} · {placeLabel(s.place)}</span>
                  </span>
                  <BrandPill tone={s.kind === "group" ? "teal" : "neutral"}>{s.kind === "group" ? "Group" : "1-on-1"}</BrandPill>
                  <ChevronRight className="size-4 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
                </Link>
              ))
            ) : (
              <p className={meta}>Nothing booked.</p>
            )}
            <span className="text-[12px] font-medium uppercase tracking-[0.02em] text-[#767980]">Previous</span>
            {history.length ? (
              history.map((s) => (
                <div key={s.id} className="flex items-center gap-3 border-t border-[#EAEADF] py-3">
                  <Link to={`/sessions/${s.id}`} className="flex min-w-0 flex-1 flex-col hover:underline">
                    <b className="text-[14px] font-medium">
                      {when(s.date, s.startTime, timeZone)} · {s.name}
                    </b>
                    {s.noShow ? (
                      <span className="text-[13px] font-medium text-[#906A29]">Didn't come</span>
                    ) : s.summary ? (
                      <span className="line-clamp-1 text-[13px] text-[#484D56]">{s.summary}</span>
                    ) : s.hasFeedback ? (
                      <span className={meta}>Feedback sent</span>
                    ) : null}
                    {s.note ? <span className="line-clamp-1 text-[12px] text-[#767980]">Note: {s.note}</span> : null}
                  </Link>
                  {!s.hasFeedback ? (
                    <Link to={`${ROUTES.COACH_SESSION_FEEDBACK}?slotId=${s.id}`} className={cn(primaryButton, "h-[30px] flex-none px-3")}>
                      Add feedback
                    </Link>
                  ) : (
                    <ChevronRight className="size-4 flex-none text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
                  )}
                </div>
              ))
            ) : (
              <p className={meta}>No sessions yet.</p>
            )}
            {past.length > 4 ? (
              <button type="button" className={cn(textButton, "self-start")} onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Show fewer" : `See all ${past.length} sessions`}
              </button>
            ) : null}
          </section>

          <div className="flex flex-col gap-5">
            <section className={card}>
              <h2 className="text-[20px] font-medium tracking-[-0.04em]">{minor ? "Family contact" : "Account"}</h2>
              <b className="text-[14px] font-medium">{contactName}</b>
              <span className={meta}>{minor ? "Account holder" : "Athlete, 18 or older"}</span>
              {athlete.email ? <span className="flex items-center gap-2 text-[14px]"><Mail className="size-4 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />{athlete.email}</span> : null}
              {athlete.phone ? <span className="flex items-center gap-2 text-[14px]"><Phone className="size-4 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />{athlete.phone}</span> : null}
            </section>

            <section className={card}>
              <h2 className="text-[20px] font-medium tracking-[-0.04em]">Goal and notes</h2>
              <div className="flex flex-col gap-1">
                <span className={meta}>Season goal</span>
                <span className="text-[14px]">{detail.data.goal || "Not set yet. The family adds it on their Home."}</span>
              </div>
              {detail.data.video ? (
                <a
                  className="text-[14px] font-medium text-[#0054B4] hover:underline"
                  href={/^https?:\/\//i.test(detail.data.video) ? detail.data.video : `https://${detail.data.video}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Highlight video
                </a>
              ) : null}
              <span className={meta}>Private note</span>
              <textarea
                className={cn(input, "h-auto py-2")}
                rows={3}
                maxLength={2000}
                placeholder="Only you can see this"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => {
                  if (note !== detail.data.note) save.mutate(note);
                }}
              />
              <span className={meta}>{save.isPending ? "Saving…" : "Saved when you leave the note"}</span>
            </section>
          </div>
        </div>
      </div>
      <BookAthleteDialog athleteId={booking ? athlete.id : null} name={athlete.name} onClose={() => setBooking(false)} />
    </div>
  );
};

export default AthleteDetailPage;
