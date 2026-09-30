/**
 * Coach calendar week views (ATH-28): a time grid on desktop and a day-by-day list on
 * phones. Blocks come from layoutCoachWeek; clicking one opens a details popover.
 */
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import type { CalendarBlock, CalendarBlockKind, CalendarWeekLayout } from "@/utils/coachCalendar";
import { formatDateInZone, formatInstantSpan } from "@/utils/viewerTime";
import { isBookingWindowClosed } from "@/utils/dateHelpers";

const HOUR_PX = 48;

const KIND_STYLES: Record<CalendarBlockKind, string> = {
  booked: "border-[#CCDDF0] bg-[#E5EDF7] text-[#0054B4]",
  group: "border-[#BFE3EE] bg-[#E7F4F8] text-[#1599BC]",
  request: "border-[#E5A763] bg-[#FDF7EC] text-[#906A29]",
  open: "border-dashed border-[#C1C1B8] bg-[#F9F9F5] text-[#767980]",
};

const LEGEND: { kind: CalendarBlockKind; label: string }[] = [
  { kind: "booked", label: "Booked" },
  { kind: "group", label: "Group" },
  { kind: "request", label: "Request" },
  { kind: "open", label: "Open slot" },
];

export const CalendarLegend = () => (
  <ul className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Legend">
    {LEGEND.map((item) => (
      <li key={item.kind} className="flex items-center gap-[6px] text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
        <span className={cn("size-3 rounded-[3px] border", KIND_STYLES[item.kind])} aria-hidden="true" />
        {item.label}
      </li>
    ))}
  </ul>
);

interface BlockActions {
  timeZone: string;
  respondingId: string | null;
  onRespond: (bookingId: string, accept: boolean) => void;
}

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-3 text-[12px] leading-[16px] tracking-[-0.03em]">
    <span className="text-[#767980]">{label}</span>
    <span className="text-right font-medium text-[#1A202C]">{value}</span>
  </div>
);

/** Details for one block, with Accept / Decline for a request. */
const BlockDetails = ({ block, timeZone, respondingId, onRespond }: BlockActions & { block: CalendarBlock }) => {
  const occ = block.occurrence;
  const started = isBookingWindowClosed(occ.occurrence_date, occ.start_time);
  const request = block.requests[0];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-[16px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">{occ.session_name}</p>
        <p className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
          {formatDateInZone(new Date(block.start), timeZone, { weekday: "short", month: "short", day: "numeric" })},{" "}
          {formatInstantSpan(new Date(block.start), new Date(block.end), timeZone)}
        </p>
      </div>
      <div className="flex flex-col gap-[6px]">
        <DetailRow label="Type" value={occ.session_type === "group" ? "Group" : "Individual"} />
        {occ.location ? <DetailRow label="Location" value={occ.location === "online" ? "Online" : "In person"} /> : null}
        {occ.pillar_slot ? <DetailRow label="Pillar" value={occ.pillar_slot} /> : null}
        {block.kind === "request" && request ? <DetailRow label="Requested by" value={request.athleteName} /> : null}
        {block.athleteNames.length > 0 ? <DetailRow label="Athletes" value={block.athleteNames.join(", ")} /> : null}
        {occ.session_type === "group" ? (
          <DetailRow label="Booked" value={`${block.athleteNames.length} of ${occ.max_bookings_per_slot ?? "-"}`} />
        ) : null}
      </div>
      {block.kind === "request" && request ? (
        <div className="flex flex-col gap-2">
          {started ? (
            <p className="text-[12px] leading-[14px] text-[#767980]">This session has started, so it can only be declined.</p>
          ) : null}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={respondingId !== null} onClick={() => onRespond(request.bookingId, false)}>
              Decline
            </Button>
            <Button size="sm" disabled={respondingId !== null || started} onClick={() => onRespond(request.bookingId, true)}>
              Accept
            </Button>
          </div>
        </div>
      ) : block.kind === "open" ? (
        <Link to={ROUTES.AVAILABILITY} className="text-[12px] font-medium text-[#0054B4] hover:underline">
          Edit availability
        </Link>
      ) : (
        <Link to={ROUTES.MY_SESSIONS} className="text-[12px] font-medium text-[#0054B4] hover:underline">
          View in Sessions
        </Link>
      )}
    </div>
  );
};

const BlockButton = ({
  block,
  timeZone,
  className,
  style,
  compact,
  ...actions
}: BlockActions & {
  block: CalendarBlock;
  className?: string;
  style?: CSSProperties;
  compact?: boolean;
}) => {
  const span = formatInstantSpan(new Date(block.start), new Date(block.end), timeZone);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          style={style}
          aria-label={`${block.title}, ${span}${block.detail ? `, ${block.detail}` : ""}`}
          className={cn(
            "flex min-w-0 flex-col items-start overflow-hidden rounded-[6px] border px-[6px] py-[3px] text-left transition-shadow hover:shadow-[0_0_6px_rgba(0,0,0,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]",
            KIND_STYLES[block.kind],
            className
          )}
        >
          <span className="w-full truncate text-[12px] font-medium leading-[14px] tracking-[-0.03em]">{block.title}</span>
          <span className={cn("w-full truncate text-[11px] leading-[13px] opacity-80", compact && "hidden")}>{span}</span>
          {block.detail ? (
            <span className={cn("w-full truncate text-[11px] leading-[13px] opacity-80", compact && "hidden")}>{block.detail}</span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 bg-[#F7F7F0]">
        <BlockDetails block={block} timeZone={timeZone} {...actions} />
      </PopoverContent>
    </Popover>
  );
};

const hourLabel = (hour: number) => {
  const h = hour % 24;
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
};

/** Label for a calendar date (the days are already in the viewer's zone). */
const dayLabel = (iso: string, options: Intl.DateTimeFormatOptions) =>
  formatDateInZone(new Date(`${iso}T12:00:00Z`), "UTC", options);

interface ViewProps extends BlockActions {
  layout: CalendarWeekLayout;
  todayISO: string;
}

/** Desktop week grid: Mon–Sun columns over the layout's hour range. */
export const WeekGrid = ({ layout, todayISO, timeZone, ...actions }: ViewProps) => {
  const hours = Array.from({ length: layout.endHour - layout.startHour }, (_, i) => layout.startHour + i);
  const height = hours.length * HOUR_PX;
  return (
    <div className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))]">
      <div />
      {layout.days.map((iso) => (
        <div
          key={iso}
          className={cn(
            "border-b border-[#EAEADF] pb-2 text-center text-[12px] font-medium leading-[14px] tracking-[-0.03em]",
            iso === todayISO ? "text-[#0054B4]" : "text-[#767980]"
          )}
        >
          <span className="block">{dayLabel(iso, { weekday: "short" })}</span>
          <span className="block text-[16px] leading-[20px]">{dayLabel(iso, { day: "numeric" })}</span>
        </div>
      ))}
      <div className="relative" style={{ height }}>
        {hours.map((hour, i) => (
          <span
            key={hour}
            className="absolute right-2 -translate-y-1/2 text-[11px] leading-[13px] text-[#A3A6AB]"
            style={{ top: i * HOUR_PX }}
          >
            {i === 0 ? "" : hourLabel(hour)}
          </span>
        ))}
      </div>
      {layout.days.map((iso, dayIndex) => (
        <div
          key={iso}
          className={cn("relative border-l border-[#EAEADF]", iso === todayISO && "bg-[#F9F9F5]")}
          style={{
            height,
            backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, #EAEADF ${HOUR_PX - 1}px, #EAEADF ${HOUR_PX}px)`,
          }}
        >
          {layout.blocks
            .filter((block) => block.dayIndex === dayIndex)
            .map((block) => {
              const top = ((block.startMinutes - layout.startHour * 60) / 60) * HOUR_PX;
              const blockHeight = Math.max(((block.endMinutes - block.startMinutes) / 60) * HOUR_PX - 2, 18);
              return (
                <BlockButton
                  key={block.id}
                  block={block}
                  timeZone={timeZone}
                  compact={blockHeight < 40}
                  className="absolute inset-x-[3px]"
                  style={{ top: top + 1, height: blockHeight }}
                  {...actions}
                />
              );
            })}
        </div>
      ))}
    </div>
  );
};

/** Phone view: one section per day with its blocks in time order. */
export const DayList = ({ layout, todayISO, timeZone, ...actions }: ViewProps) => (
  <div className="flex flex-col gap-4">
    {layout.days.map((iso, dayIndex) => {
      const blocks = layout.blocks.filter((block) => block.dayIndex === dayIndex);
      return (
        <section key={iso} className="flex flex-col gap-2">
          <h3
            className={cn(
              "text-[14px] font-medium leading-[18px] tracking-[-0.03em]",
              iso === todayISO ? "text-[#0054B4]" : "text-[#1A202C]"
            )}
          >
            {dayLabel(iso, { weekday: "long", month: "short", day: "numeric" })}
          </h3>
          {blocks.length ? (
            blocks.map((block) => (
              <BlockButton key={block.id} block={block} timeZone={timeZone} className="w-full gap-[2px] px-3 py-2" {...actions} />
            ))
          ) : (
            <p className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#A3A6AB]">Nothing scheduled</p>
          )}
        </section>
      );
    })}
  </div>
);
