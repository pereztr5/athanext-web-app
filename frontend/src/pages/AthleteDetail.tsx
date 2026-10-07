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
  const line = [athlete.age != null ? String(athlete.age) : null, athlete.team, athlete.position].filter(Boolean).join(" · ");
  const initials = athlete.name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
  const tile = (date: string, startTime: string) => {
    const at = zonedWallTimeToUtc(date, startTime) ?? new Date(NaN);
    const d = getZonedISODate(at, timeZone);
    return (
      <span className="flex w-[40px] flex-none flex-col items-center rounded-[8px] border border-[#EAEADF] bg-[#F9F9F5] py-1">
        <small className="text-[10px] font-medium uppercase text-[#767980]">{formatDayISO(d, { weekday: "short" })}</small>
        <b className="text-[16px] font-semibold leading-[18px]">{formatDayISO(d, { day: "numeric" })}</b>
      </span>
    );
  };
  const since = athlete.joinedOn ? new Date(`${athlete.joinedOn.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : null;

  return (
    <div className="overflow-x-hidden px-4 pb-16 md:px-10">
      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-5">
        <Link to={ROUTES.ATHLETES} className={cn(textButton, "self-start text-[#767980]")}>
          <ChevronLeft strokeWidth={1.5} aria-hidden="true" />
          My Athletes
        </Link>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            {athlete.imageUrl ? (
              <img src={athlete.imageUrl} alt="" className="size-[60px] flex-none rounded-full bg-[#C1C1B8] object-cover" />
            ) : (
              <span className="flex size-[60px] flex-none items-center justify-center rounded-full bg-[#E5EDF7] text-[20px] font-semibold text-[#0054B4]">
                {initials}
              </span>
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-[32px] font-bold leading-[32px] tracking-[-1.6px] text-[#1A202C]">{athlete.name}</h1>
              <p className="text-[14px] leading-[18px] text-[#767980]">{line || "Athlete"}</p>
            </div>
          </div>
          <span className="flex gap-2">
            <button type="button" className={primaryButton} onClick={() => setBooking(true)}>
              <Plus strokeWidth={1.5} aria-hidden="true" />
              Book session
            </button>
            <Link to={ROUTES.CHAT} className={secondaryButton}>
              <MessageCircle strokeWidth={1.5} aria-hidden="true" />
              Message
            </Link>
          </span>
        </header>

        <div className="grid grid-cols-3 divide-x divide-[#EAEADF] rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0]">
          <div className="flex flex-col gap-1 px-4 py-3">
            <span className={meta}>Next session</span>
            <b className="text-[18px] font-semibold tracking-[-0.04em] sm:text-[20px]">
              {athlete.next ? when(athlete.next.date, athlete.next.startTime, timeZone).split(",").slice(0, 1).join("") : "Not booked"}
            </b>
            <span className={meta}>
              {athlete.next ? (
                when(athlete.next.date, athlete.next.startTime, timeZone).split(", ").slice(1).join(", ")
              ) : (
                <button type="button" className="text-[#0054B4] hover:underline" onClick={() => setBooking(true)}>Book one</button>
              )}
            </span>
          </div>
          <div className="flex flex-col gap-1 px-4 py-3">
            <span className={meta}>Credits</span>
            <b className="text-[18px] font-semibold tracking-[-0.04em] sm:text-[20px]">
              {athlete.credits ? `${athlete.credits} left` : left != null && athlete.packageTotal ? (left > 0 ? `${left} left` : "Used up") : "Pay per session"}
            </b>
            <span className={meta}>{athlete.packageName ?? "Nothing due"}</span>
          </div>
          <div className="flex flex-col gap-1 px-4 py-3">
            <span className={meta}>Sessions</span>
            <b className="text-[18px] font-semibold tracking-[-0.04em] sm:text-[20px]">{athlete.sessionsCount}</b>
            <span className={meta}>{since ? `Since ${since}` : ""}</span>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <section className={card}>
            <h2 className="text-[20px] font-medium tracking-[-0.04em]">Sessions</h2>
            <span className="text-[12px] font-medium uppercase tracking-[0.02em] text-[#767980]">Upcoming</span>
            {upcoming.length ? (
              upcoming.slice(0, 3).map((s) => (
                <Link key={s.id} to={`/sessions/${s.id}`} className="flex items-center gap-3 border-t border-[#EAEADF] py-3 hover:bg-[#F4F4EB]">
                  {tile(s.date, s.startTime)}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="text-[14px] font-medium">{s.kind === "group" ? s.name : s.pillar || s.name}</b>
                    <span className={meta}>{formatClock(zonedWallTimeToUtc(s.date, s.startTime) ?? new Date(NaN), timeZone)} · {placeLabel(s.place)}</span>
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
                  {tile(s.date, s.startTime)}
                  <Link to={`/sessions/${s.id}`} className="flex min-w-0 flex-1 flex-col hover:underline">
                    <b className="text-[14px] font-medium">{s.pillar || s.name}</b>
                    {!s.hasFeedback && !s.noShow ? (
                      <>
                        <span className={meta}>{formatClock(zonedWallTimeToUtc(s.date, s.startTime) ?? new Date(NaN), timeZone)}</span>
                        <span className="text-[13px] font-medium text-[#906A29]">Feedback due</span>
                      </>
                    ) : null}
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
              <h2 className="text-[20px] font-medium tracking-[-0.04em]">{minor ? "Family" : "Contact"}</h2>
              <div className="flex items-center gap-3">
                <span className="flex size-9 flex-none items-center justify-center rounded-full bg-[#F1F1E6] text-[12px] font-semibold text-[#484D56]">
                  {contactName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("")}
                </span>
                <span className="flex min-w-0 flex-col">
                  <b className="text-[14px] font-medium">{contactName}</b>
                  <span className={meta}>{minor ? `Parent · gets every message about ${first}` : "Manages their own account"}</span>
                </span>
              </div>
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
              <span className={meta}>Private note · only you see this</span>
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
