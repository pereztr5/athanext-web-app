/** Shared bits for Book {athlete} (Working Copy coach4.js quick flow). */
import type { OpenTime } from "@/api/roster";
import { money } from "@/utils/booking";
import { getZonedISODate, zonedWallTimeToUtc } from "@/utils/dateHelpers";
import { formatClock, formatDayISO, plural } from "@/utils/schedule";

export type Payment = "credit" | "link" | "outside";

/** One time in the picker: an open 1-on-1, a group with space, or a taken time (shown disabled). */
export interface BookTime {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  price: number;
  place: string | null;
  kind: "open" | "group" | "taken";
  title: string | null;
  booked: number;
  cap: number;
  takenBy: string | null;
}

export const fromOpenTime = (t: OpenTime): BookTime => ({
  ...t,
  kind: "open",
  title: null,
  booked: 0,
  cap: 1,
  takenBy: null,
});

export const startsAt = (t: Pick<BookTime, "date" | "startTime">) => zonedWallTimeToUtc(t.date, t.startTime) ?? new Date(NaN);
export const viewerDay = (t: Pick<BookTime, "date" | "startTime">, timeZone: string) => getZonedISODate(startsAt(t), timeZone);
export const clock = (t: Pick<BookTime, "date" | "startTime">, timeZone: string) => formatClock(startsAt(t), timeZone);
export const shortDay = (iso: string) => formatDayISO(iso, { weekday: "short", month: "short", day: "numeric" });
export const byStart = (a: Pick<BookTime, "date" | "startTime">, b: Pick<BookTime, "date" | "startTime">) =>
  `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`);

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const lengthMinutes = (t: Pick<BookTime, "startTime" | "endTime">) => {
  const n = toMinutes(t.endTime) - toMinutes(t.startTime);
  return n > 0 ? n : 60;
};

/** "Mon, Sep 28 · 4:00 pm" */
export const whenLabel = (t: Pick<BookTime, "date" | "startTime">, timeZone: string, joiner = " · ") =>
  `${shortDay(viewerDay(t, timeZone))}${joiner}${clock(t, timeZone)}`;

export const placeLabel = (place: string | null) =>
  !place || place === "in-person" ? "In person" : place === "online" ? "Video call" : place;

export interface Suggestion {
  slot: OpenTime;
  why: "Usual time" | "Next open slot" | "Open";
}

/** At most 3: the usual time when it's open, then the next open slot on other days. */
export const suggestTimes = (times: OpenTime[], timeZone: string): Suggestion[] => {
  const out: Suggestion[] = [];
  const usual = times.find((t) => t.suggested);
  if (usual) out.push({ slot: usual, why: "Usual time" });
  const days = new Set(out.map((o) => viewerDay(o.slot, timeZone)));
  for (const t of [...times].sort(byStart)) {
    if (out.length >= 3) break;
    const day = viewerDay(t, timeZone);
    if (days.has(day)) continue;
    days.add(day);
    out.push({ slot: t, why: out.length ? "Open" : "Next open slot" });
  }
  return out;
};

export interface PayContext {
  credits: number;
  ownClient: boolean;
  paysDirect: boolean;
  payer: string;
}

/** The ways this booking can be paid, in the order Change cycles through them. */
export const paymentChoices = (ctx: PayContext, count: number): Payment[] => [
  ...(ctx.credits >= Math.max(1, count) ? (["credit"] as const) : []),
  "link",
  ...(ctx.ownClient && !ctx.paysDirect ? (["outside"] as const) : []),
];

export const paymentLabel = (pay: Payment, ctx: PayContext, count: number, total: number) =>
  pay === "credit"
    ? `Uses ${count} of ${plural(ctx.credits, "credit")}`
    : pay === "outside"
      ? "Paid outside AthaNext"
      : ctx.paysDirect
        ? `${ctx.payer} pays you directly · ${money(total)}`
        : `Payment link to ${ctx.payer} · ${money(total)}`;
