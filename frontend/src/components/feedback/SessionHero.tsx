import { Clock, MapPin } from "lucide-react";
import type { FeedbackScreen } from "@/api/feedback";
import { BrandPill } from "@/components/brand";
import { cn } from "@/lib/utils";
import { formatDayISO, sessionEnd, sessionStart } from "@/utils/schedule";
import { getZonedISODate } from "@/utils/dateHelpers";
import { caption, families, firstName, initials, timeRange } from "./helpers";
import { FeedbackAvatar } from "./parts";

/** Session card at the top of the check-in (Working Copy `.fbh`). */
export const SessionHero = ({ screen, timeZone }: { screen: FeedbackScreen; timeZone: string }) => {
  const group = screen.sessionType === "group";
  const start = sessionStart(screen);
  const day = getZonedISODate(start, timeZone);
  const athletes = screen.athletes;
  const a0 = athletes[0];
  const where = screen.location === "online" ? "Video call" : screen.place || "In person";
  const adult = a0?.age != null && a0.age >= 18;

  return (
    <section aria-label="Session" className="flex flex-col gap-3.5 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[18px] pb-4 pt-[18px]">
      <div className="flex flex-wrap gap-1.5">
        {group ? <BrandPill tone="teal">Group</BrandPill> : <BrandPill tone="blue">Individual</BrandPill>}
        {screen.pillar ? <BrandPill tone="neutral">{screen.pillar}</BrandPill> : null}
        {screen.submitted ? <BrandPill tone="green">Feedback sent</BrandPill> : <BrandPill tone="amber">Feedback due</BrandPill>}
      </div>
      <div className="flex items-center gap-3.5">
        <span className="flex h-[68px] w-[64px] flex-none flex-col items-center justify-center gap-1 rounded-[8px] border border-[#EAEADF] bg-[#F1F1E6]">
          <small className="text-[12px] font-semibold tracking-[0.02em] text-[#0054B4]">{formatDayISO(day, { weekday: "short" }).toUpperCase()}</small>
          <b className="text-[28px] font-bold leading-[28px] tracking-[-0.05em] text-[#1A202C]">{Number(day.slice(8, 10))}</b>
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[20px] font-semibold leading-[22px] tracking-[-0.05em] text-[#1A202C]">
            {group ? screen.sessionName : a0 ? `1-on-1 with ${firstName(a0.name)}` : screen.sessionName}
          </span>
          <span className={cn(caption, "flex items-center gap-1.5")}>
            <Clock className="size-3.5 flex-none" strokeWidth={1.5} aria-hidden="true" />
            {formatDayISO(day, { weekday: "short", month: "short", day: "numeric" })} · {timeRange(start, sessionEnd(screen), timeZone)}
          </span>
          <span className={cn(caption, "flex items-center gap-1.5")}>
            <MapPin className="size-3.5 flex-none" strokeWidth={1.5} aria-hidden="true" />
            <span className="truncate">{where}</span>
          </span>
        </div>
      </div>
      {group ? (
        <div className="flex items-center gap-2.5 border-t border-[#EAEADF] pt-3.5">
          <span className="flex">
            {athletes.slice(0, 4).map((a, i) => (
              <span
                key={a.bookingId}
                className={cn(
                  "flex size-[28px] items-center justify-center overflow-hidden rounded-full border-2 border-[#F7F7F0] bg-[#E5EDF7] text-[10px] font-semibold text-[#0054B4]",
                  i > 0 && "-ml-1.5"
                )}
                aria-hidden="true"
              >
                {a.imageUrl ? <img src={a.imageUrl} alt="" className="size-full object-cover" /> : initials(a.name)}
              </span>
            ))}
            {athletes.length > 4 ? (
              <span className="-ml-1.5 flex size-[28px] items-center justify-center rounded-full border-2 border-[#F7F7F0] bg-[#F4F4EB] text-[10px] font-semibold text-[#484D56]" aria-hidden="true">
                +{athletes.length - 4}
              </span>
            ) : null}
          </span>
          <span className={caption}>
            {athletes.length} {athletes.length === 1 ? "athlete" : "athletes"} · {families(athletes.length)}
          </span>
        </div>
      ) : a0 ? (
        <div className="flex items-center gap-2.5 border-t border-[#EAEADF] pt-3.5">
          <FeedbackAvatar name={a0.name} imageUrl={a0.imageUrl} size={32} />
          <span className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-[14px] font-medium text-[#1A202C]">{a0.name}</span>
            <span className={caption}>{[a0.age, a0.position, adult ? "Athlete, 18+" : null].filter((x) => x != null && x !== "").join(" · ")}</span>
          </span>
        </div>
      ) : null}
    </section>
  );
};
