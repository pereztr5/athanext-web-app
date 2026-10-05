/**
 * Pick-and-pay card for a published week of group sessions (ATH-72). Families tick the
 * sessions they want and pay once; coaches see how full the week is. Shown under the
 * coach's message in the group chat and on the shared link page.
 */
import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { BrandPill } from "@/components/brand";
import { groupOffersAPI, type GroupOfferSession } from "@/api/schedule";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useToast } from "@/hooks/use-toast";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { PROFILE_TYPE } from "@/utils/db";
import { formatDateInZone, formatInstantSpan } from "@/utils/viewerTime";
import { plural, sessionEnd, sessionStart } from "@/utils/schedule";
import { meta, primaryButton } from "./styles";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

const toTimes = (s: GroupOfferSession) => ({
  start: sessionStart({ date: s.date, startTime: s.startTime }),
  end: sessionEnd({ date: s.date, endTime: s.endTime }),
});

export const GroupOfferCard = ({ offerId, className }: { offerId: string; className?: string }) => {
  const { user, userProfile } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const timeZone = useViewerTimeZone();
  const [picked, setPicked] = useState<string[]>([]);

  const athleteId =
    profile?.type === PROFILE_TYPE.athlete && profile?.data ? ((profile.data as { id?: string }).id ?? null) : null;

  const offerQuery = useQuery({
    queryKey: ["group-offer", offerId, user?.id ?? null],
    queryFn: () => groupOffersAPI.get(offerId),
  });
  const offer = offerQuery.data;

  const pay = useMutation({
    mutationFn: () => groupOffersAPI.checkout(picked, athleteId!),
    onSuccess: (result) => {
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      toast({
        title: "Request sent",
        description: "The coach will accept or decline. You'll pay once they accept, from My Sessions.",
      });
      setPicked([]);
      queryClient.invalidateQueries({ queryKey: ["group-offer", offerId] });
    },
    onError: (error: unknown) =>
      toast({
        title: "Couldn't book these sessions",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      }),
  });

  const sessions = useMemo(() => (offer?.sessions ?? []).filter((s) => !s.started), [offer]);
  const total = sessions.filter((s) => picked.includes(s.id)).reduce((n, s) => n + s.price, 0);

  if (offerQuery.isLoading) {
    return <div className={cn("h-[120px] animate-pulse rounded-[10px] bg-[#F1F1E6]", className)} />;
  }
  if (!offer) {
    return (
      <div className={cn("rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] p-4", meta, className)}>
        This schedule isn't available anymore.
      </div>
    );
  }

  const isOwner = Boolean(userProfile?.coach_id && userProfile.coach_id === offer.coachId);
  const canPick = Boolean(athleteId) && !offer.closed;
  const closes = new Date(offer.closesAt);
  const booked = sessions.reduce((n, s) => n + s.bookedCount, 0);
  const capacity = sessions.reduce((n, s) => n + s.capacity, 0);

  return (
    <div className={cn("flex w-full max-w-[420px] flex-col gap-3 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] p-4", className)}>
      <BrandPill tone="teal" className="self-start">
        Group sessions
        {offer.closed
          ? " · closed"
          : ` · closes ${formatDateInZone(closes, timeZone, { weekday: "short", hour: "numeric", minute: "2-digit" })}`}
      </BrandPill>
      <div className="flex flex-col gap-1">
        <b className="text-[18px] font-semibold leading-[22px] tracking-[-0.04em] text-[#1A202C]">{offer.title}</b>
        <span className={meta}>
          {isOwner || !athleteId ? `${booked} of ${capacity} spots booked · ${offer.coachName}` : `With ${offer.coachName}`}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {sessions.length ? (
          sessions.map((s) => {
            const { start, end } = toTimes(s);
            const full = s.bookedCount >= s.capacity;
            const mine = Boolean(s.myStatus);
            const on = picked.includes(s.id);
            const selectable = canPick && !mine && !full;
            const row = (
              <>
                {canPick ? (
                  <span
                    className={cn(
                      "flex size-[20px] flex-none items-center justify-center rounded-[5px] border",
                      on || mine ? "border-[#0054B4] bg-[#0054B4] text-[#F1F1E6]" : "border-[#C1C1B8] bg-[#F9F9F5]"
                    )}
                    aria-hidden="true"
                  >
                    {on || mine ? <Check className="size-3.5" strokeWidth={2} /> : null}
                  </span>
                ) : null}
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <b className="text-[14px] font-medium leading-[18px]">
                    {formatDateInZone(start, timeZone, { weekday: "short", day: "numeric" })} ·{" "}
                    {formatInstantSpan(start, end, timeZone)}
                  </b>
                  <small className={meta}>
                    {s.sessionName} · {s.location === "online" ? "Video call" : s.place || "In person"}
                  </small>
                  <span className="block h-[4px] w-full overflow-hidden rounded-full bg-[#D9D9CF]" aria-hidden="true">
                    <i
                      className="block h-full rounded-full bg-[#117A96]"
                      style={{ width: `${Math.min(100, (s.bookedCount / Math.max(1, s.capacity)) * 100)}%` }}
                    />
                  </span>
                </span>
                <span className="flex flex-none flex-col items-end gap-0.5 text-right">
                  <b className="text-[14px] font-medium">{money(s.price)}</b>
                  <small className={meta}>
                    {mine
                      ? s.myStatus === "requested"
                        ? "Requested"
                        : s.myStatus === "pending_payment"
                          ? "To pay"
                          : "You're in"
                      : full
                        ? "Full"
                        : `${plural(s.capacity - s.bookedCount, "spot")} left`}
                  </small>
                </span>
              </>
            );
            const rowClass = cn(
              "flex w-full items-center gap-3 rounded-[8px] border px-3 py-2.5 text-left",
              on ? "border-[#6698D2] bg-[#E5EDF7]" : "border-[#EAEADF] bg-[#F9F9F5]",
              full && !mine ? "opacity-60" : ""
            );
            return selectable ? (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                className={cn(rowClass, "hover:bg-[#F1F1E6]")}
                onClick={() => setPicked((cur) => (on ? cur.filter((id) => id !== s.id) : [...cur, s.id]))}
              >
                {row}
              </button>
            ) : (
              <div key={s.id} className={rowClass}>
                {row}
              </div>
            );
          })
        ) : (
          <p className={meta}>These sessions have passed.</p>
        )}
      </div>

      {!user && !offer.closed ? (
        <Link
          to={`${ROUTES.AUTH}?mode=signin`}
          state={{ from: { pathname: location.pathname, search: location.search } }}
          className={cn(primaryButton, "h-[40px]")}
        >
          Sign in to pick sessions
        </Link>
      ) : null}

      {canPick && picked.length ? (
        <div className="flex items-center justify-between gap-3 border-t border-[#EAEADF] pt-3">
          <span className="flex flex-col">
            <span className={meta}>{plural(picked.length, "session")}</span>
            <b className="text-[18px] font-semibold">{money(total)}</b>
          </span>
          <button type="button" className={cn(primaryButton, "h-[40px]")} disabled={pay.isPending} onClick={() => pay.mutate()}>
            {pay.isPending ? "Opening checkout…" : `Book ${plural(picked.length, "session")}`}
          </button>
        </div>
      ) : null}
    </div>
  );
};
