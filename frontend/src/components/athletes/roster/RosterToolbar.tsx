import { ArrowUpDown, ChevronDown, Search } from "@/components/icons";
import { input } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { ROSTER_SORTS, type RosterSort } from "@/utils/roster";
import { rosterInputPhone, selChip } from "./styles";

export const ALL_PILLARS = "All pillars";

interface RosterToolbarProps {
  query: string;
  onQuery: (value: string) => void;
  pillar: string;
  pillars: string[];
  onPillar: (value: string) => void;
  sort: RosterSort;
  onSort: (value: RosterSort) => void;
}

const Chevron = () => (
  <ChevronDown className="pointer-events-none absolute right-[10px] top-1/2 size-4 -translate-y-1/2 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
);

/** Search, pillar and sort (Working Copy `.athtools`). */
export const RosterToolbar = ({ query, onQuery, pillar, pillars, onPillar, sort, onSort }: RosterToolbarProps) => (
  <div className="flex w-full flex-wrap items-center gap-2 md:flex-nowrap">
    <label className="relative min-w-0 flex-[1_1_100%] md:flex-[1_1_260px]">
      <span className="sr-only">Search athletes</span>
      <Search className="pointer-events-none absolute left-3 top-[11px] size-4 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
      <input
        className={cn(input, "pl-9", rosterInputPhone)}
        placeholder="Search athletes or parents"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
      />
    </label>
    <span className="relative flex-[1_1_40%] md:flex-none">
      <select aria-label="Pillar" className={selChip} value={pillar} onChange={(e) => onPillar(e.target.value)}>
        {[ALL_PILLARS, ...pillars].map((p) => <option key={p}>{p}</option>)}
      </select>
      <Chevron />
    </span>
    <span className="relative flex-[1_1_40%] md:flex-none">
      <ArrowUpDown className="pointer-events-none absolute left-[10px] top-1/2 size-[14px] -translate-y-1/2 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
      <select aria-label="Sort by" className={cn(selChip, "pl-[30px]")} value={sort} onChange={(e) => onSort(e.target.value as RosterSort)}>
        {ROSTER_SORTS.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
      </select>
      <Chevron />
    </span>
  </div>
);
