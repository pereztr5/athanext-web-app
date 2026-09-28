import { useMemo } from "react";
import { Link } from "react-router-dom";
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { Calendar } from "lucide-react";
import { useCoachAvailabilityWithOccurrences } from "@/hooks/useCoachAvailabilityWithOccurrences";
import { ROUTES } from "@/routes";
import { CoachProfileCard } from "./CoachProfileCard";

interface AvailabilitySummaryCardProps {
  coachId: string;
  sessionTypes?: string[];
}

function formatSessionTypes(sessionTypes?: string[]): string {
  if (!sessionTypes?.length) return "Not configured";
  const normalized = sessionTypes.map((t) => t.toLowerCase());
  const hasIndividual = normalized.some(
    (t) => t.includes("individual") || t.includes("1:1") || t.includes("one")
  );
  const hasGroup = normalized.some((t) => t.includes("group"));
  const hasVirtual = normalized.some((t) => t.includes("virtual") || t.includes("online"));
  const hasInPerson = normalized.some(
    (t) => t.includes("in-person") || t.includes("in person") || t.includes("field")
  );

  const kinds: string[] = [];
  if (hasIndividual) kinds.push("Individual");
  if (hasGroup) kinds.push("Group");
  if (!kinds.length) {
    kinds.push(...sessionTypes.slice(0, 2).map((t) => t.charAt(0).toUpperCase() + t.slice(1)));
  }

  const modes: string[] = [];
  if (hasVirtual) modes.push("Virtual");
  if (hasInPerson) modes.push("In person");

  if (modes.length) return `${kinds.join(", ")} - ${modes.join(" and ")}`;
  return kinds.join(", ");
}

export function AvailabilitySummaryCard({ coachId, sessionTypes }: AvailabilitySummaryCardProps) {
  const { data: windows, isLoading } = useCoachAvailabilityWithOccurrences(coachId);

  const summary = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const active =
      (windows || []).find((w) => {
        try {
          const start = parseISO(w.start_date);
          const end = parseISO(w.end_date);
          return isWithinInterval(now, { start, end }) || end >= now;
        } catch {
          return false;
        }
      }) || (windows || [])[0];

    if (!active) {
      return { periodLabel: "No availability window", openSlots: 0, booked: 0 };
    }

    const occurrences = active.occurrences || [];
    const thisWeek = occurrences.filter((o) => {
      try {
        const d = parseISO(o.occurrence_date);
        return isWithinInterval(d, { start: weekStart, end: weekEnd }) && o.is_enabled;
      } catch {
        return false;
      }
    });

    const openSlots = thisWeek.filter((o) => {
      try {
        const d = parseISO(o.occurrence_date);
        return d >= now && o.is_enabled;
      } catch {
        return false;
      }
    }).length;

    const booked = Math.max(0, thisWeek.length - openSlots);

    let periodLabel = "Selected period";
    try {
      periodLabel = `${format(parseISO(active.start_date), "MMM d")} - ${format(
        parseISO(active.end_date),
        "MMM d, yyyy"
      )}`;
    } catch {
      periodLabel = `${active.start_date} - ${active.end_date}`;
    }

    return { periodLabel, openSlots, booked };
  }, [windows]);

  return (
    <CoachProfileCard>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[20px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">
          <Calendar className="size-5 flex-none text-[#0054B4]" strokeWidth={1.5} aria-hidden="true" />
          Availability
        </h2>
        <Link
          to={ROUTES.AVAILABILITY}
          className="inline-flex h-[34px] items-center justify-center rounded-[8px] border border-[#6698D2] bg-[#0054B4] px-4 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#F1F1E6] transition-colors hover:bg-[#004390]"
        >
          Manage availability
        </Link>
      </div>

      <div className="flex flex-col gap-[5px] rounded-[8px] bg-[#F4F4EB] p-[10px]">
        <span className="text-[12px] font-normal leading-[14px] tracking-[-0.03em] text-[#767980]">Selected period</span>
        <span className="text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">
          {isLoading ? "Loading…" : summary.periodLabel}
        </span>
      </div>

      <div className="flex flex-col">
        {[
          ["Open slots this week", isLoading ? "—" : String(summary.openSlots)],
          ["Booked", isLoading ? "—" : String(summary.booked)],
          ["Session types offered", formatSessionTypes(sessionTypes)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-4 border-t border-[#EAEADF] py-3 first:border-t-0 first:pt-0 last:pb-0"
          >
            <span className="text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-[#767980]">{label}</span>
            <span className="text-right text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">{value}</span>
          </div>
        ))}
      </div>
    </CoachProfileCard>
  );
}
