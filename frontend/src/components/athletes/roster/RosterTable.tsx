import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { RosterAthlete } from "@/api/roster";
import { BrandPill } from "@/components/brand";
import { meta, secondaryButton, smallButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { packageLeft, rosterNextLabel, rosterSubtitle, type RosterSort } from "@/utils/roster";
import { plural } from "@/utils/schedule";
import { avatar, initials, rosterGrid } from "./styles";

const COLUMNS: [RosterSort, string][] = [
  ["name", "Athlete"],
  ["next", "Next session"],
  ["pkg", "Package"],
  ["pos", "Position"],
];

const cap = "text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]";

interface RosterTableProps {
  rows: RosterAthlete[];
  sort: RosterSort;
  dir: 1 | -1;
  timeZone: string;
  onSort: (key: RosterSort) => void;
  onBook: (athlete: RosterAthlete) => void;
}

/** Roster rows (Working Copy `.alist`). Phone shows one compact line per athlete. */
export const RosterTable = ({ rows, sort, dir, timeZone, onSort, onBook }: RosterTableProps) => {
  const navigate = useNavigate();
  const open = (id: string) => navigate(`${ROUTES.ATHLETES}/${id}`);

  return (
    <div className="flex flex-col">
      <div className={cn(rosterGrid, "hidden border-b border-[#EAEADF] pb-[10px] pt-[6px] md:grid")}>
        {COLUMNS.map(([key, text]) => {
          const on = sort === key;
          const Icon = on ? (dir > 0 ? ArrowUp : ArrowDown) : ArrowUpDown;
          return (
            <button
              key={key}
              type="button"
              className={cn("inline-flex items-center gap-1 justify-self-start whitespace-nowrap text-left text-[12px] font-medium", on ? "text-[#1A202C]" : "text-[#767980]")}
              aria-sort={on ? (dir > 0 ? "ascending" : "descending") : "none"}
              onClick={() => onSort(key)}
            >
              {text}
              <Icon className={cn("size-3", on ? "text-[#0054B4]" : "opacity-50")} strokeWidth={1.5} aria-hidden="true" />
            </button>
          );
        })}
        <span />
      </div>
      {rows.map((athlete) => {
        const left = packageLeft(athlete);
        const next = athlete.next ? rosterNextLabel(athlete.next.date, athlete.next.startTime, timeZone) : "";
        return (
          <div
            key={athlete.id}
            role="button"
            tabIndex={0}
            className={cn(rosterGrid, "group cursor-pointer border-b border-[#EAEADF] py-3 text-[14px] last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]")}
            onClick={() => open(athlete.id)}
            onKeyDown={(e) => {
              if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                open(athlete.id);
              }
            }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className={avatar} aria-hidden="true">
                {athlete.imageUrl ? <img src={athlete.imageUrl} alt="" className="size-full object-cover" /> : initials(athlete.name)}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate font-medium transition-colors group-hover:text-[#0054B4]">{athlete.name}</span>
                <span className={cn(cap, "max-md:hidden")}>{rosterSubtitle(athlete)}</span>
                <span className={cn(cap, "truncate md:hidden")}>
                  {next || "Not booked"}
                  {athlete.position ? ` · ${athlete.position}` : ""}
                </span>
              </div>
            </div>
            <div className="max-md:hidden">{next || <span className={cap}>Not booked</span>}</div>
            <div className="min-w-0 overflow-hidden max-md:hidden">
              {left === 0 ? (
                <span className={cap}>Package used</span>
              ) : left != null ? (
                <div className="flex min-w-0 flex-col gap-1">
                  <span className={cap}>{left} of {athlete.packageTotal} left</span>
                  <span className="block h-[5px] w-full max-w-[110px] rounded-[3px] bg-[#EAEADF]">
                    <i className="block h-full rounded-[3px] bg-[#0054B4]" style={{ width: `${(left / athlete.packageTotal!) * 100}%` }} />
                  </span>
                </div>
              ) : null}
            </div>
            <div>
              <span className={cn(meta, "leading-[14px] max-md:hidden")}>{athlete.position || ""}</span>
              {athlete.credits ? <BrandPill tone="green" className="md:hidden">{plural(athlete.credits, "credit")}</BrandPill> : null}
            </div>
            <span>
              <button
                type="button"
                className={cn(secondaryButton, smallButton, "h-[32px]")}
                aria-label={`Book ${athlete.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onBook(athlete);
                }}
              >
                Book
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
};
