/**
 * Chat week post / shared-link pick-and-pay card (ATH-72, Working Copy 4 pickpost.js).
 * Families: date tiles, spots left (orange at 2 or fewer), Review and pay.
 * Coach: Live/Closed, fill bars, Edit, Copy link, View in My schedule.
 * Time/place changes ask booked families Still coming or Cancel (session credit, not card refund).
 * Price changes apply to new picks only.
 */
import { errorMessage } from "@/utils/errorMessage";
import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Link2, Pencil } from "@/components/icons";
import { BrandPill } from "@/components/brand";
import { groupOffersAPI, type GroupOfferSession } from "@/api/schedule";
import { OfferEditSheet } from "@/components/schedule/group-offer/OfferEditSheet";
import { OfferPaySheet } from "@/components/schedule/group-offer/OfferPaySheet";
import { SuggestionCard } from "@/components/schedule/group-offer/SuggestionCard";
import {
  DateTile,
  FillMini,
  SessionPills,
  cardFoot,
  cardHead,
  cardShell,
  money,
  rowClass,
  sessionWhere,
  tiny,
  titleClass,
} from "@/components/schedule/group-offer/parts";
import { meta, primaryButton, secondaryButton, smallButton } from "@/components/schedule/styles";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useToast } from "@/hooks/use-toast";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { PROFILE_TYPE } from "@/utils/db";
import { formatDateInZone, formatInstantSpan } from "@/utils/viewerTime";
import { formatClock, formatDayISO, plural, sessionEnd, sessionStart } from "@/utils/schedule";

const inMine = (s: GroupOfferSession) => Boolean(s.myStatus && s.myStatus !== "canceled" && !s.myUnpaid);
// Picked, then left Stripe without paying. It doesn't hold the spot; Finish paying reopens checkout.
const isUnpaid = (s: GroupOfferSession) => s.myUnpaid && !s.cancelled;

export const GroupOfferCard = ({ offerId, className }: { offerId: string; className?: string }) => {
  const { user, userProfile } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const timeZone = useViewerTimeZone();
  const [picked, setPicked] = useState<string[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [payUnpaid, setPayUnpaid] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const athleteId =
    profile?.type === PROFILE_TYPE.athlete && profile?.data ? ((profile.data as { id?: string }).id ?? null) : null;
  const athleteName =
    profile?.type === PROFILE_TYPE.athlete && profile?.data
      ? ((profile.data as { full_name?: string }).full_name ?? "your athlete")
      : "your athlete";

  const offerQuery = useQuery({
    queryKey: ["group-offer", offerId, user?.id ?? null],
    queryFn: () => groupOffersAPI.get(offerId),
  });
  const offer = offerQuery.data;

  const answer = useMutation({
    mutationFn: ({ id, keep }: { id: string; keep: boolean }) => groupOffersAPI.answerChange(id, keep),
    onSuccess: (result, vars) => {
      queryClient.invalidateQueries({ queryKey: ["group-offer", offerId] });
      toast({
        title: vars.keep ? "Thanks, still coming" : "You're out of this session",
        description: vars.keep ? undefined : result.credit ? "It came back as a session credit with this coach." : "Nothing was charged.",
      });
    },
    onError: (err: unknown) =>
      toast({
        title: "Couldn't update",
        description: errorMessage(err, "Try again."),
        variant: "destructive",
      }),
  });

  const sessions = useMemo(() => {
    const list = offer?.sessions ?? [];
    // Show cancelled rows for context; hide sessions that already started unless cancelled.
    return list.filter((s) => s.cancelled || !s.started);
  }, [offer]);

  if (offerQuery.isLoading) {
    return <div className={cn("h-[140px] animate-pulse rounded-card bg-light", className)} />;
  }
  if (!offer) {
    return (
      <div className={cn("rounded-card border border-light-525 bg-light-300 p-4", meta, className)}>
        This schedule isn&apos;t available anymore.
      </div>
    );
  }

  const isOwner = Boolean(userProfile?.coach_id && userProfile.coach_id === offer.coachId);
  if (offer.kind === "suggestion") return <SuggestionCard offer={offer} isOwner={isOwner} className={className} />;
  const isOfferCard = offer.kind === "offer";
  const canPick = Boolean(athleteId) && !offer.closed;
  const closes = new Date(offer.closesAt);
  const live = sessions.filter((s) => !s.cancelled);
  const booked = live.reduce((n, s) => n + s.bookedCount, 0);
  const capacity = live.reduce((n, s) => n + s.capacity, 0);
  // A coach's offer with one bookable session needs no ticking: Review and pay goes straight to it.
  const unpaid = live.filter((s) => isUnpaid(s) && s.capacity - s.bookedCount > 0);
  const openToPick = live.filter((s) => !inMine(s) && !isUnpaid(s) && s.capacity - s.bookedCount > 0);
  const single = isOfferCard && canPick && !unpaid.length && openToPick.length === 1;
  const selected = payUnpaid ? unpaid : single ? openToPick : live.filter((s) => picked.includes(s.id));
  const total = selected.reduce((n, s) => n + s.price, 0);
  const mineN = live.filter((s) => inMine(s)).length;
  const first = offer.coachName.split(" ")[0] || "Coach";
  const shareLink = `${window.location.origin}/offers/${offer.id}`;

  const title = (() => {
    if (isOfferCard) {
      const n = live.length || offer.sessions.length;
      return isOwner ? `You offered ${plural(n, "session")}` : `${first} offered ${n === 1 ? "you a session" : plural(n, "session")}`;
    }
    if (!/^Week of/i.test(offer.title || "")) return offer.title;
    const dates = live.map((s) => s.date).sort();
    if (!dates.length) return offer.title;
    const mon = dates[0]!;
    const sun = dates[dates.length - 1]!;
    return `${isOwner ? "Your" : `${first}'s`} sessions, ${formatDayISO(mon, { month: "short", day: "numeric" })} to ${formatDayISO(sun, { month: "short", day: "numeric" })}`;
  })();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Couldn't copy the link", variant: "destructive" });
    }
  };

  if (isOwner) {
    return (
      <>
        <div className={cn(cardShell, className)}>
          <div className={cardHead}>
            <div className="flex items-center justify-between gap-3">
              <b className="text-subtitle">{title}</b>
              {offer.closed ? <BrandPill tone="neutral">Closed</BrandPill> : <BrandPill tone="green">Live</BrandPill>}
            </div>
            <span className={meta}>
              {offer.closed
                ? "No more picks"
                : `${isOfferCard ? "Bookable until" : "Closes"} ${formatDateInZone(closes, timeZone, { weekday: "short", hour: "numeric", minute: "2-digit" })}`}
              {` · ${shareLink.replace(/^https?:\/\//, "")}`}
            </span>
          </div>
          <div className="flex flex-col divide-y divide-light-525">
            {sessions.length ? (
              sessions.map((s) => {
                const start = sessionStart({ date: s.date, startTime: s.startTime });
                const end = sessionEnd({ date: s.date, endTime: s.endTime });
                return (
                  <div key={s.id} className={rowClass({ faded: s.cancelled })}>
                    <DateTile day={s.date} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1" style={{ flexBasis: 140 }}>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <b className={titleClass}>{s.sessionName}</b>
                        <SessionPills session={s} role="coach" />
                      </span>
                      <span className={meta}>
                        {s.cancelled
                          ? s.bookedCount
                            ? `${plural(s.bookedCount, "family", "families")} got a session credit`
                            : "Cancelled"
                          : `${formatInstantSpan(start, end, timeZone)} · ${sessionWhere(s)}${
                              s.pendingConfirmCount ? ` · ${s.pendingConfirmCount} asked to confirm` : ""
                            }`}
                      </span>
                    </span>
                    {s.cancelled ? null : (
                      <span className="flex flex-none flex-col items-end gap-1">
                        <span className={tiny}>
                          {s.bookedCount} of {s.capacity}
                        </span>
                        <FillMini booked={s.bookedCount} capacity={s.capacity} />
                      </span>
                    )}
                  </div>
                );
              })
            ) : (
              <p className={cn(meta, "px-4 py-3")}>These sessions have passed.</p>
            )}
          </div>
          <div className={cardFoot}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-label-sm">{booked ? `${plural(booked, "spot")} booked` : "No picks yet"}</span>
              <span className={meta}>
                {booked} of {capacity} spots
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={cn(secondaryButton, smallButton)} onClick={copyLink}>
                <Link2 className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                Copy link
              </button>
              <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => navigate(ROUTES.SCHEDULE)}>
                View in My schedule
              </button>
              {sessions.length && !isOfferCard ? (
                <button type="button" className={cn(primaryButton, smallButton)} onClick={() => setEditOpen(true)}>
                  <Pencil className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                  Edit
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <OfferEditSheet open={editOpen} onOpenChange={setEditOpen} offer={offer} coachId={offer.coachId} />
      </>
    );
  }

  return (
    <>
      <div className={cn(cardShell, className)}>
        <div className={cardHead}>
          <b className="text-subtitle">{title}</b>
          <span className={meta}>
            {unpaid.length && !picked.length
              ? `You left before paying, so ${unpaid.length === 1 ? "this spot isn't" : "these spots aren't"} held. Finish paying to book.`
              : mineN && !picked.length
              ? `${athleteName.split(" ")[0] || "You're"} in ${plural(mineN, "session")}. Change anything from My sessions.`
              : single
                ? "Review the details and pay to book it."
                : "Tick the ones you want and pay once."}
          </span>
        </div>
        <div className="flex flex-col divide-y divide-light-525">
          {sessions.length ? (
            sessions.map((s) => {
              const start = sessionStart({ date: s.date, startTime: s.startTime });
              const end = sessionEnd({ date: s.date, endTime: s.endTime });
              const mine = inMine(s);
              const owed = isUnpaid(s);
              const left = s.capacity - s.bookedCount;
              const full = !mine && (left <= 0 || offer.closed || s.cancelled);
              const on = picked.includes(s.id);
              const ask = !s.cancelled && mine && s.myChangeAsk === "pending";
              const ans = !s.cancelled && mine && s.myChangeAsk === "keep";
              const selectable = canPick && !mine && !owed && !full && !single;
              const lead = s.cancelled ? (
                <span className="size-[18px] flex-none" aria-hidden="true" />
              ) : mine ? (
                <span className="flex size-5 flex-none items-center justify-center rounded-full border border-success-300 bg-success-100 text-success-700" aria-hidden="true">
                  <Check className="size-3" strokeWidth={2} />
                </span>
              ) : full ? (
                <span className="size-[18px] flex-none" aria-hidden="true" />
              ) : (
                <span
                  className={cn(
                    "flex size-[18px] flex-none items-center justify-center rounded-pill border-[1.5px]",
                    on ? "border-primary bg-primary text-light" : "border-light-600 bg-light-50"
                  )}
                  aria-hidden="true"
                >
                  {on ? <Check className="size-3" strokeWidth={2} /> : null}
                </span>
              );
              const right = s.cancelled ? null : (
                <span className="flex flex-none flex-col items-end gap-0.5 text-right">
                  <b className="text-label-sm">{money(mine && s.myPaidAmount != null ? s.myPaidAmount : s.price)}</b>
                  <small
                    className={cn(
                      meta,
                      mine ? "text-success-700" : owed ? "font-medium text-info-800" : !full && left <= 2 ? "font-medium text-info-800" : ""
                    )}
                  >
                    {mine
                      ? `${athleteName.split(" ")[0] || "You're"} in`
                      : owed && !full
                        ? "Not paid yet"
                        : offer.closed
                        ? "Closed"
                        : left <= 0
                          ? "Full"
                          : `${plural(left, "spot")} left`}
                  </small>
                </span>
              );
              const from = s.changeFrom;
              const askBox = ask ? (
                <div className="flex w-full flex-col gap-2 rounded-control border border-info-300 bg-info-50 px-3 py-2.5">
                  <span className={cn(meta, "text-info-700")}>
                    {from && from.date !== s.date
                      ? `Moved from ${formatDayISO(from.date, { weekday: "short", month: "short", day: "numeric" })}`
                      : from && from.startTime.slice(0, 5) !== s.startTime.slice(0, 5)
                        ? `Moved from ${formatClock(sessionStart({ date: from.date, startTime: from.startTime }), timeZone)}`
                        : "New place"}
                    {from && (from.place !== s.place || from.location !== s.location) ? `, now at ${sessionWhere(s)}` : ""}. Is{" "}
                    {athleteName.split(" ")[0] || "your athlete"} still coming?
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={cn(primaryButton, smallButton)}
                      disabled={answer.isPending}
                      onClick={() => answer.mutate({ id: s.id, keep: true })}
                    >
                      Still coming
                    </button>
                    <button
                      type="button"
                      className={cn(secondaryButton, smallButton)}
                      disabled={answer.isPending}
                      onClick={() => answer.mutate({ id: s.id, keep: false })}
                    >
                      Cancel for a session credit
                    </button>
                  </div>
                </div>
              ) : null;
              const inner = (
                <>
                  {(canPick && !single) || mine || full ? lead : null}
                  <DateTile day={s.date} />
                  <span className="flex min-w-0 flex-1 flex-col gap-1" style={{ flexBasis: 140 }}>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <b className={cn(titleClass, s.cancelled && "line-through")}>{s.sessionName}</b>
                      <SessionPills session={s} role="athlete" />
                    </span>
                    <span className={meta}>
                      {s.cancelled
                        ? mine
                          ? "Cancelled by the coach · session credit"
                          : "Cancelled by the coach"
                        : `${formatInstantSpan(start, end, timeZone)} · ${sessionWhere(s)}`}
                    </span>
                    {ans ? <span className={cn(meta, "text-success-700")}>You confirmed the change</span> : null}
                  </span>
                  {right}
                  {askBox}
                </>
              );
              if (selectable) {
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    className={rowClass({ tap: true })}
                    onClick={() => setPicked((cur) => (on ? cur.filter((id) => id !== s.id) : [...cur, s.id]))}
                  >
                    {inner}
                  </button>
                );
              }
              return (
                <div key={s.id} className={rowClass({ faded: s.cancelled || (full && !mine) })}>
                  {inner}
                </div>
              );
            })
          ) : (
            <p className={cn(meta, "px-4 py-3")}>These sessions have passed.</p>
          )}
        </div>

        {!user && !offer.closed ? (
          <div className={cardFoot}>
            <Link
              to={`${ROUTES.AUTH}?mode=signin`}
              state={{ from: { pathname: location.pathname, search: location.search } }}
              className={cn(primaryButton, "h-10 w-full")}
            >
              Sign in to pick sessions
            </Link>
          </div>
        ) : null}

        {canPick && !offer.closed ? (
          <div className={cardFoot}>
            {unpaid.length && !picked.length ? (
              <button
                type="button"
                className={cn(primaryButton, "h-10 w-full")}
                onClick={() => {
                  setPayUnpaid(true);
                  setPayOpen(true);
                }}
              >
                Finish paying · {money(unpaid.reduce((n, s) => n + s.price, 0))}
              </button>
            ) : single ? (
              <button type="button" className={cn(primaryButton, "h-10 w-full")} onClick={() => setPayOpen(true)}>
                Review and pay · {money(total)}
              </button>
            ) : picked.length ? (
              <button type="button" className={cn(primaryButton, "h-10 w-full")} onClick={() => setPayOpen(true)}>
                Continue with {plural(picked.length, "session")} · {money(total)}
              </button>
            ) : null}
            <span className={cn(meta, "text-center")}>
              Booking for {athleteName.split(" ")[0] || "your athlete"} · {isOfferCard ? "Book by" : "Closes"}{" "}
              {formatDateInZone(closes, timeZone, { weekday: "short", hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
        ) : null}
      </div>

      {athleteId ? (
        <OfferPaySheet
          open={payOpen}
          onOpenChange={(next) => {
            setPayOpen(next);
            if (!next) setPayUnpaid(false);
          }}
          offer={offer}
          sessions={selected}
          athleteId={athleteId}
          athleteName={athleteName}
          onPaid={() => setPicked([])}
        />
      ) : null}
    </>
  );
};
