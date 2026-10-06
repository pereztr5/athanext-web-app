/**
 * One athlete on the coach's roster (ATH-74): sessions, contact, gear and money spent.
 * The private note is only stored for this coach.
 */
import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Mail, MessageCircle, Phone, Plus, ShoppingBag } from "lucide-react";
import { rosterAPI } from "@/api/roster";
import { BookAthleteDialog } from "@/components/athletes/BookAthleteDialog";
import { BrandPill } from "@/components/brand";
import { card, input, meta, primaryButton, secondaryButton, textButton } from "@/components/schedule/styles";
import { useRole } from "@/hooks/useRole";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { money } from "@/utils/booking";
import { getZonedISODate, zonedWallTimeToUtc } from "@/utils/dateHelpers";
import { formatClock, formatDayISO, plural } from "@/utils/schedule";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";

const when = (date: string, start: string, timeZone: string) => {
  const at = zonedWallTimeToUtc(date, start) ?? new Date(NaN);
  return `${formatDayISO(getZonedISODate(at, timeZone), { weekday: "short", month: "short", day: "numeric" })}, ${formatClock(at, timeZone)}`;
};

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

  const { athlete, upcoming, past, gear } = detail.data;
  const first = athlete.name.split(" ")[0] || athlete.name;
  const minor = athlete.age != null && athlete.age < 18;
  const contactName = minor && athlete.accountName && athlete.accountName !== athlete.name ? athlete.accountName : athlete.name;
  const left = athlete.packageTotal != null ? Math.max(0, athlete.packageTotal - (athlete.packageUsed ?? 0)) : null;
  const spentTotal = athlete.spent + athlete.gearTotal;
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
          <div className="flex flex-col gap-5">
            <section className={card}>
              <h2 className="text-[20px] font-medium tracking-[-0.04em]">Upcoming</h2>
              {upcoming.length ? upcoming.slice(0, 4).map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 border-t border-[#EAEADF] py-3">
                  <span className="flex flex-col">
                    <b className="text-[14px] font-medium">{s.name}</b>
                    <span className={meta}>{when(s.date, s.startTime, timeZone)} · {s.place || "In person"}</span>
                  </span>
                  <BrandPill tone={s.kind === "group" ? "teal" : "neutral"}>{s.kind === "group" ? "Group" : "1-on-1"}</BrandPill>
                </div>
              )) : <p className={meta}>Nothing booked.</p>}
            </section>
            <section className={card}>
              <h2 className="text-[20px] font-medium tracking-[-0.04em]">Previous sessions</h2>
              {history.length ? history.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 border-t border-[#EAEADF] py-3">
                  <span className="flex flex-col">
                    <b className="text-[14px] font-medium">{when(s.date, s.startTime, timeZone)}</b>
                    <span className={meta}>{s.name} · {s.place || "In person"}</span>
                  </span>
                  <span className="text-[14px]">{money(s.price)}</span>
                </div>
              )) : <p className={meta}>No sessions yet.</p>}
              {past.length > 4 ? (
                <button type="button" className={cn(textButton, "self-start")} onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Show fewer" : `View all ${past.length} sessions`}
                </button>
              ) : null}
            </section>
          </div>

          <div className="flex flex-col gap-5">
            <section className={card}>
              <h2 className="text-[20px] font-medium tracking-[-0.04em]">{minor ? "Family contact" : "Account"}</h2>
              <b className="text-[14px] font-medium">{contactName}</b>
              <span className={meta}>{minor ? "Account holder" : "Athlete, 18 or older"}</span>
              {athlete.email ? <span className="flex items-center gap-2 text-[14px]"><Mail className="size-4 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />{athlete.email}</span> : null}
              {athlete.phone ? <span className="flex items-center gap-2 text-[14px]"><Phone className="size-4 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />{athlete.phone}</span> : null}
            </section>

            <section className={card}>
              <h2 className="flex items-center gap-2 text-[20px] font-medium tracking-[-0.04em]">
                <ShoppingBag className="size-5" strokeWidth={1.5} aria-hidden="true" />
                Gear bought through AthaNext
              </h2>
              {gear.length ? gear.map((item, i) => (
                <div key={`${item.title}-${i}`} className="flex items-center justify-between gap-3 border-t border-[#EAEADF] py-3">
                  <span className="text-[14px]">
                    {item.title}
                    {item.refunded ? <span className="text-[#767980]"> · partly refunded</span> : null}
                  </span>
                  <b className="text-[14px]">{money(item.amount)}</b>
                </div>
              )) : <p className={meta}>Nothing yet. Purchases show up here after they're paid on Shopify.</p>}
              <div className="flex items-baseline justify-between border-t border-[#EAEADF] pt-3">
                <span className="text-[14px] text-[#484D56]">Total spent</span>
                <b className="text-[20px] font-semibold">{money(spentTotal)}</b>
              </div>
              <p className={meta}>
                Sessions and packages with you {money(athlete.spent)} · gear on AthaNext {money(athlete.gearTotal)}, after refunds
              </p>
            </section>

            <section className={card}>
              <h2 className="text-[20px] font-medium tracking-[-0.04em]">Private note</h2>
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
