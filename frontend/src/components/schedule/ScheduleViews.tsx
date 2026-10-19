/**
 * My schedule views (ATH-71, Working Copy 4): Day (date-tile strip + chips), Week (Create-session
 * grid on web and phone), Month (grid). Open slots are dashed blue, busy times striped.
 * Booking requests open the session dialog (Accept lives there and on Requests).
 */
import { ChevronDown, ChevronUp, Plus } from "@/components/icons";
import { cn } from "@/lib/utils";
import {
  addDaysISO,
  formatDayISO,
  plural,
  weekStartISO,
  type ScheduleDay,
} from "@/utils/schedule";
import { dateTile, dateTileMonth, dateTileNumber, dateTileWeekday } from "./plan/parts";
import { dangerTextButton, secondaryButton, smallButton, textButton } from "./styles";
import { WeekChip, WeekDayColumn, WeekDayGrid } from "./WeekDayGrid";
import { striped } from "./views/styles";
import type { ScheduleSession } from "@/api/schedule";

export interface ScheduleViewHandlers {
  onOpenSession: (session: ScheduleSession) => void;
  onRespond: (bookingId: string, accept: boolean) => void;
  respondingId: string | null;
}

export const WeekColumns = ({
  days,
  todayISO,
  timeZone,
  handlers,
  onOpenDay,
  onAdd,
}: {
  days: ScheduleDay[];
  todayISO: string;
  timeZone: string;
  handlers: ScheduleViewHandlers;
  onOpenDay: (date: string) => void;
  onAdd?: (date: string) => void;
}) => (
  <WeekDayGrid
    days={days}
    todayISO={todayISO}
    timeZone={timeZone}
    onOpen={handlers.onOpenSession}
    onOpenDay={onOpenDay}
    onAdd={onAdd}
  />
);

export const WeekAgenda = ({
  days,
  todayISO,
  weekStart,
  showEarlier,
  onToggleEarlier,
  nextWeekLabel,
  onShowNextWeek,
  timeZone,
  handlers,
  onOpenDay,
  onAdd,
}: {
  days: ScheduleDay[];
  todayISO: string;
  weekStart: string;
  showEarlier: boolean;
  onToggleEarlier: () => void;
  nextWeekLabel: string;
  onShowNextWeek: () => void;
  timeZone: string;
  handlers: ScheduleViewHandlers;
  onOpenDay?: (date: string) => void;
  onAdd?: (date: string) => void;
}) => {
  const weekEnd = addDaysISO(weekStart, 6);
  const past = days.filter((d) => d.date >= weekStart && d.date < todayISO && d.date <= weekEnd);
  const pastSessions = past.reduce((n, d) => n + d.items.filter((i) => i.kind !== "busy").length, 0);
  const visible = days.filter((d) => showEarlier || d.date >= todayISO || d.date > weekEnd);

  return (
    <div className="flex flex-col gap-2.5">
      {past.length ? (
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-card border border-dashed border-light-600 bg-transparent px-3.5 py-3 text-left text-body-m text-dark-300"
          aria-expanded={showEarlier}
          onClick={onToggleEarlier}
        >
          <span className="grow">
            {showEarlier ? "Hide earlier days" : `Earlier this week · ${plural(pastSessions, "session")}`}
          </span>
          {showEarlier ? (
            <ChevronUp className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <ChevronDown className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          )}
        </button>
      ) : null}

      <div className="flex flex-col gap-2.5">
        {visible.map((day) => {
          const isWeekStart = day.date > weekEnd && day.date === weekStartISO(day.date);
          return (
            <div key={day.date} className="flex flex-col gap-2">
              {isWeekStart ? (
                <p className="px-0.5 pt-2 text-label-xsm text-dark-300">
                  Week of {formatDayISO(day.date, { month: "short", day: "numeric" })}
                </p>
              ) : null}
              <WeekDayColumn
                day={day}
                todayISO={todayISO}
                timeZone={timeZone}
                phone
                onOpen={handlers.onOpenSession}
                onOpenDay={onOpenDay}
                onAdd={onAdd}
              />
            </div>
          );
        })}
      </div>

      <button type="button" className={cn(secondaryButton, "h-[40px] w-full")} onClick={onShowNextWeek}>
        <ChevronDown className="size-4" strokeWidth={1.5} aria-hidden="true" />
        Show the week of {nextWeekLabel}
      </button>
    </div>
  );
};

export const DayView = ({
  days,
  selected,
  todayISO,
  timeZone,
  handlers,
  onSelect,
  onAdd,
  onClearDay,
  onRestoreDay,
}: {
  days: ScheduleDay[];
  selected: string;
  todayISO: string;
  timeZone: string;
  handlers: ScheduleViewHandlers;
  onSelect: (date: string) => void;
  onAdd: (date: string) => void;
  onClearDay: (date: string) => void;
  onRestoreDay: (date: string) => void;
}) => {
  const day = days.find((d) => d.date === selected) ?? days[0];
  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex flex-wrap justify-center gap-2 md:gap-3" role="group" aria-label="Days">
        {days.map((d) => {
          const on = d.date === day.date;
          const past = d.date < todayISO;
          return (
            <button
              key={d.date}
              type="button"
              aria-pressed={on}
              aria-label={formatDayISO(d.date, { weekday: "long", month: "long", day: "numeric" })}
              onClick={() => onSelect(d.date)}
              className={cn("rounded-control", past && "opacity-55")}
            >
              <span
                className={cn(
                  dateTile,
                  on && "border-primary outline outline-1 -outline-offset-2 outline-primary",
                  d.date === todayISO && !on && "border-primary-300",
                )}
              >
                <small className={dateTileMonth}>{formatDayISO(d.date, { month: "short" })}</small>
                <b className={dateTileNumber}>{formatDayISO(d.date, { day: "numeric" })}</b>
                <em className={dateTileWeekday}>{formatDayISO(d.date, { weekday: "short" })}</em>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-subtitle text-dark">
          {formatDayISO(day.date, { weekday: "long", month: "long", day: "numeric" })}
        </h3>
        {day.date >= todayISO ? (
          <span className="flex items-center gap-1.5">
            <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => onAdd(day.date)}>
              <Plus strokeWidth={1.5} aria-hidden="true" />
              Add
            </button>
            {day.dayOff ? (
              <button type="button" className={cn(textButton, "px-2")} onClick={() => onRestoreDay(day.date)}>
                Undo day off
              </button>
            ) : (
              <button type="button" className={cn(dangerTextButton, "px-2")} onClick={() => onClearDay(day.date)}>
                Clear day
              </button>
            )}
          </span>
        ) : null}
      </div>

      {day.dayOff && !day.items.length ? (
        <div className="rounded-card border border-dashed border-light-600 p-[18px] text-center text-body-m text-dark-300">
          Day off{day.dayOff.note ? ` · ${day.dayOff.note}` : ""}.
        </div>
      ) : day.items.length ? (
        <div className="flex flex-col gap-2">
          {day.items.map((item) => (
            <WeekChip key={item.key} item={item} timeZone={timeZone} onOpen={handlers.onOpenSession} />
          ))}
        </div>
      ) : (
        <p className="text-body-m text-dark-300">
          Nothing on this day yet. Tap Add to create a session or open times.
        </p>
      )}
    </div>
  );
};

/** Month grid (Working Copy `.sch-month`): dots and counts per day; tap a day to open it. */
export const MonthView = ({
  cells,
  daysByDate,
  todayISO,
  onOpenDay,
}: {
  cells: (string | null)[];
  daysByDate: Map<string, ScheduleDay>;
  todayISO: string;
  onOpenDay: (date: string) => void;
}) => (
  <div className="grid grid-cols-7 gap-1 md:gap-1.5">
    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
      <span key={w} className="text-center text-caption text-dark-300 md:px-1.5 md:text-left">
        {w}
      </span>
    ))}
    {cells.map((date, i) => {
      if (!date) return <span key={`blank-${i}`} />;
      const day = daysByDate.get(date);
      const sessions = (day?.items ?? []).filter((item) => item.kind !== "open" && item.kind !== "busy");
      const open = (day?.items ?? []).filter((item) => item.kind === "open").length;
      const today = date === todayISO;
      return (
        <button
          key={date}
          type="button"
          onClick={() => onOpenDay(date)}
          className={cn(
            "flex min-h-[50px] min-w-0 flex-col items-center gap-[3px] rounded-card border border-light-525 bg-light-300 px-1 py-[5px] text-left transition-colors hover:border-primary md:min-h-[88px] md:items-start md:gap-1 md:p-2",
            today && "border-primary outline outline-1 -outline-offset-2 outline-primary",
            date < todayISO && "opacity-55",
            day?.dayOff && striped
          )}
          aria-label={formatDayISO(date, { weekday: "long", month: "long", day: "numeric" })}
        >
          <b className={cn("text-label-sm", today ? "text-primary" : "text-dark")}>
            {formatDayISO(date, { day: "numeric" })}
          </b>
          {day?.dayOff ? (
            <em className="text-label-xsm not-italic text-info-800">
              <span className="md:hidden">Off</span>
              <span className="hidden md:inline">Day off</span>
            </em>
          ) : (
            <>
              <span className="flex flex-wrap gap-[3px]" aria-hidden="true">
                {sessions.slice(0, 4).map((item) => (
                  <i
                    key={item.key}
                    className={cn(
                      "size-[6px] rounded-full",
                      item.kind === "group" ? "bg-secondary-600" : item.kind === "request" ? "bg-info-600" : "bg-primary"
                    )}
                  />
                ))}
              </span>
              {sessions.length ? (
                <small className="hidden w-full truncate text-caption text-dark-300 md:block">{plural(sessions.length, "session")}</small>
              ) : null}
              {open ? <small className="hidden w-full truncate text-caption text-primary md:block">{open} open</small> : null}
            </>
          )}
        </button>
      );
    })}
  </div>
);
