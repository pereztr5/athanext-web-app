/**
 * My Athletes (ATH-74): one sortable roster. Pending invites and families waiting for approval
 * stay on the existing invite page (My Clients).
 */
import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Mail, Plus, Search, UserCheck, Users } from "lucide-react";
import { rosterAPI } from "@/api/roster";
import { BookAthleteDialog } from "@/components/athletes/BookAthleteDialog";
import { AddAthleteModal } from "@/components/athletes/AddAthleteModal";
import { card, meta, primaryButton, secondaryButton, textButton } from "@/components/schedule/styles";
import { useProfile } from "@/contexts/ProfileContext";
import { useCoachReferrals } from "@/hooks/useReferrals";
import { useRole } from "@/hooks/useRole";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { isAwaitingCoachApproval, isInviteExpired, isOpenInvite } from "@/utils/referralHelpers";
import { ROSTER_SORTS, rosterSubtitle, sortRoster, type RosterSort } from "@/utils/roster";
import { plural } from "@/utils/schedule";
import { zonedWallTimeToUtc, getZonedISODate } from "@/utils/dateHelpers";
import { formatClock, formatDayISO } from "@/utils/schedule";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";

const nextLabel = (date: string, start: string, timeZone: string) => {
  const at = zonedWallTimeToUtc(date, start) ?? new Date(NaN);
  const day = formatDayISO(getZonedISODate(at, timeZone), { month: "short", day: "numeric" });
  return `${day}, ${formatClock(at, timeZone)}`;
};

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

const MyAthletesPage = () => {
  const { isCoach, ready } = useRole();
  const { profile } = useProfile();
  const timeZone = useViewerTimeZone();
  const coachId = profile?.userProfile?.coach_id ?? undefined;
  const roster = useQuery({ queryKey: ["coach-roster"], queryFn: () => rosterAPI.roster(), enabled: isCoach });
  const referrals = useCoachReferrals(coachId);
  const [query, setQuery] = useState("");
  const [pillar, setPillar] = useState("All pillars");
  const [sort, setSort] = useState<RosterSort>("name");
  const [dir, setDir] = useState<1 | -1>(1);
  const [adding, setAdding] = useState(false);
  const [booking, setBooking] = useState<{ id: string; name: string } | null>(null);

  const pending = (referrals.data ?? []).filter((r) => isOpenInvite(r) && !isInviteExpired(r)).length;
  const toApprove = (referrals.data ?? []).filter(isAwaitingCoachApproval).length;
  const pillars = useMemo(() => {
    const set = new Set<string>();
    (roster.data ?? []).forEach((a) => a.pillars.forEach((p) => set.add(p)));
    return [...set].sort();
  }, [roster.data]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = (roster.data ?? []).filter((a) => {
      const hay = `${a.name} ${a.accountName ?? ""} ${a.team ?? ""}`.toLowerCase();
      return (!q || hay.includes(q)) && (pillar === "All pillars" || a.pillars.includes(pillar));
    });
    return sortRoster(filtered, sort, dir);
  }, [roster.data, query, pillar, sort, dir]);

  const onSort = (key: RosterSort) => {
    if (sort === key) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSort(key);
      setDir(1);
    }
  };

  if (!ready) return null;
  if (!isCoach) return <Navigate to={ROUTES.BOOK} replace />;

  const rows = roster.data ?? [];
  const sortLabel = ROSTER_SORTS.find(([k]) => k === sort)?.[1] ?? "Name A–Z";

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-[10px]">
            <h1 className="text-[26px] md:text-[32px] font-bold leading-[26px] md:leading-[28px] tracking-[-1.6px] text-[#1A202C]">My Athletes</h1>
            <p className="text-[16px] leading-[18px] text-[#767980]">
              {rows.length ? plural(rows.length, "athlete") : "Nobody on your roster yet"}
            </p>
          </div>
          <button type="button" className={primaryButton} onClick={() => setAdding(true)}>
            <Plus strokeWidth={1.5} aria-hidden="true" />
            Add athlete
          </button>
        </header>

        {!rows.length && !roster.isLoading ? (
          <section className={cn(card, "items-center py-10 text-center")}>
            <Users className="size-8 text-[#A3A6AB]" strokeWidth={1.5} aria-hidden="true" />
            <b className="text-[18px] font-medium">Bring your athletes to AthaNext</b>
            <p className="max-w-[420px] text-[14px] text-[#767980]">
              Invite the families you already coach. They book you here with no marketplace fee.
            </p>
            <button type="button" className={primaryButton} onClick={() => setAdding(true)}>Invite families</button>
            {toApprove ? (
              <Link to={ROUTES.MY_CLIENTS} className={textButton}>
                {toApprove} waiting for your approval
                <ChevronRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            ) : null}
          </section>
        ) : (
          <section className={card}>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative min-w-[200px] flex-1">
                  <span className="sr-only">Search athletes</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
                  <input
                    className="h-[38px] w-full rounded-[8px] border border-[#EAEADF] bg-[#F9F9F5] pl-9 pr-3 text-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]"
                    placeholder="Search athletes or parents"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Pillar"
                  className="h-[38px] rounded-[8px] border border-[#EAEADF] bg-[#F9F9F5] px-3 text-[14px]"
                  value={pillar}
                  onChange={(e) => setPillar(e.target.value)}
                >
                  <option>All pillars</option>
                  {pillars.map((p) => <option key={p}>{p}</option>)}
                </select>
                <label className="flex items-center gap-1.5">
                  <ArrowUpDown className="size-4 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
                  <span className="sr-only">Sort by</span>
                  <select
                    aria-label="Sort by"
                    className="h-[38px] rounded-[8px] border border-[#EAEADF] bg-[#F9F9F5] px-3 text-[14px]"
                    value={sort}
                    onChange={(e) => { setSort(e.target.value as RosterSort); setDir(1); }}
                  >
                    {ROSTER_SORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                </label>
              </div>
              {pending || toApprove ? (
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {toApprove ? (
                    <Link to={ROUTES.MY_CLIENTS} className={textButton}>
                      <UserCheck className="size-4" strokeWidth={1.5} aria-hidden="true" />
                      {toApprove} waiting for your approval
                      <ChevronRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
                    </Link>
                  ) : null}
                  {pending ? (
                    <Link to={ROUTES.MY_CLIENTS} className={textButton}>
                      <Mail className="size-4" strokeWidth={1.5} aria-hidden="true" />
                      {plural(pending, "pending invite")}
                      <ChevronRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>

            {roster.isLoading ? <p className={meta}>Loading your athletes…</p> : null}
            {!roster.isLoading && !list.length ? (
              <p className={meta}>
                No athletes match.{" "}
                <button type="button" className={textButton} onClick={() => { setQuery(""); setPillar("All pillars"); }}>
                  Clear filters
                </button>
              </p>
            ) : null}

            {list.length ? (
              <div className="flex flex-col">
                <div className="hidden grid-cols-[1.4fr_1fr_1fr_0.8fr_auto] gap-3 border-b border-[#EAEADF] px-1 py-2 md:grid">
                  {([
                    ["name", "Athlete"],
                    ["next", "Next session"],
                    ["pkg", "Package"],
                    ["pos", "Position"],
                  ] as [RosterSort, string][]).map(([key, label]) => {
                    const on = sort === key;
                    const Icon = on ? (dir > 0 ? ArrowUp : ArrowDown) : ArrowUpDown;
                    return (
                      <button key={key} type="button" className={cn("inline-flex items-center gap-1 text-left text-[12px] font-medium", on ? "text-[#0054B4]" : "text-[#767980]")} aria-sort={on ? (dir > 0 ? "ascending" : "descending") : "none"} onClick={() => onSort(key)}>
                        {label}
                        <Icon className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                      </button>
                    );
                  })}
                  <span />
                </div>
                {list.map((athlete) => {
                  const left = athlete.packageTotal != null ? Math.max(0, athlete.packageTotal - (athlete.packageUsed ?? 0)) : null;
                  return (
                    <div key={athlete.id} className="grid grid-cols-1 items-center gap-3 border-b border-[#EAEADF] py-3 md:grid-cols-[1.4fr_1fr_1fr_0.8fr_auto]">
                      <Link to={`${ROUTES.ATHLETES}/${athlete.id}`} className="flex min-w-0 items-center gap-3">
                        <span className="flex size-[34px] flex-none items-center justify-center overflow-hidden rounded-full bg-[#D9D9CF] text-[13px] font-semibold text-[#484D56]">
                          {athlete.imageUrl ? <img src={athlete.imageUrl} alt="" className="size-full object-cover" /> : initials(athlete.name)}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <b className="truncate text-[14px] font-medium">{athlete.name}</b>
                          <span className={meta}>{rosterSubtitle(athlete)}</span>
                        </span>
                      </Link>
                      <span className="text-[14px]">
                        {athlete.next ? nextLabel(athlete.next.date, athlete.next.startTime, timeZone) : <span className={meta}>Not booked</span>}
                      </span>
                      <span className="text-[14px]">
                        {left === 0 && athlete.packageTotal ? (
                          <span className={meta}>Package used</span>
                        ) : left != null && athlete.packageTotal ? (
                          <span className="flex flex-col gap-1">
                            <span className={meta}>{left} of {athlete.packageTotal} left</span>
                            <span className="h-[4px] overflow-hidden rounded-full bg-[#EAEADF]">
                              <i className="block h-full bg-[#0054B4]" style={{ width: `${(left / athlete.packageTotal) * 100}%` }} />
                            </span>
                          </span>
                        ) : athlete.credits ? (
                          <span className={meta}>{plural(athlete.credits, "credit")} left</span>
                        ) : null}
                      </span>
                      <span className={meta}>{athlete.position || ""}</span>
                      <button type="button" className={secondaryButton} onClick={() => setBooking({ id: athlete.id, name: athlete.name })}>
                        Book
                      </button>
                    </div>
                  );
                })}
                <p className={cn(meta, "pt-3")}>
                  Showing {list.length} of {rows.length} · sorted by {sortLabel.toLowerCase()}{dir < 0 ? ", reversed" : ""}
                </p>
              </div>
            ) : null}
          </section>
        )}
      </div>
      <AddAthleteModal open={adding} onClose={() => setAdding(false)} coachId={coachId} />
      <BookAthleteDialog athleteId={booking?.id ?? null} name={booking?.name ?? ""} onClose={() => setBooking(null)} />
    </div>
  );
};

export default MyAthletesPage;
