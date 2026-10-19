/** "Your booking" column on Book a Session (Working Copy `AN.summaryCard`): picks, credits, totals, Review and pay. */
import { ShieldCheck, X } from "@/components/icons";
import { BrandPill } from "@/components/brand";
import type { BookableSession, BookingCoach } from "@/api/book";
import { Switch } from "@/components/ui/switch";
import { card, meta, primaryButton, textButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { bookableStart, money } from "@/utils/booking";
import { getZonedISODate } from "@/utils/dateHelpers";
import { formatClock, formatDayISO, plural } from "@/utils/schedule";
import { FeeLines } from "./FeeLines";
import { firstName, reviewLabel, type BookingPlan } from "./bookSummary";

const between = "flex items-center justify-between gap-3";
const total28 = "text-highlight tabular-nums text-dark";

const CreditsSwitch = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <div className={between}>
    <span className="flex flex-col gap-1">
      <span className="text-label-sm">Use package credits</span>
      <span className={meta}>Applied before payment</span>
    </span>
    <Switch checked={checked} onCheckedChange={onChange} aria-label="Use package credits" />
  </div>
);

export const BookingSummary = ({
  picked,
  coaches,
  plan,
  pillarOf,
  timeZone,
  useCredits,
  onUseCreditsChange,
  onRemove,
  onClear,
  onReview,
}: {
  /** Sorted by start. */
  picked: BookableSession[];
  coaches: Record<string, BookingCoach>;
  plan: BookingPlan;
  /** Pillar each time was picked under in Book by pillar. */
  pillarOf: Record<string, string>;
  timeZone: string;
  useCredits: boolean;
  onUseCreditsChange: (v: boolean) => void;
  onRemove: (session: BookableSession) => void;
  onClear: () => void;
  onReview: () => void;
}) => {
  const requestIds = new Set(plan.requests.map((s) => s.id));
  const directName = firstName(coaches[plan.direct[0]?.coachId]);
  const onlyDirect = plan.direct.length > 0 && !plan.subtotal && !plan.requests.length;
  return (
    <section className={card} aria-label="Your booking">
      <div className={between}>
        <h2 className="text-card-title text-dark">Your booking</h2>
        {picked.length ? (
          <button type="button" className={cn(textButton, "text-dark-300")} onClick={onClear}>
            Clear
          </button>
        ) : null}
      </div>

      {picked.length ? (
        <div className="flex flex-col divide-y divide-light-525">
          {picked.map((s) => {
            const start = bookableStart(s);
            const day = formatDayISO(getZonedISODate(start, timeZone), { weekday: "short", month: "short", day: "numeric" });
            const what = s.sessionType === "group" ? s.sessionName : s.pillar || pillarOf[s.id];
            return (
              <div key={s.id} className="flex items-start justify-between gap-2.5 py-2.5">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-label-sm">
                    {day}, {formatClock(start, timeZone)}
                  </span>
                  <span className={meta}>{[firstName(coaches[s.coachId]), what].filter(Boolean).join(", ")}</span>
                </span>
                <span className="flex flex-none items-center gap-1.5">
                  <span className="text-label-sm tabular-nums">
                    {requestIds.has(s.id) ? (
                      <BrandPill tone="amber">Request</BrandPill>
                    ) : plan.covered.has(s.id) ? (
                      <BrandPill tone="green">Credit</BrandPill>
                    ) : (
                      money(s.price)
                    )}
                  </span>
                  <button
                    type="button"
                    className="inline-flex size-[28px] items-center justify-center rounded-control text-dark-300 hover:bg-light hover:text-dark"
                    aria-label={`Remove ${day}, ${formatClock(start, timeZone)}`}
                    onClick={() => onRemove(s)}
                  >
                    <X className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-control border border-dashed border-light-600 px-4 py-6 text-center text-body-m text-dark-300">
          Sessions you pick show up here. You can mix days, weeks and coaches.
        </p>
      )}

      {plan.availableCredits > 0 ? <CreditsSwitch checked={useCredits} onChange={onUseCreditsChange} /> : null}

      <div className="flex flex-col gap-2.5 rounded-control bg-light-400 px-4 py-3.5">
        {onlyDirect ? (
          <>
            <div className={cn(between, "items-baseline")}>
              <span className="text-subtitle">Pay {directName} directly</span>
              <span className={total28}>{money(plan.payDirect)}</span>
            </div>
            <span className={meta}>Nothing is charged in AthaNext.</span>
          </>
        ) : (
          <>
            <div className={between}>
              <span className="text-body-m text-dark-300">Sessions</span>
              <span className="text-body-m tabular-nums">{money(plan.subtotal)}</span>
            </div>
            {plan.requests.length ? (
              <div className={between}>
                <span className="text-body-m text-dark-300">{plural(plan.requests.length, "request")}, not charged yet</span>
                <span className="text-body-m tabular-nums text-dark-200">{money(plan.ifAccepted)}</span>
              </div>
            ) : null}
            <FeeLines platformFees={plan.platformFees} processingFees={plan.processingFees} />
            <div className="h-px bg-light-525" />
            <div className={cn(between, "items-baseline")}>
              <span className="text-subtitle">{plan.direct.length ? "Due now" : "Total"}</span>
              <span className={total28}>{money(plan.dueNow)}</span>
            </div>
            {plan.direct.length ? (
              <div className={cn(between, "items-baseline")}>
                <span className="text-body-m text-dark-300">Pay {directName} directly</span>
                <span className="text-label-sm tabular-nums">{money(plan.payDirect)}</span>
              </div>
            ) : null}
          </>
        )}
      </div>

      <button type="button" className={cn(primaryButton, "h-[44px] w-full")} disabled={!picked.length} onClick={onReview}>
        {reviewLabel(plan)}
      </button>
      <p className="flex items-start gap-2.5 rounded-control bg-light-400 px-3.5 py-3 text-caption text-dark-300">
        <ShieldCheck className="size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
        Free cancellation with 24 hours notice. Cancelled sessions come back as a credit with the same coach.
      </p>
    </section>
  );
};
