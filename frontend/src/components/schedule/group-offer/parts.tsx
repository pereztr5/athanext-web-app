/**
 * Shared pieces for the chat week post card (Working Copy 4 `.pp-*`).
 */
import { BrandPill } from "@/components/brand";
import type { GroupOfferSession } from "@/api/schedule";
import { cn } from "@/lib/utils";
import { formatDayISO } from "@/utils/schedule";

export const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
export const money2 = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** Three-line date tile: month, day number, weekday. */
export const DateTile = ({ day }: { day: string }) => (
  <span className="flex h-[54px] w-[44px] flex-none flex-col items-center justify-center gap-0.5 rounded-[8px] border border-[#EAEADF] bg-[#F7F7F0]">
    <small className="text-[10px] font-semibold uppercase leading-[11px] text-[#0054B4]">
      {formatDayISO(day, { month: "short" })}
    </small>
    <b className="text-[18px] font-bold leading-[18px] tracking-[-0.05em]">{formatDayISO(day, { day: "numeric" })}</b>
    <em className="text-[10px] font-medium not-italic leading-[11px] text-[#767980]">
      {formatDayISO(day, { weekday: "short" }).toUpperCase()}
    </em>
  </span>
);

export const FillMini = ({ booked, capacity }: { booked: number; capacity: number }) => (
  <span className="block h-[4px] w-16 overflow-hidden rounded-full bg-[#D9D9CF]" aria-hidden="true">
    <i className="block h-full rounded-full bg-[#117A96]" style={{ width: `${Math.min(100, (booked / Math.max(1, capacity)) * 100)}%` }} />
  </span>
);

export const sessionWhere = (s: Pick<GroupOfferSession, "location" | "place">) =>
  s.location === "online" ? "Video call" : s.place || "In person";

export const sessionPills = (s: GroupOfferSession, role: "coach" | "athlete") => {
  const out: { key: string; tone: "neutral" | "blue" | "amber" | "teal" | "green" | "red"; label: string }[] = [];
  if (s.cancelled) {
    out.push({ key: "cancel", tone: "neutral", label: "Cancelled" });
    return out;
  }
  if (s.isNew) out.push({ key: "new", tone: "blue", label: "New" });
  const from = s.changeFrom;
  if (from && (from.date !== s.date || from.startTime.slice(0, 5) !== s.startTime.slice(0, 5))) {
    out.push({ key: "moved", tone: "amber", label: from.date !== s.date ? "Day changed" : "Time changed" });
  } else if (from && (from.place !== s.place || from.location !== s.location)) {
    out.push({ key: "place", tone: "amber", label: "New place" });
  }
  if (role === "coach" && s.priceFrom != null && s.priceFrom !== s.price) {
    out.push({ key: "price", tone: "neutral", label: "New price" });
  }
  return out;
};

export const SessionPills = ({ session, role }: { session: GroupOfferSession; role: "coach" | "athlete" }) => (
  <>
    {sessionPills(session, role).map((p) => (
      <BrandPill key={p.key} tone={p.tone}>
        {p.label}
      </BrandPill>
    ))}
  </>
);

export const cardShell = "flex w-full max-w-[460px] flex-col overflow-hidden rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0]";
export const cardHead = "flex flex-col gap-1 border-b border-[#EAEADF] px-4 py-3.5";
export const cardFoot = "flex flex-col gap-2.5 border-t border-[#EAEADF] px-4 py-3.5";
export const rowClass = (opts?: { faded?: boolean; tap?: boolean }) =>
  cn(
    "flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left",
    opts?.faded && "opacity-60",
    opts?.tap && "cursor-pointer hover:bg-[#F1F1E6]"
  );
export const titleClass = "text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]";
export const tiny = "text-[12px] font-medium leading-[14px] tracking-[-0.03em]";
