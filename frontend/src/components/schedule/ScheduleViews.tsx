/**
 * My Schedule views (ATH-71): Day (day strip + list), Week (seven columns on web, a list by
 * day on phone) and Month (grid). Open slots are dashed, groups teal, requests amber.
 */
import { CalendarOff, ChevronRight, Plus } from "lucide-react";
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
import { ITEM_TONE, dangerTextButton, meta, secondaryButton, textButton } from "./styles";

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

const payPill = (session: ScheduleSession) => {
  const booking = bookedAthletes(session)[0];
  if (!booking) return null;
  if (booking.paymentStatus === "paid") return <BrandPill tone="green">Paid</BrandPill>;
  return <BrandPill tone="amber">Awaiting payment</BrandPill>;
};

const FillBar = ({ booked, capacity }: { booked: number; capacity: number }) => (
  <span className="block h-[4px] w-full overflow-hidden rounded-full bg-[#D9D9CF]" aria-hidden="true">
    <i className="block h-full rounded-full bg-[#117A96]" style={{ width: `${Math.min(100, (booked / Math.max(1, capacity)) * 100)}%` }} />
  </span>
);

const placeText = (session: ScheduleSession) =>
  session.location === "online" ? "Video call" : session.place || "In person";

/** One row in the Day view and the phone Week list. */
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
  const time = (
    <span className="w-[64px] flex-none pt-[11px] text-[12px] font-medium leading-[14px] text-[#767980]">
      {formatClock(item.start, timeZone)}
    </span>
  );
  const box = cn(
    "flex min-w-0 flex-1 items-center gap-3 rounded-[8px] border border-[#EAEADF] border-l-[3px] px-3 py-[9px] text-left",
    ITEM_TONE[item.kind]
  );
  const title = "text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]";

  if (item.kind === "busy") {
    return (
      <div className="flex gap-2">
        {time}
        <div className={box}>
          <span className="flex min-w-0 flex-col gap-0.5">
            <b className={title}>Busy</b>
            <span className={meta}>From Google Calendar · {formatInstantSpan(item.start, item.end, timeZone)}</span>
          </span>
        </div>
      </div>
    );
  }

  const session = item.session!;
  const open = () => handlers.onOpenSession(session);

  if (item.kind === "open" || item.kind === "offered") {
    return (
      <div className="flex gap-2">
        {time}
        <button type="button" className={cn(box, "hover:bg-[#F4F4EB]")} onClick={open}>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <b className={title}>{item.kind === "open" ? "Open slot" : "Offered · 1-on-1"}</b>
            <span className={meta}>
              {item.kind === "open"
                ? session.visibility === "clients"
                  ? "Your families can book this"
                  : `Families can book this${session.offeredNames.length ? ` · offered to ${session.offeredNames.join(", ")}` : ""}`
                : `${session.offeredNames.length ? `Sent to ${session.offeredNames.join(", ")}` : "Shared by link"} · waiting for someone to book`}
            </span>
          </span>
          {item.kind === "open" ? (
            <Plus className="size-4 flex-none text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <span className={cn(textButton, "flex-none")}>
              Share
              <ChevronRight strokeWidth={1.5} aria-hidden="true" />
            </span>
          )}
        </button>
      </div>
    );
  }

  if (item.kind === "request") {
    const request = requestsFor(session)[0];
    return (
      <div className="flex gap-2">
        {time}
        <div className={box}>
          <button type="button" className="flex min-w-0 flex-1 flex-col gap-0.5 text-left" onClick={open}>
            <b className={title}>{request.athleteName} · request</b>
            <span className={meta}>
              {[expiresIn(request.expiresAt, now), "1-on-1", money(session.price)].filter(Boolean).join(" · ")}
            </span>
          </button>
          <span className="flex flex-none gap-1.5">
            <button
              type="button"
              className={cn(secondaryButton, "h-[30px] px-3")}
              disabled={handlers.respondingId !== null}
              onClick={() => handlers.onRespond(request.id, false)}
            >
              Decline
            </button>
            <button
              type="button"
              className="inline-flex h-[30px] items-center rounded-[8px] border border-[#6698D2] bg-[#0054B4] px-3 text-[14px] font-medium text-[#F1F1E6] hover:bg-[#004390] disabled:opacity-50"
              disabled={handlers.respondingId !== null}
              onClick={() => handlers.onRespond(request.id, true)}
            >
              Accept
            </button>
          </span>
        </div>
      </div>
    );
  }

  if (item.kind === "group") {
    const booked = bookedAthletes(session);
    const requests = requestsFor(session);
    const left = session.capacity - booked.length;
    return (
      <>
        <div className="flex gap-2">
          {time}
          <button type="button" className={cn(box, "flex-col items-stretch gap-2 hover:bg-[#DDEEF3]")} onClick={open}>
            <span className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 flex-col gap-0.5">
                <b className={title}>{session.sessionName}</b>
                <span className={meta}>
                  {formatInstantSpan(item.start, item.end, timeZone)} · {placeText(session)}
                </span>
              </span>
              {session.isDraft ? (
                <BrandPill tone="amber">Draft</BrandPill>
              ) : (
                <span className="text-[14px] font-medium text-[#117A96]">
                  {booked.length}/{session.capacity}
                </span>
              )}
            </span>
            <FillBar booked={booked.length} capacity={session.capacity} />
            <span className="flex items-center justify-between gap-3">
              <span className={meta}>
                {left > 0 ? `${plural(left, "spot")} open` : "Full"}
                {requests.length ? ` · ${plural(requests.length, "request")}` : ""}
              </span>
              <span className={textButton}>
                Athletes
                <ChevronRight strokeWidth={1.5} aria-hidden="true" />
              </span>
            </span>
          </button>
        </div>
        {requests.map((request) => (
          <div key={request.id} className="flex gap-2">
            <span className="w-[64px] flex-none" />
            <div className={cn(box, ITEM_TONE.request)}>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <b className={title}>{request.athleteName} wants to join</b>
                <span className={meta}>
                  {[expiresIn(request.expiresAt, now), money(session.price)].filter(Boolean).join(" · ")}
                </span>
              </span>
              <button
                type="button"
                className={cn(secondaryButton, "h-[30px] px-3")}
                disabled={handlers.respondingId !== null}
                onClick={() => handlers.onRespond(request.id, false)}
              >
                Decline
              </button>
              <button
                type="button"
                className="inline-flex h-[30px] items-center rounded-[8px] border border-[#6698D2] bg-[#0054B4] px-3 text-[14px] font-medium text-[#F1F1E6] hover:bg-[#004390] disabled:opacity-50"
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
    <div className="flex gap-2">
      {time}
      <button type="button" className={cn(box, "hover:bg-[#D9E5F3]")} onClick={open}>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <b className={title}>{athlete?.athleteName ?? "Athlete"}</b>
          <span className={meta}>
            1-on-1{session.pillar ? ` ${session.pillar.toLowerCase()}` : ""} · {session.durationMinutes} min
          </span>
        </span>
        {payPill(session)}
      </button>
    </div>
  );
};

/** Small chip in the web Week columns. */
const Chip = ({ item, timeZone, handlers }: { item: ScheduleItem; timeZone: string; handlers: ScheduleViewHandlers }) => {
  const session = item.session;
  const label =
    item.kind === "busy"
      ? "Busy"
      : item.kind === "open"
        ? "Open"
        : item.kind === "offered"
          ? "Offered"
          : item.kind === "group"
            ? session!.sessionName
            : item.kind === "request"
              ? requestsFor(session!)[0]?.athleteName
              : bookedAthletes(session!)[0]?.athleteName ?? "Athlete";
  const sub =
    item.kind === "group"
      ? `${bookedAthletes(session!).length} of ${session!.capacity}${requestsFor(session!).length ? ` · ${plural(requestsFor(session!).length, "request")}` : ""}`
      : item.kind === "request"
        ? "Request"
        : item.kind === "booked" || item.kind === "offered"
          ? "1-on-1"
          : null;
  const className = cn(
    "flex w-full flex-col gap-0.5 rounded-[6px] border border-[#EAEADF] border-l-[3px] px-2 py-1.5 text-left",
    ITEM_TONE[item.kind],
    item.kind !== "busy" && "hover:brightness-[0.98]"
  );
  const content = (
    <>
      <small className="text-[11px] leading-[13px] text-[#767980]">{formatClock(item.start, timeZone)}</small>
      <b className="truncate text-[12px] font-medium leading-[15px] text-[#1A202C]">{label}</b>
      {sub ? <small className="truncate text-[11px] leading-[13px] text-[#767980]">{sub}</small> : null}
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
      <div
        key={day.date}
        className={cn(
          "flex min-h-[220px] min-w-0 flex-col gap-1.5 rounded-[8px] p-1.5",
          day.date === todayISO ? "bg-[#E5EDF7]/50" : "",
          day.date < todayISO ? "opacity-60" : ""
        )}
      >
        <button
          type="button"
          onClick={() => onOpenDay(day.date)}
          className="flex flex-col items-center gap-0.5 rounded-[6px] py-1 hover:bg-[#F1F1E6]"
          aria-label={`Open ${formatDayISO(day.date, { weekday: "long", month: "long", day: "numeric" })}`}
        >
          <small className="text-[11px] font-medium uppercase leading-[13px] text-[#767980]">
            {formatDayISO(day.date, { weekday: "short" })}
          </small>
          <b className={cn("text-[18px] font-semibold leading-[20px]", day.date === todayISO ? "text-[#0054B4]" : "text-[#1A202C]")}>
            {formatDayISO(day.date, { day: "numeric" })}
          </b>
        </button>
        {day.dayOff ? <BrandPill tone="amber" className="justify-center">Day off</BrandPill> : null}
        {day.items.map((item) => (
          <Chip key={item.key} item={item} timeZone={timeZone} handlers={handlers} />
        ))}
        {!day.items.length && !day.dayOff ? <span className="px-1 text-[11px] text-[#A3A6AB]">Nothing yet</span> : null}
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
  <div className="flex flex-col gap-5">
    {days.map((day) => (
      <div key={day.date} className="flex flex-col gap-2">
        <button type="button" className="flex items-center gap-2 text-left" onClick={() => onOpenDay(day.date)}>
          <b className="text-[14px] font-medium text-[#1A202C]">
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
          <span className={meta}>{day.dayOff ? "Day off" : "Nothing yet"}</span>
        )}
      </div>
    ))}
  </div>
);

const dayDots = (day: ScheduleDay) => {
  const kinds = new Set(day.items.map((i) => i.kind));
  return (
    <span className="flex h-[6px] items-center gap-[3px]" aria-hidden="true">
      {kinds.has("group") ? <i className="size-[5px] rounded-full bg-[#117A96]" /> : null}
      {kinds.has("booked") ? <i className="size-[5px] rounded-full bg-[#0054B4]" /> : null}
      {kinds.has("open") || kinds.has("offered") ? <i className="size-[5px] rounded-full border border-[#A3A6AB]" /> : null}
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
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Days">
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
              className={cn(
                "flex flex-col items-center gap-1 rounded-[8px] border py-2 transition-colors",
                on ? "border-[#6698D2] bg-[#E5EDF7]" : "border-[#EAEADF] bg-[#F4F4EB] hover:bg-[#EAEADF]",
                d.date < todayISO && !on ? "opacity-60" : ""
              )}
            >
              <small className="text-[11px] font-medium uppercase leading-[13px] text-[#767980]">
                {formatDayISO(d.date, { weekday: "short" })}
              </small>
              <b className={cn("text-[16px] font-semibold leading-[18px]", on ? "text-[#0054B4]" : "text-[#1A202C]")}>
                {formatDayISO(d.date, { day: "numeric" })}
              </b>
              {requests ? (
                <em className="rounded-full bg-[#F0B144] px-1.5 text-[10px] font-semibold not-italic leading-[14px] text-[#1A202C]">
                  {requests}
                </em>
              ) : (
                dayDots(d)
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[18px] font-medium leading-[22px] tracking-[-0.04em] text-[#1A202C]">
          {formatDayISO(day.date, { weekday: "long", month: "long", day: "numeric" })}
        </h3>
        {day.date >= todayISO ? (
          <span className="flex items-center gap-3">
            <button type="button" className={cn(secondaryButton, "h-[30px] px-3")} onClick={() => onAdd(day.date)}>
              <Plus strokeWidth={1.5} aria-hidden="true" />
              Add
            </button>
            {day.dayOff ? (
              <button type="button" className={textButton} onClick={() => onRestoreDay(day.date)}>
                Undo day off
              </button>
            ) : (
              <button type="button" className={dangerTextButton} onClick={() => onClearDay(day.date)}>
                Clear day
              </button>
            )}
          </span>
        ) : null}
      </div>

      {day.dayOff && !day.items.length ? (
        <div className="flex items-center gap-2 rounded-[8px] border border-dashed border-[#C1C1B8] px-4 py-5 text-[14px] text-[#767980]">
          <CalendarOff className="size-4" strokeWidth={1.5} aria-hidden="true" />
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
  <div className="grid grid-cols-7 gap-1">
    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
      <span key={w} className="pb-1 text-center text-[11px] font-medium uppercase text-[#767980]">
        {w}
      </span>
    ))}
    {cells.map((date, i) => {
      if (!date) return <span key={`blank-${i}`} />;
      const day = daysByDate.get(date);
      const sessions = (day?.items ?? []).filter((item) => item.kind !== "open" && item.kind !== "busy");
      const open = (day?.items ?? []).filter((item) => item.kind === "open").length;
      return (
        <button
          key={date}
          type="button"
          onClick={() => onOpenDay(date)}
          className={cn(
            "flex min-h-[72px] flex-col items-start gap-1 rounded-[6px] border p-1.5 text-left transition-colors hover:bg-[#F1F1E6]",
            date === todayISO ? "border-[#6698D2] bg-[#E5EDF7]/60" : "border-[#EAEADF] bg-[#F9F9F5]",
            date < todayISO ? "opacity-60" : ""
          )}
          aria-label={formatDayISO(date, { weekday: "long", month: "long", day: "numeric" })}
        >
          <b className="text-[13px] font-semibold leading-[15px] text-[#1A202C]">{formatDayISO(date, { day: "numeric" })}</b>
          {day?.dayOff ? (
            <em className="text-[11px] not-italic leading-[13px] text-[#906A29]">Day off</em>
          ) : (
            <>
              <span className="flex gap-[3px]" aria-hidden="true">
                {sessions.slice(0, 4).map((item) => (
                  <i
                    key={item.key}
                    className={cn(
                      "size-[6px] rounded-full",
                      item.kind === "group" ? "bg-[#117A96]" : item.kind === "request" ? "bg-[#F0B144]" : "bg-[#0054B4]"
                    )}
                  />
                ))}
              </span>
              {sessions.length ? (
                <small className="hidden text-[11px] leading-[13px] text-[#484D56] sm:block">{plural(sessions.length, "session")}</small>
              ) : null}
              {open ? <small className="hidden text-[11px] leading-[13px] text-[#767980] sm:block">{open} open</small> : null}
            </>
          )}
        </button>
      );
    })}
  </div>
);
