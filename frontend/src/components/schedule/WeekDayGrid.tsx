/**
 * Shared Create-session-style week grid (Working Copy 4 createweek.js):
 * date-tile day cards with status-pill chips and Add on future days.
 * Used by My schedule (desktop week + phone agenda) and Create session.
 */
import { Plus } from "@/components/icons";
import { BrandPill } from "@/components/brand";
import {
  addDay,
  dateTile,
  dateTileMonth,
  dateTileNumber,
  dateTileWeekday,
  dayCol,
} from "@/components/schedule/plan/parts";
import { striped } from "@/components/schedule/views/styles";
import { cn } from "@/lib/utils";
import type { ScheduleSession } from "@/api/schedule";
import { campDayTitle } from "@/utils/campSessions";
import {
  bookedAthletes,
  formatClock,
  formatDayISO,
  plural,
  requestsFor,
  type ScheduleDay,
  type ScheduleItem,
} from "@/utils/schedule";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export type WeekDayOpen = (session: ScheduleSession) => void;

/** WC4 `.cw-chip`: time, name, and a status pill. */
export const WeekChip = ({
  item,
  timeZone,
  onOpen,
}: {
  item: ScheduleItem;
  timeZone: string;
  onOpen: WeekDayOpen;
}) => {
  const time = <span className="text-label-xsm text-dark-300">{formatClock(item.start, timeZone)}</span>;
  const kind = item.kind;

  if (kind === "busy") {
    return (
      <div className={cn("flex flex-col gap-1 rounded-control border border-light-525 border-l-[3px] border-l-light-600 px-2 py-2", striped)}>
        {time}
        <span className="text-body-m text-dark-300">Busy</span>
      </div>
    );
  }

  const session = item.session!;
  const open = () => onOpen(session);

  if (kind === "open") {
    return (
      <button
        type="button"
        className="flex w-full flex-col items-start gap-1 rounded-control border border-dashed border-primary-200 bg-transparent px-2 py-2 text-left hover:bg-primary-50"
        onClick={open}
      >
        {time}
        <span className="text-label-sm text-dark">Open slot</span>
        <span className="text-caption text-primary">
          1-on-1 · {money(session.price)}
          {session.seriesId ? " · Repeats weekly" : ""}
        </span>
      </button>
    );
  }

  const who =
    kind === "group"
      ? session.camp
        ? campDayTitle(session.camp.name, session.camp.dayIndex)
        : session.sessionName
      : kind === "request"
        ? requestsFor(session)[0]?.athleteName ?? "Request"
        : kind === "offered"
          ? session.offeredNames[0] ?? "Offered"
          : bookedAthletes(session)[0]?.athleteName ?? "Athlete";

  const tag =
    kind === "group" ? (
      <BrandPill tone="green">
        {bookedAthletes(session).length} of {session.capacity} booked
      </BrandPill>
    ) : kind === "request" ? (
      <BrandPill tone="amber">Request</BrandPill>
    ) : kind === "offered" ? (
      <BrandPill tone="neutral">Offered</BrandPill>
    ) : (
      <BrandPill tone="blue">1-on-1</BrandPill>
    );

  return (
    <button
      type="button"
      className="flex w-full flex-col items-start gap-1 rounded-control border border-light-525 bg-light-300 px-2 py-2 text-left hover:bg-light-200"
      onClick={open}
    >
      {time}
      <span className="w-full truncate text-label-sm text-dark">{who}</span>
      {tag}
    </button>
  );
};

/** One day card: date tile, chips, optional Add. */
export const WeekDayColumn = ({
  day,
  todayISO,
  timeZone,
  phone,
  onOpen,
  onAdd,
  onOpenDay,
}: {
  day: ScheduleDay;
  todayISO: string;
  timeZone: string;
  phone?: boolean;
  onOpen: WeekDayOpen;
  onAdd?: (date: string) => void;
  /** When set, the date tile opens Day view (My schedule desktop). */
  onOpenDay?: (date: string) => void;
}) => {
  const past = day.date < todayISO;
  const isToday = day.date === todayISO;
  const n = day.items.filter((i) => i.kind !== "busy").length;
  const tile = (
    <span className={cn(dateTile, isToday && "border-primary outline outline-1 -outline-offset-2 outline-primary")}>
      <small className={dateTileMonth}>{formatDayISO(day.date, { month: "short" })}</small>
      <b className={dateTileNumber}>{formatDayISO(day.date, { day: "numeric" })}</b>
      <em className={dateTileWeekday}>{formatDayISO(day.date, { weekday: "short" })}</em>
    </span>
  );

  return (
    <div
      id={isToday ? "sch-today" : undefined}
      className={cn(dayCol(day.items.length > 0), past && "opacity-55", phone ? "min-h-0" : "md:min-h-[380px]")}
    >
      <div className={cn("flex items-center justify-center gap-3", phone && "justify-start")}>
        {onOpenDay ? (
          <button
            type="button"
            className="rounded-control text-left hover:opacity-90"
            aria-label={`Open ${formatDayISO(day.date, { weekday: "long", month: "long", day: "numeric" })}`}
            onClick={() => onOpenDay(day.date)}
          >
            {tile}
          </button>
        ) : (
          tile
        )}
        {phone ? (
          <>
            <span className="grow text-subtitle text-dark">
              {formatDayISO(day.date, { month: "short", day: "numeric" })}
            </span>
            <span className="text-caption text-dark-300">{n ? plural(n, "session") : "Nothing yet"}</span>
          </>
        ) : null}
      </div>
      {isToday && !phone ? <span className="text-center text-label-xsm text-primary">Today</span> : null}
      {day.dayOff && !day.items.length ? (
        <span className="py-1 text-label-xsm text-info-800">Day off</span>
      ) : null}
      {day.items.length ? (
        <div className="flex flex-col gap-1.5">
          {day.items.map((item) => (
            <WeekChip key={item.key} item={item} timeZone={timeZone} onOpen={onOpen} />
          ))}
        </div>
      ) : null}
      {!past && onAdd ? (
        <button type="button" className={addDay} onClick={() => onAdd(day.date)}>
          <Plus strokeWidth={2} aria-hidden="true" />
          Add
        </button>
      ) : null}
    </div>
  );
};

/** Seven columns on desktop, or a stack when `phone`. */
export const WeekDayGrid = ({
  days,
  todayISO,
  timeZone,
  phone,
  onOpen,
  onAdd,
  onOpenDay,
}: {
  days: ScheduleDay[];
  todayISO: string;
  timeZone: string;
  phone?: boolean;
  onOpen: WeekDayOpen;
  onAdd?: (date: string) => void;
  onOpenDay?: (date: string) => void;
}) => (
  <div className={cn(phone ? "flex flex-col gap-2.5" : "grid grid-cols-7 gap-2")}>
    {days.map((day) => (
      <WeekDayColumn
        key={day.date}
        day={day}
        todayISO={todayISO}
        timeZone={timeZone}
        phone={phone}
        onOpen={onOpen}
        onAdd={onAdd}
        onOpenDay={onOpenDay}
      />
    ))}
  </div>
);
