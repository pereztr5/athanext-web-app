/**
 * Bottom bars on Book a Session (Working Copy `.mob-pay`, `.pickbar`). Widths follow the page's
 * container: medium is 821-1200px, phone is 820px and under.
 */
import { X } from "@/components/icons";
import type { BookableSession, BookingCoach } from "@/api/book";
import { cn } from "@/lib/utils";
import { bookableStart, money } from "@/utils/booking";
import { getZonedISODate } from "@/utils/dateHelpers";
import { formatClock, formatDayISO } from "@/utils/schedule";
import { meta, primaryButton } from "@/components/schedule/styles";
import { bookSum, dueCaption, dueText, firstName, reviewLabel, type BookingPlan } from "./bookSummary";

/** Phone tab bar is fixed, so these bars are too — sticky would sit behind it (or below the fold). Tablet has no tab bar. */
const stickyBottom =
  "z-20 border-t border-light-525 bg-light-300 max-[820px]:fixed max-[820px]:inset-x-0 max-[820px]:bottom-[calc(61px+env(safe-area-inset-bottom))] min-[821px]:sticky min-[821px]:bottom-0 min-[821px]:-mx-5 min-[821px]:-mb-12";
const total28 = "text-highlight tabular-nums text-dark";

export const MobilePayBar = ({
  plan,
  count,
  onPhone,
  onReview,
}: {
  plan: BookingPlan;
  count: number;
  /** Phone shows the pick bar instead while a time picker is open. */
  onPhone: boolean;
  onReview: () => void;
}) =>
  count ? (
    <div
      className={cn(
        stickyBottom,
        "hidden min-[821px]:max-[1399px]:flex min-[821px]:max-[1399px]:flex-row min-[821px]:max-[1399px]:items-center min-[821px]:max-[1399px]:justify-between min-[821px]:max-[1399px]:gap-6 min-[821px]:max-[1399px]:px-5 min-[821px]:max-[1399px]:py-3.5",
        onPhone && "max-[820px]:flex max-[820px]:flex-col max-[820px]:gap-2 max-[820px]:px-4 max-[820px]:pb-3.5 max-[820px]:pt-3"
      )}
    >
      <div className="flex flex-1 items-center justify-between gap-3 min-[821px]:max-w-[360px]">
        <span className="text-label-sm">{bookSum(plan, count)}</span>
        <span className={total28}>{dueText(plan)}</span>
      </div>
      <button type="button" className={cn(primaryButton, "h-[40px] flex-none px-6 max-[820px]:h-[44px] max-[820px]:w-full")} onClick={onReview}>
        {reviewLabel(plan)}
      </button>
    </div>
  ) : null;

export const PickBar = ({
  picked,
  coaches,
  plan,
  timeZone,
  onRemove,
  onContinue,
}: {
  /** Sorted by start. */
  picked: BookableSession[];
  coaches: Record<string, BookingCoach>;
  plan: BookingPlan;
  timeZone: string;
  onRemove: (session: BookableSession) => void;
  onContinue: () => void;
}) => {
  if (!picked.length) return null;
  const many = new Set(picked.map((s) => s.coachId)).size > 1;
  return (
    <div className={cn(stickyBottom, "hidden flex-col gap-2.5 px-4 pb-3 pt-2.5 max-[820px]:flex")}>
      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {picked.map((s) => {
          const start = bookableStart(s);
          const iso = getZonedISODate(start, timeZone);
          const clock = formatClock(start, timeZone);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onRemove(s)}
              className="inline-flex h-[30px] flex-none items-center gap-1.5 rounded-control border border-primary-300 bg-primary-100 px-2.5 text-label-sm text-primary-700"
              aria-label={`Remove ${formatDayISO(iso, { weekday: "short", month: "short", day: "numeric" })}, ${clock}`}
            >
              {many ? `${firstName(coaches[s.coachId])}, ` : ""}
              {formatDayISO(iso, { weekday: "short" })} {formatDayISO(iso, { day: "numeric" })} · {clock.replace(":00", "")}
              <X className="size-3 opacity-70" strokeWidth={2} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex flex-col gap-1">
          <span className="text-paragraph-sm text-dark-300">
            {bookSum(plan, picked.length)}
            {dueCaption(plan)}
          </span>
          <span className={total28}>{dueText(plan)}</span>
        </span>
        <button type="button" className={cn(primaryButton, "h-[44px] px-6")} onClick={onContinue}>
          Continue
        </button>
      </div>
    </div>
  );
};

/** In-card footer on wide screens (Working Copy `.pickfoot`). Hidden on phone, where the pick bar takes over. */
export const PickFoot = ({
  plan,
  count,
  onContinue,
}: {
  plan: BookingPlan;
  count: number;
  onContinue: () => void;
}) => (
  <div className="hidden items-center justify-between gap-3 border-t border-light-525 pt-4 min-[821px]:flex">
    <span className="flex min-w-0 flex-col gap-1">
      <span className="text-label-sm">{count ? bookSum(plan, count) : "Tap one or more times"}</span>
      <span className={meta}>
        {count
          ? plan.dueNow || !plan.requests.length
            ? `Total ${money(plan.dueNow)}`
            : `${money(plan.ifAccepted)}, charged only if accepted`
          : "Times are in your time zone. Free cancellation up to 24 hours before."}
      </span>
    </span>
    <button type="button" className={primaryButton} disabled={!count} onClick={onContinue}>
      Continue
    </button>
  </div>
);
