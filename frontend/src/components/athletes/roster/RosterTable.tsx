import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown } from "@/components/icons";
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

const cap = "text-caption text-dark-300";

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
      <div className={cn(rosterGrid, "hidden border-b border-light-525 pb-[10px] pt-[6px] md:grid")}>
        {COLUMNS.map(([key, text]) => {
          const on = sort === key;
          const Icon = on ? (dir > 0 ? ArrowUp : ArrowDown) : ArrowUpDown;
          return (
            <button
              key={key}
              type="button"
              className={cn("inline-flex items-center gap-1 justify-self-start whitespace-nowrap text-left text-label-xsm", on ? "text-dark" : "text-dark-300")}
              aria-sort={on ? (dir > 0 ? "ascending" : "descending") : "none"}
              onClick={() => onSort(key)}
            >
              {text}
              <Icon className={cn("size-3", on ? "text-primary" : "opacity-50")} strokeWidth={1.5} aria-hidden="true" />
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
            className={cn(rosterGrid, "group cursor-pointer border-b border-light-525 py-3 text-body-m last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary")}
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
                <span className="truncate font-medium transition-colors group-hover:text-primary">{athlete.name}</span>
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
                  <span className="block h-[5px] w-full max-w-[110px] rounded-full bg-light-525">
                    <i className="block h-full rounded-full bg-primary" style={{ width: `${(left / athlete.packageTotal!) * 100}%` }} />
                  </span>
                </div>
              ) : null}
            </div>
            <div>
              <span className={cn(meta, "max-md:hidden")}>{athlete.position || ""}</span>
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
