/**
 * My Athletes (WC4): Roster and Invites tabs. Invites is the work list
 * (Needs approval / Waiting / Joined / All). Marketplace families stay on the roster only.
 * `/invites` and `/my-clients` open the Invites tab.
 */
import { useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Link as LinkIcon, UserPlus, Users } from "lucide-react";
import { rosterAPI } from "@/api/roster";
import { BookAthleteDialog } from "@/components/athletes/BookAthleteDialog";
import { AddAthleteModal } from "@/components/athletes/AddAthleteModal";
import { RosterTable } from "@/components/athletes/roster/RosterTable";
import { ALL_PILLARS, RosterToolbar } from "@/components/athletes/roster/RosterToolbar";
import { rosterCard } from "@/components/athletes/roster/styles";
import { InvitesWorkList } from "@/pages/Invites";
import { card, pageTitle, primaryButton, secondaryButton, segButton, segGroup, textButton } from "@/components/schedule/styles";
import { useProfile } from "@/contexts/ProfileContext";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { joinLinkFor } from "@/utils/referralHelpers";
import { ROSTER_SORTS, sortRoster, type RosterSort } from "@/utils/roster";
import { plural } from "@/utils/schedule";

type AthletesTab = "roster" | "invites";

const MyAthletesPage = () => {
  const { isCoach, ready } = useRole();
  const { profile } = useProfile();
  const { toast } = useToast();
  const timeZone = useViewerTimeZone();
  const [searchParams, setSearchParams] = useSearchParams();
  const coachId = profile?.userProfile?.coach_id ?? undefined;
  const roster = useQuery({ queryKey: ["coach-roster"], queryFn: () => rosterAPI.roster(), enabled: isCoach });
  const coachPillars = useQuery({
    queryKey: ["coach-pillars", coachId],
    queryFn: () => rosterAPI.coachPillars(coachId!),
    enabled: Boolean(coachId),
  });

  const tab: AthletesTab = searchParams.get("tab") === "invites" ? "invites" : "roster";
  const [query, setQuery] = useState("");
  const [pillar, setPillar] = useState(ALL_PILLARS);
  const [sort, setSort] = useState<RosterSort>("name");
  const [dir, setDir] = useState<1 | -1>(1);
  const [adding, setAdding] = useState(searchParams.get("onboarding") === "1");
  const [addTab, setAddTab] = useState<"email" | "import">("email");
  const [booking, setBooking] = useState<{ id: string; name: string } | null>(null);

  const setTab = (next: AthletesTab) => {
    const params = new URLSearchParams(searchParams);
    if (next === "invites") params.set("tab", "invites");
    else params.delete("tab");
    setSearchParams(params, { replace: true });
  };

  // The coach's own pillars; the roster's pillars only when the profile has none.
  const pillars = useMemo(() => {
    if (coachPillars.data?.length) return coachPillars.data;
    const set = new Set<string>();
    (roster.data ?? []).forEach((a) => a.pillars.forEach((p) => set.add(p)));
    return [...set].sort();
  }, [coachPillars.data, roster.data]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = (roster.data ?? []).filter((a) => {
      const hay = `${a.name} ${a.accountName ?? ""} ${a.team ?? ""}`.toLowerCase();
      return (!q || hay.includes(q)) && (pillar === ALL_PILLARS || a.pillars.includes(pillar));
    });
    return sortRoster(filtered, sort, dir);
  }, [roster.data, query, pillar, sort, dir]);

  const onSortColumn = (key: RosterSort) => {
    if (sort === key) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSort(key);
      setDir(1);
    }
  };

  const clearFilters = () => {
    setQuery("");
    setPillar(ALL_PILLARS);
  };

  const copyInviteLink = async () => {
    if (!coachId) return;
    const link = joinLinkFor(coachId);
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Copy failed", description: link, variant: "destructive" });
    }
  };

  if (!ready) return null;
  if (!isCoach) return <Navigate to={ROUTES.BOOK} replace />;

  const rows = roster.data ?? [];
  const empty = !rows.length && !roster.isLoading;
  const onInvites = tab === "invites";
  const sortLabel = ROSTER_SORTS.find(([k]) => k === sort)?.[1] ?? "Name A–Z";
  const subtitle = onInvites
    ? "Families you invited to book you on AthaNext"
    : empty
      ? "Nobody on your roster yet"
      : rows.length
        ? plural(rows.length, "athlete")
        : "";

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-[10px]">
            <h1 className={pageTitle}>My Athletes</h1>
            <p className="min-h-[18px] text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onInvites ? (
              <button type="button" className={secondaryButton} onClick={copyInviteLink} disabled={!coachId}>
                <LinkIcon strokeWidth={1.5} aria-hidden="true" />
                Copy invite link
              </button>
            ) : null}
            <button
              type="button"
              className={primaryButton}
              onClick={() => {
                setAddTab("email");
                setAdding(true);
              }}
            >
              <UserPlus strokeWidth={1.5} aria-hidden="true" />
              Invite families
            </button>
          </div>
        </header>

        <div className={cn(segGroup, "w-fit")} role="tablist" aria-label="Athletes views">
          {(
            [
              ["roster", "Roster"],
              ["invites", "Invites"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={cn(segButton(tab === id), "flex-none")}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {onInvites ? (
          <InvitesWorkList coachId={coachId} />
        ) : empty ? (
          <section className={card}>
            <div className="flex flex-col items-center gap-[10px] px-4 py-7 text-center text-[#767980]">
              <Users className="size-7 text-[#A3A6AB]" strokeWidth={1.5} aria-hidden="true" />
              <span className="text-[16px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">Bring your athletes to AthaNext</span>
              <p className="max-w-[44ch] text-[14px] leading-[18px]">
                Invite the families you already coach. They join your roster and book you directly.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button type="button" className={secondaryButton} onClick={copyInviteLink} disabled={!coachId}>
                  <LinkIcon strokeWidth={1.5} aria-hidden="true" />
                  Copy invite link
                </button>
                <button
                  type="button"
                  className={primaryButton}
                  onClick={() => {
                    setAddTab("email");
                    setAdding(true);
                  }}
                >
                  <UserPlus strokeWidth={1.5} aria-hidden="true" />
                  Invite families
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className={rosterCard}>
            <RosterToolbar
              query={query}
              onQuery={setQuery}
              pillar={pillar}
              pillars={pillars}
              onPillar={setPillar}
              sort={sort}
              onSort={(value) => {
                setSort(value);
                setDir(1);
              }}
            />

            {roster.isLoading ? <p className="text-[12px] leading-[14px] text-[#767980]">Loading your athletes…</p> : null}
            {!roster.isLoading && !list.length ? (
              <div className="rounded-[8px] border border-dashed border-[#C1C1B8] p-[18px] text-center text-[13px] text-[#767980]">
                No athletes match.{" "}
                <button type="button" className={textButton} onClick={clearFilters}>Clear filters</button>
              </div>
            ) : null}

            {list.length ? (
              <>
                <RosterTable
                  rows={list}
                  sort={sort}
                  dir={dir}
                  timeZone={timeZone}
                  onSort={onSortColumn}
                  onBook={(athlete) => setBooking({ id: athlete.id, name: athlete.name })}
                />
                <p className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
                  Showing {list.length} of {rows.length} · sorted by {sortLabel.toLowerCase()}{dir < 0 ? ", reversed" : ""}
                </p>
              </>
            ) : null}
          </section>
        )}
      </div>
      <AddAthleteModal open={adding} onClose={() => setAdding(false)} coachId={coachId} initialTab={addTab} />
      <BookAthleteDialog athleteId={booking?.id ?? null} name={booking?.name ?? ""} onClose={() => setBooking(null)} />
    </div>
  );
};

export default MyAthletesPage;
