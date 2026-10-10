/**
 * My Schedule views (ATH-71, Working Copy): Day (day strip + list), Week (seven columns on web,
 * a list by day on phone) and Month (grid). Open slots are dashed blue, busy times striped,
 * groups teal, requests orange.
 */
import { ChevronRight, Plus } from "lucide-react";
import { BrandPill } from "@/components/brand";
import { cn } from "@/lib/utils";
import type { ScheduleSession } from "@/api/schedule";
import {
  bookedAthletes,
  formatClock,
  formatDayISO,
  requestsFor,
  plural,
  type ScheduleDay,
  type ScheduleItem,
} from "@/utils/schedule";
import { formatInstantSpan } from "@/utils/viewerTime";
import { dangerTextButton, dayTile, dayTileNumber, dayTileWeekday, primaryButton, secondaryButton, smallButton, textButton } from "./styles";
import { FillBar, PayPill } from "./views/parts";
import {
  chipBox,
  chipName,
  chipSub,
  chipTime,
  clearDayText,
  initials,
  rowBox,
  rowGrid,
  rowLink,
  rowName,
  rowSub,
  rowTime,
  striped,
} from "./views/styles";

export interface ScheduleViewHandlers {
  onOpenSession: (session: ScheduleSession) => void;
  onRespond: (bookingId: string, accept: boolean) => void;
  respondingId: string | null;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

const expiresIn = (expiresAt: string | null, now: Date) => {
  if (!expiresAt) return null;
  const minutes = Math.round((Date.parse(expiresAt) - now.getTime()) / 60000);
  if (minutes <= 0) return "Expiring";
  if (minutes < 60) return `Expires in ${minutes} min`;
  return `Expires in ${Math.floor(minutes / 60)}h`;
};

const placeText = (session: ScheduleSession) =>
  session.location === "online" ? "Video call" : session.place || "In person";

const acceptButton = cn(primaryButton, smallButton, "flex-none");

/** One row in the Day view and the phone Week list (Working Copy `.sch-it`). */
export const ItemRow = ({
  item,
  timeZone,
  now,
  handlers,
}: {
  item: ScheduleItem;
  timeZone: string;
  now: Date;
  handlers: ScheduleViewHandlers;
}) => {
  const time = <span className={rowTime}>{formatClock(item.start, timeZone)}</span>;
  const kind = item.kind;
  const text = (name: string, sub: string) => (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <b className={rowName(kind)}>{name}</b>
      <small className={rowSub(kind)}>{sub}</small>
    </span>
  );

  if (kind === "busy") {
    return (
      <div className={rowGrid}>
        {time}
        <div className={rowBox(kind)}>{text("Busy", `From Google Calendar · ${formatInstantSpan(item.start, item.end, timeZone)}`)}</div>
      </div>
    );
  }

  const session = item.session!;
  const open = () => handlers.onOpenSession(session);

  if (kind === "open") {
    return (
      <div className={rowGrid}>
        {time}
        <button type="button" className={cn(rowBox(kind), "hover:bg-[#F4F8FC]")} onClick={open}>
          {text(
            "Open slot",
            session.visibility === "clients"
              ? "Your families can book this"
              : `Families can book this${session.offeredNames.length ? ` · offered to ${session.offeredNames.join(", ")}` : ""}`
          )}
          <Plus strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (kind === "offered") {
    return (
      <div className={rowGrid}>
        {time}
        <button type="button" className={cn(rowBox(kind), "hover:bg-[#F4F8FC]")} onClick={open}>
          {text(
            "Offered · 1-on-1",
            `${session.offeredNames.length ? `Sent to ${session.offeredNames.join(", ")}` : "Shared by link"} · waiting for someone to book`
          )}
          <span className={rowLink}>
            Share
            <ChevronRight strokeWidth={1.5} aria-hidden="true" />
          </span>
        </button>
      </div>
    );
  }

  if (kind === "request") {
    const request = requestsFor(session)[0];
    return (
      <div className={rowGrid}>
        {time}
        <div className={rowBox(kind)}>
          <button type="button" className="flex min-w-0 flex-1 flex-col gap-0.5 text-left" onClick={open}>
            <b className={rowName(kind)}>{request.athleteName} · request</b>
            <small className={rowSub(kind)}>
              {[expiresIn(request.expiresAt, now), "1-on-1", money(session.price)].filter(Boolean).join(" · ")}
            </small>
          </button>
          <button
            type="button"
            className={acceptButton}
            disabled={handlers.respondingId !== null}
            onClick={() => handlers.onRespond(request.id, true)}
          >
            Accept
          </button>
        </div>
      </div>
    );
  }

  if (kind === "group") {
    const booked = bookedAthletes(session);
    const requests = requestsFor(session);
    const left = session.capacity - booked.length;
    return (
      <>
        <div className={rowGrid}>
          {time}
          <button
            type="button"
            className={cn(rowBox(kind, session.isDraft), "flex-col items-stretch gap-1.5 hover:brightness-[0.98]")}
            onClick={open}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <b className={rowName(kind)}>{session.sessionName}</b>
                <small className={rowSub(kind)}>
                  {formatInstantSpan(item.start, item.end, timeZone)} · {placeText(session)}
                </small>
              </span>
              {session.isDraft ? (
                <BrandPill tone="amber">Draft</BrandPill>
              ) : (
                <span className="text-[13px] font-semibold text-[#117A96]">
                  {booked.length}/{session.capacity}
                </span>
              )}
            </span>
            <FillBar booked={booked.length} capacity={session.capacity} />
            <span className="flex items-center justify-between gap-3">
              {booked.length ? (
                <span className="flex flex-none" aria-hidden="true">
                  {booked.slice(0, 6).map((b) => (
                    <i
                      key={b.id}
                      className="-mr-[5px] flex size-[22px] items-center justify-center rounded-full border border-[#A9D4E0] bg-white text-[9px] font-semibold not-italic text-[#117A96]"
                    >
                      {initials(b.athleteName)}
                    </i>
                  ))}
                </span>
              ) : null}
              <small className={cn(rowSub(kind), "grow", booked.length && "ml-3")}>
                {left > 0 ? `${plural(left, "spot")} open` : "Full"}
                {requests.length ? ` · ${plural(requests.length, "request")}` : ""}
              </small>
              <span className={rowLink}>
                Athletes
                <ChevronRight strokeWidth={1.5} aria-hidden="true" />
              </span>
            </span>
          </button>
        </div>
        {requests.map((request) => (
          <div key={request.id} className={cn(rowGrid, "-mt-1")}>
            <span />
            <div className={cn(rowBox("request"), "ml-[14px] w-[calc(100%-14px)]")}>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <b className={rowName("request")}>{request.athleteName} wants to join</b>
                <small className={rowSub("request")}>
                  {[expiresIn(request.expiresAt, now), money(session.price)].filter(Boolean).join(" · ")}
                </small>
              </span>
              <button
                type="button"
                className={acceptButton}
                disabled={handlers.respondingId !== null}
                onClick={() => handlers.onRespond(request.id, true)}
              >
                Accept
              </button>
            </div>
          </div>
        ))}
      </>
    );
  }

  const athlete = bookedAthletes(session)[0];
  return (
    <div className={rowGrid}>
      {time}
      <button type="button" className={cn(rowBox(kind), "hover:bg-[#F4F4EB]")} onClick={open}>
        {text(
          athlete?.athleteName ?? "Athlete",
          `1-on-1${session.pillar ? ` ${session.pillar.toLowerCase()}` : ""} · ${session.durationMinutes} min`
        )}
        <PayPill booking={athlete} />
      </button>
    </div>
  );
};

/** Small chip in the web Week columns (Working Copy `.sch-chip`). */
const Chip = ({ item, timeZone, handlers }: { item: ScheduleItem; timeZone: string; handlers: ScheduleViewHandlers }) => {
  const session = item.session;
  const kind = item.kind;
  const label =
    kind === "busy"
      ? "Busy"
      : kind === "open"
        ? "Open"
        : kind === "offered"
          ? "Offered"
          : kind === "group"
            ? session!.sessionName
            : kind === "request"
              ? requestsFor(session!)[0]?.athleteName
              : bookedAthletes(session!)[0]?.athleteName ?? "Athlete";
  const requests = session ? requestsFor(session).length : 0;
  const sub =
    kind === "group"
      ? `${bookedAthletes(session!).length} of ${session!.capacity}${requests ? ` · ${plural(requests, "request")}` : ""}`
      : kind === "request"
        ? "Request"
        : kind === "booked" || kind === "offered"
          ? "1-on-1"
          : null;
  const className = chipBox(kind, session?.isDraft);
  const content = (
    <>
      <small className={chipTime}>{formatClock(item.start, timeZone)}</small>
      <b className={chipName(kind)}>{label}</b>
      {sub ? <small className={chipSub(kind)}>{sub}</small> : null}
    </>
  );
  if (!session) return <div className={className}>{content}</div>;
  return (
    <button type="button" className={className} onClick={() => handlers.onOpenSession(session)}>
      {content}
    </button>
  );
};

export const WeekColumns = ({
  days,
  todayISO,
  timeZone,
  handlers,
  onOpenDay,
}: {
  days: ScheduleDay[];
  todayISO: string;
  timeZone: string;
  handlers: ScheduleViewHandlers;
  onOpenDay: (date: string) => void;
}) => (
  <div className="grid grid-cols-7 gap-2">
    {days.map((day) => (
      <div key={day.date} className={cn("flex min-w-0 flex-col gap-1.5", day.date < todayISO && "opacity-60")}>
        {/* "Mon 28" on one line over a 1px line; today's number in blue. */}
        <button
          type="button"
          onClick={() => onOpenDay(day.date)}
          className="flex w-full items-baseline gap-1.5 border-b border-[#EAEADF] pb-1.5 text-left"
          aria-label={`Open ${formatDayISO(day.date, { weekday: "long", month: "long", day: "numeric" })}`}
        >
          <small className="text-[12px] leading-[14px] text-[#767980]">{formatDayISO(day.date, { weekday: "short" })}</small>
          <b className={cn("text-[17px] font-semibold leading-[20px]", day.date === todayISO ? "text-[#0054B4]" : "text-[#1A202C]")}>
            {formatDayISO(day.date, { day: "numeric" })}
          </b>
        </button>
        {day.dayOff ? <span className="py-1.5 text-[12px] font-medium text-[#906A29]">Day off</span> : null}
        {day.items.map((item) => (
          <Chip key={item.key} item={item} timeZone={timeZone} handlers={handlers} />
        ))}
        {!day.items.length && !day.dayOff ? <span className="py-1.5 text-[12px] text-[#A3A6AB]">Nothing yet</span> : null}
      </div>
    ))}
  </div>
);

export const WeekAgenda = ({
  days,
  timeZone,
  now,
  handlers,
  onOpenDay,
}: {
  days: ScheduleDay[];
  timeZone: string;
  now: Date;
  handlers: ScheduleViewHandlers;
  onOpenDay: (date: string) => void;
}) => (
  <div className="flex flex-col gap-7">
    {days.map((day) => (
      <div key={day.date} className="flex flex-col gap-2">
        <button
          type="button"
          className="flex items-center gap-2 border-b border-[#EAEADF] py-1 text-left"
          onClick={() => onOpenDay(day.date)}
        >
          <b className="text-[15px] font-semibold leading-[18px] text-[#1A202C]">
            {formatDayISO(day.date, { weekday: "long", month: "short", day: "numeric" })}
          </b>
          {day.dayOff ? <BrandPill tone="amber">Day off</BrandPill> : null}
        </button>
        {day.items.length ? (
          <div className="flex flex-col gap-2">
            {day.items.map((item) => (
              <ItemRow key={item.key} item={item} timeZone={timeZone} now={now} handlers={handlers} />
            ))}
          </div>
        ) : (
          <span className="text-[12px] leading-[14px] text-[#767980]">{day.dayOff ? "Day off" : "Nothing yet"}</span>
        )}
      </div>
    ))}
  </div>
);

const dayDots = (day: ScheduleDay, on = false) => {
  const kinds = new Set(day.items.map((i) => i.kind));
  return (
    <span className="flex h-[5px] items-center gap-[3px]" aria-hidden="true">
      {kinds.has("group") ? <i className={cn("size-[5px] rounded-full", on ? "bg-[#9FD9EA]" : "bg-[#117A96]")} /> : null}
      {kinds.has("booked") ? <i className={cn("size-[5px] rounded-full", on ? "bg-white" : "bg-[#0054B4]")} /> : null}
      {kinds.has("open") || kinds.has("offered") ? <i className={cn("size-[5px] rounded-full border border-dashed", on ? "border-white" : "border-[#0054B4]")} /> : null}
    </span>
  );
};

export const DayView = ({
  days,
  selected,
  todayISO,
  timeZone,
  now,
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
  now: Date;
  handlers: ScheduleViewHandlers;
  onSelect: (date: string) => void;
  onAdd: (date: string) => void;
  onClearDay: (date: string) => void;
  onRestoreDay: (date: string) => void;
}) => {
  const day = days.find((d) => d.date === selected) ?? days[0];
  const requestCount = (d: ScheduleDay) =>
    d.items.reduce((n, item) => n + (item.session ? requestsFor(item.session).length : 0), 0);
  return (
    <div className="flex flex-col gap-[14px]">
      <div className="grid grid-cols-7 gap-1.5 md:gap-2" role="group" aria-label="Days">
        {days.map((d) => {
          const requests = requestCount(d);
          const on = d.date === day.date;
          return (
            <button
              key={d.date}
              type="button"
              aria-pressed={on}
              aria-label={formatDayISO(d.date, { weekday: "long", month: "long", day: "numeric" })}
              onClick={() => onSelect(d.date)}
              className={cn(dayTile(on), "min-h-[78px]", !on && "bg-[#F7F7F0]")}
            >
              <small className={dayTileWeekday(on)}>{formatDayISO(d.date, { weekday: "short" })}</small>
              <b className={dayTileNumber}>{formatDayISO(d.date, { day: "numeric" })}</b>
              {requests ? (
                <em className={cn("min-w-4 rounded-[8px] px-1 text-center text-[10px] font-bold not-italic leading-[14px]", on ? "bg-white text-[#C26E12]" : "bg-[#C26E12] text-white")}>
                  {requests}
                </em>
              ) : (
                dayDots(d, on)
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[16px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">
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
              <button type="button" className={cn(dangerTextButton, clearDayText, "px-2")} onClick={() => onClearDay(day.date)}>
                Clear day
              </button>
            )}
          </span>
        ) : null}
      </div>

      {day.dayOff && !day.items.length ? (
        <div className="rounded-[8px] border border-dashed border-[#C1C1B8] p-[18px] text-center text-[13px] text-[#767980]">
          Day off{day.dayOff.note ? ` · ${day.dayOff.note}` : ""}.
        </div>
      ) : day.items.length ? (
        <div className="flex flex-col gap-2">
          {day.items.map((item) => (
            <ItemRow key={item.key} item={item} timeZone={timeZone} now={now} handlers={handlers} />
          ))}
        </div>
      ) : (
        <p className="text-[14px] leading-[18px] text-[#767980]">
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
      <span key={w} className="text-center text-[11px] text-[#767980] md:px-1.5 md:text-left md:text-[12px]">
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
            "flex min-h-[50px] min-w-0 flex-col items-center gap-[3px] rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-1 py-[5px] text-left transition-colors hover:border-[#0054B4] md:min-h-[88px] md:items-start md:gap-1 md:p-2",
            today && "border-[#0054B4] shadow-[inset_0_0_0_1px_#0054B4]",
            date < todayISO && "opacity-55",
            day?.dayOff && striped
          )}
          aria-label={formatDayISO(date, { weekday: "long", month: "long", day: "numeric" })}
        >
          <b className={cn("text-[14px] font-semibold leading-[17px]", today ? "text-[#0054B4]" : "text-[#1A202C]")}>
            {formatDayISO(date, { day: "numeric" })}
          </b>
          {day?.dayOff ? (
            <em className="text-[10px] font-semibold not-italic text-[#906A29] md:text-[11px]">
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
                      item.kind === "group" ? "bg-[#117A96]" : item.kind === "request" ? "bg-[#C26E12]" : "bg-[#0054B4]"
                    )}
                  />
                ))}
              </span>
              {sessions.length ? (
                <small className="hidden w-full truncate text-[11px] leading-[13px] text-[#767980] md:block">{plural(sessions.length, "session")}</small>
              ) : null}
              {open ? <small className="hidden w-full truncate text-[11px] leading-[13px] text-[#0054B4] md:block">{open} open</small> : null}
            </>
          )}
        </button>
      );
    })}
  </div>
);
