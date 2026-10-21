/**
 * "Book with Michael" from the Coaches card on Home. A compact Book a Session for one coach,
 * built from the same pieces: the time picker (session type and open times), packages, the
 * credits switch and Review and pay (ReviewDialog, which calls the same bookAPI.checkout).
 * Full height on phone.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ticket } from "@/components/icons";
import { BrandPill } from "@/components/brand";
import { bookAPI, type BookableSession, type BookingCoach } from "@/api/book";
import { RequestTimeDialog, ReviewDialog } from "@/components/book/BookDialogs";
import { BuyPackagesDialog } from "@/components/book/BuyPackagesDialog";
import { TimePicker } from "@/components/book/TimePicker";
import { bookSum, dueText, reviewLabel } from "@/components/book/bookSummary";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dialogContent, meta, primaryButton, secondaryButton, smallButton, textButton } from "@/components/schedule/styles";
import { useBookingFees } from "@/hooks/useBookingFees";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { planBooking } from "@/utils/bookPlan";
import { firstNameOf } from "@/utils/myCoaches";
import { plural } from "@/utils/schedule";
import { isoDateInZone } from "@/utils/viewerTime";

/** Centered on wide screens, a full-height sheet on phone. */
const sheet = cn(
  dialogContent,
  "flex max-w-[760px] flex-col",
  "max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0",
  "max-[430px]:top-0 max-[430px]:max-h-[100dvh]"
);

export const QuickBookDialog = ({
  coach: target,
  athleteId,
  athleteFirst,
  timeZone,
  onClose,
}: {
  /** Null keeps it closed. */
  coach: { id: string; name: string } | null;
  athleteId: string | null;
  athleteFirst: string | null;
  timeZone: string;
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const todayISO = isoDateInZone(new Date(), timeZone);
  const fees = useBookingFees(athleteId);
  const [picked, setPicked] = useState<BookableSession[]>([]);
  const [useCredits, setUseCredits] = useState(true);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [packagesOpen, setPackagesOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);

  const coachQuery = useQuery({
    queryKey: ["booking-coach", target?.id],
    enabled: Boolean(target),
    queryFn: () => bookAPI.sessions(target!.id, todayISO, todayISO).then((r) => r.coach),
  });
  const coach: BookingCoach | null = coachQuery.data ?? null;
  const coaches = useMemo(() => (coach ? { [coach.id]: coach } : {}), [coach]);
  const sorted = useMemo(
    () => [...picked].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)),
    [picked]
  );
  const plan = planBooking(sorted, coaches, useCredits, fees);
  const first = target ? firstNameOf(target.name) : "";

  const close = () => {
    setPicked([]);
    setReviewOpen(false);
    setPackagesOpen(false);
    setRequestOpen(false);
    onClose();
  };
  const toggle = (session: BookableSession) =>
    setPicked((cur) => (cur.some((s) => s.id === session.id) ? cur.filter((s) => s.id !== session.id) : [...cur, session]));

  const open = Boolean(target);
  const covered = reviewOpen || packagesOpen || requestOpen;

  return (
    <>
      <Dialog open={open && !covered} onOpenChange={(o) => !o && close()}>
        <DialogContent className={sheet}>
          <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
            <DialogTitle className="text-section">Book with {first}</DialogTitle>
            <DialogDescription className={meta}>Pick one or more times. Times are in your time zone.</DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4 sm:px-[25px]">
            {coachQuery.isLoading ? (
              <p className={meta}>Loading {first}'s times…</p>
            ) : !coach ? (
              <div className="flex flex-col items-start gap-3">
                <p className={meta}>{first}'s times couldn't load.</p>
                <Link to={`${ROUTES.BOOK}?coach=${target?.id ?? ""}`} className={secondaryButton} onClick={close}>
                  Open Book a session
                </Link>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {coach.credits ? (
                    <BrandPill tone="green">
                      <Ticket className="size-3" strokeWidth={1.5} aria-hidden="true" />
                      {plural(coach.credits, "credit")} left
                    </BrandPill>
                  ) : null}
                  <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => setPackagesOpen(true)}>
                    Packages
                  </button>
                  <Link to={`${ROUTES.BOOK}?coach=${coach.id}`} className={cn(textButton, "ml-auto")} onClick={close}>
                    Open full booking page
                  </Link>
                </div>
                <TimePicker
                  key={coach.id}
                  coach={coach}
                  pillar={null}
                  picked={picked}
                  onToggle={toggle}
                  alwaysShowDetails={false}
                  timeZone={timeZone}
                  todayISO={todayISO}
                  onRequestTime={() => setRequestOpen(true)}
                  lockedBy={null}
                  fees={fees}
                  useCredits={useCredits}
                  athleteFirst={athleteFirst}
                />
              </>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-light-525 px-5 py-3.5 pb-[calc(14px+env(safe-area-inset-bottom))] sm:px-[25px]">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-label-sm">{picked.length ? bookSum(plan, picked.length) : "Tap one or more times"}</span>
              {picked.length ? <span className="text-subtitle tabular-nums">{dueText(plan)}</span> : null}
            </span>
            <button type="button" className={primaryButton} disabled={!picked.length} onClick={() => setReviewOpen(true)}>
              {picked.length ? reviewLabel(plan) : "Review and pay"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <ReviewDialog
        open={open && reviewOpen}
        onOpenChange={setReviewOpen}
        coaches={coaches}
        picked={sorted}
        pillar={null}
        athleteId={athleteId}
        timeZone={timeZone}
        useCredits={useCredits}
        onUseCreditsChange={setUseCredits}
        onRemove={(s) => {
          setPicked((cur) => cur.filter((x) => x.id !== s.id));
          if (picked.length <= 1) setReviewOpen(false);
        }}
        onBooked={() => {
          queryClient.invalidateQueries({ queryKey: ["athlete-home"] });
          close();
        }}
      />
      <BuyPackagesDialog coach={open && packagesOpen ? coach : null} onClose={() => setPackagesOpen(false)} />
      <RequestTimeDialog
        coach={open && requestOpen ? coach : null}
        pillar={null}
        todayISO={todayISO}
        timeZone={timeZone}
        onClose={() => setRequestOpen(false)}
      />
    </>
  );
};
