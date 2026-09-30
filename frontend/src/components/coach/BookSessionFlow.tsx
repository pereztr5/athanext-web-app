import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BrandPill } from "@/components/brand";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useBookableOccurrences } from "@/hooks/useBookableOccurrences";
import { useFeeConfig } from "@/hooks/useFeeConfig";
import { useReferralWaiver } from "@/hooks/useReferrals";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { groupOfferings, offeringDays, offeringTimes, type BookingOffering } from "@/utils/bookingFlow";
import { parseISODateLocal } from "@/utils/dateHelpers";
import { PROFILE_TYPE } from "@/utils/db";
import { computeSessionPrice, formatPriceBreakdown } from "@/utils/referralHelpers";
import { formatLocationSentence, formatTimeSpan, formatWholePrice } from "@/utils/sessionFormatting";
import { toBookSlotPayload, type BookSlotPayload } from "@/utils/slotBooking";
import { formatDateInZone } from "@/utils/viewerTime";

const STEPS = [
  { label: "Session", prompt: "Choose a session type" },
  { label: "Day", prompt: "Pick a day" },
  { label: "Time", prompt: "Pick a time" },
  { label: "Review", prompt: "Review your booking" },
] as const;

const modalSurface =
  "bg-[#F7F7F0] border border-[#EAEADF] rounded-[10px] sm:rounded-[10px] shadow-[0_0_15px_rgba(0,0,0,0.05)] font-sans text-[#1A202C] tracking-[-0.03em]";
const closeButtonOverride =
  "[&>button]:text-[#767980] [&>button]:opacity-100 [&>button:hover]:text-[#1A202C] [&>button]:right-[13px] [&>button]:top-[11px] sm:[&>button]:right-[17px] sm:[&>button]:top-[19px] [&>button_svg]:stroke-[1.5]";
const optionClass = (selected: boolean) =>
  cn(
    "flex w-full flex-col gap-1.5 rounded-[8px] border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]",
    selected ? "border-[#6698D2] bg-[#E5EDF7]" : "border-[#EAEADF] bg-[#F4F4EB] hover:bg-[#EAEADF]"
  );
const metaText = "text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]";
const fieldLabel = "text-[12px] font-medium leading-[13px] tracking-[-0.03em] text-[#767980]";

const formatDayLabel = (isoDate: string) =>
  parseISODateLocal(isoDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

interface BookSessionButtonProps {
  coachId: string;
  coachName: string;
  /** Opens CoachSchedulingModal prefilled, exactly like a table-row Book click. Omit for viewers who can't book. */
  onBookSlot?: (payload: BookSlotPayload) => void;
  /** Shown next to the empty state when there's nothing to book. */
  onMessageCoach?: () => void;
}

/**
 * "Book a session" on the coach profile (ATH-28): a guided session -> day -> time -> review flow
 * over the same open slots as the availability table, handing off to the existing booking modal.
 * Signed-out visitors go to sign-in and come back; coaches don't see it.
 */
export const BookSessionButton = ({ coachId, coachName, onBookSlot, onMessageCoach }: BookSessionButtonProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const canBook = !user || Boolean(onBookSlot);
  const { bookable, statusMap, isLoading, isError } = useBookableOccurrences(canBook ? coachId : null);

  if (!canBook) return null;

  const isEmpty = !isLoading && !isError && bookable.length === 0;

  const handleClick = () => {
    if (!user) {
      navigate(`${ROUTES.AUTH}?mode=signin`, { state: { from: location } });
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-[10px]">
        <Button onClick={handleClick} disabled={isLoading || isEmpty} aria-busy={isLoading || undefined}>
          {isLoading ? (
            <Loader2 className="animate-spin" strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <CalendarPlus strokeWidth={1.5} aria-hidden="true" />
          )}
          Book a session
        </Button>
        {isEmpty ? (
          <>
            <span className={metaText}>No open sessions right now</span>
            {onMessageCoach && user ? (
              <Button variant="outline" onClick={onMessageCoach}>
                Message coach
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
      {user && onBookSlot ? (
        <BookSessionDialog
          open={open}
          onOpenChange={setOpen}
          coachId={coachId}
          coachName={coachName}
          bookable={bookable}
          statusMap={statusMap}
          isError={isError}
          onConfirm={(payload) => {
            setOpen(false);
            onBookSlot(payload);
          }}
        />
      ) : null}
    </>
  );
};

interface BookSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coachId: string;
  coachName: string;
  bookable: ReturnType<typeof useBookableOccurrences>["bookable"];
  statusMap: ReturnType<typeof useBookableOccurrences>["statusMap"];
  isError: boolean;
  onConfirm: (payload: BookSlotPayload) => void;
}

const BookSessionDialog = ({
  open,
  onOpenChange,
  coachId,
  coachName,
  bookable,
  statusMap,
  isError,
  onConfirm,
}: BookSessionDialogProps) => {
  const timeZone = useViewerTimeZone();
  const { profile } = useProfile();
  const athleteProfileId =
    profile?.type === PROFILE_TYPE.athlete && profile?.data ? (profile.data as { id?: string }).id : undefined;
  const { platformFeePerc, stripeFeePerc } = useFeeConfig();
  // Existing client of this coach: no platform fee, same as the table and booking modal.
  const { waived: platformFeeWaived } = useReferralWaiver(open ? athleteProfileId : undefined, open ? coachId : undefined);

  const [step, setStep] = useState(0);
  const [offeringKey, setOfferingKey] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [occurrenceId, setOccurrenceId] = useState<string | null>(null);
  const headingRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setOfferingKey(null);
    setDay(null);
    setOccurrenceId(null);
  }, [open]);

  const offerings = useMemo(() => groupOfferings(bookable), [bookable]);
  const offering = offerings.find((o) => o.key === offeringKey) ?? null;
  const days = useMemo(
    () => (offeringKey ? offeringDays(bookable, offeringKey, timeZone) : []),
    [bookable, offeringKey, timeZone]
  );
  const times = useMemo(
    () => (offeringKey && day ? offeringTimes(bookable, offeringKey, day, timeZone, statusMap) : []),
    [bookable, offeringKey, day, timeZone, statusMap]
  );
  const selectedTime = times.find((t) => t.occurrence.id === occurrenceId) ?? null;

  // A slot taken while the dialog is open drops out of the lists; clear choices that no longer exist.
  useEffect(() => {
    if (offeringKey && !offering) setOfferingKey(null);
    if (day && !days.some((d) => d.date === day)) setDay(null);
    if (occurrenceId && !selectedTime) setOccurrenceId(null);
  }, [offeringKey, offering, day, days, occurrenceId, selectedTime]);

  const canContinue = [Boolean(offering), Boolean(day), Boolean(selectedTime), Boolean(selectedTime)][step];
  const goTo = (next: number) => {
    setStep(next);
    // Move focus to the step prompt so keyboard and screen reader users land on the new step.
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const athleteTotal = (base: number) => computeSessionPrice(base, platformFeePerc, stripeFeePerc, platformFeeWaived).total;

  const renderOffering = (o: BookingOffering) => (
    <button
      key={o.key}
      type="button"
      aria-pressed={offeringKey === o.key}
      onClick={() => {
        if (offeringKey !== o.key) {
          setDay(null);
          setOccurrenceId(null);
        }
        setOfferingKey(o.key);
      }}
      className={optionClass(offeringKey === o.key)}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="text-[16px] font-medium leading-[20px]">{o.sessionName}</span>
        <span className="flex-none text-right text-[16px] font-medium leading-[20px]">
          {formatWholePrice(athleteTotal(o.price))}
          <span className={cn(metaText, "block font-normal")}>per athlete</span>
        </span>
      </span>
      <span className="flex flex-wrap gap-1.5">
        <BrandPill tone={o.sessionType === "group" ? "teal" : "blue"}>
          {o.sessionType === "group" ? "Group" : "Individual"}
        </BrandPill>
        <BrandPill tone="neutral">{formatLocationSentence(o.location)}</BrandPill>
        {o.pillar ? <BrandPill tone="neutral">{o.pillar}</BrandPill> : null}
      </span>
      <span className={metaText}>
        {o.durationMinutes} min · {o.openCount} open {o.openCount === 1 ? "time" : "times"}
      </span>
    </button>
  );

  const renderStep = () => {
    if (isError) {
      return <p className={metaText}>Couldn't load open sessions. Please try again later.</p>;
    }
    if (step === 0) {
      if (!offerings.length) return <p className={metaText}>No open sessions right now.</p>;
      return (
        <div role="group" aria-label="Session types" className="flex flex-col gap-2.5">
          {offerings.map(renderOffering)}
        </div>
      );
    }
    if (step === 1) {
      return (
        <div role="group" aria-label="Days with open times" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {days.map((d) => (
            <button
              key={d.date}
              type="button"
              aria-pressed={day === d.date}
              onClick={() => {
                if (day !== d.date) setOccurrenceId(null);
                setDay(d.date);
              }}
              className={optionClass(day === d.date)}
            >
              <span className="text-[14px] font-medium leading-[18px]">{formatDayLabel(d.date)}</span>
              <span className={metaText}>
                {d.openCount} open {d.openCount === 1 ? "time" : "times"}
              </span>
            </button>
          ))}
        </div>
      );
    }
    if (step === 2) {
      return (
        <div role="group" aria-label={day ? `Open times on ${formatDayLabel(day)}` : "Open times"} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {times.map((t) => (
            <button
              key={t.occurrence.id}
              type="button"
              aria-pressed={occurrenceId === t.occurrence.id}
              onClick={() => setOccurrenceId(t.occurrence.id)}
              className={optionClass(occurrenceId === t.occurrence.id)}
            >
              <span className="text-[14px] font-medium leading-[18px]">{formatTimeSpan(t.start, t.end, timeZone, true)}</span>
              {t.spotsLeft !== null ? (
                <span className={metaText}>
                  {t.spotsLeft} {t.spotsLeft === 1 ? "spot" : "spots"} left
                </span>
              ) : null}
            </button>
          ))}
        </div>
      );
    }
    if (!offering || !selectedTime) return null;
    const total = athleteTotal(offering.price);
    const details = [
      { label: "Coach", value: coachName },
      { label: "Date", value: formatDateInZone(selectedTime.start, timeZone, { weekday: "long", month: "short", day: "numeric" }) },
      {
        label: "Time",
        value: `${formatTimeSpan(selectedTime.start, selectedTime.end, timeZone, true)}, ${offering.durationMinutes} min`,
      },
      { label: "Location", value: formatLocationSentence(offering.location) },
      { label: "Price", value: formatPriceBreakdown(offering.price, platformFeePerc, stripeFeePerc, platformFeeWaived) },
      ...(selectedTime.spotsLeft !== null
        ? [{ label: "Spots left", value: String(selectedTime.spotsLeft) }]
        : []),
    ];
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-5">
          <div className="flex min-w-0 flex-col gap-2.5">
            <p className="text-[20px] font-medium leading-[24px] tracking-[-0.05em]">{offering.sessionName}</p>
            <div className="flex flex-wrap gap-1.5">
              <BrandPill tone={offering.sessionType === "group" ? "teal" : "blue"}>
                {offering.sessionType === "group" ? "Group" : "Individual"}
              </BrandPill>
              {offering.pillar ? <BrandPill tone="neutral">{offering.pillar}</BrandPill> : null}
            </div>
          </div>
          <div className="flex flex-none flex-col items-end gap-1.5 text-right">
            <p className="text-[32px] font-bold leading-[30px] tracking-[-0.03em]">${total.toFixed(2)}</p>
            <p className={metaText}>Total, fees included</p>
            {platformFeeWaived ? <BrandPill tone="green">No service fee</BrandPill> : null}
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-[8px] bg-[#F4F4EB] px-5 py-4 sm:grid-cols-2">
          {details.map((item) => (
            <div key={item.label} className="flex flex-col gap-1.5">
              <dt className={fieldLabel}>{item.label}</dt>
              <dd className="text-[14px] leading-[18px] tracking-[-0.03em]">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[90vh] max-w-2xl gap-0 overflow-y-auto p-0", modalSurface, closeButtonOverride)}>
        <DialogHeader className="gap-4 px-[25px] py-5 pr-14 text-left">
          <DialogTitle className="text-[24px] font-semibold leading-[30px] tracking-[-0.05em]">Book a session</DialogTitle>
          <DialogDescription className="sr-only">
            Step {step + 1} of {STEPS.length}: {STEPS[step].prompt}
          </DialogDescription>
          <ol aria-label="Booking steps" className="flex flex-wrap items-center gap-1.5">
            {STEPS.map((s, index) => (
              <li
                key={s.label}
                aria-current={index === step ? "step" : undefined}
                className="flex items-center gap-1.5"
              >
                <BrandPill tone={index === step ? "blue" : index < step ? "green" : "muted"}>
                  <span aria-hidden="true">{index + 1}</span>
                  {s.label}
                </BrandPill>
              </li>
            ))}
          </ol>
        </DialogHeader>
        <div className="h-px bg-[#EAEADF]" />

        <div className="flex flex-col gap-4 px-[25px] py-5">
          <p
            ref={headingRef}
            tabIndex={-1}
            className="text-[16px] font-medium leading-[20px] tracking-[-0.03em] focus:outline-none"
          >
            {STEPS[step].prompt}
          </p>
          {renderStep()}
        </div>

        <div className="h-px bg-[#EAEADF]" />
        <div className="flex flex-col-reverse gap-[10px] px-[25px] py-5 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={() => (step === 0 ? onOpenChange(false) : goTo(step - 1))}>
            {step === 0 ? "Cancel" : "Back"}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => goTo(step + 1)} disabled={!canContinue}>
              Next
            </Button>
          ) : (
            <Button onClick={() => selectedTime && onConfirm(toBookSlotPayload(selectedTime.occurrence))} disabled={!canContinue}>
              Continue to confirm
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BookSessionButton;
