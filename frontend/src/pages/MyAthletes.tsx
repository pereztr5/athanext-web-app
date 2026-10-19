/**
 * My athletes (WC4 `c-athletes`): just the roster, with "Add athlete" as the only header button.
 * Pending invites are one link above the list; it swaps the page to the invites view
 * (hero, work list, no-fee explainer) with "All athletes" to come back.
 * `?tab=invites` deep-links the invites view; `/invites` and `/my-clients` redirect there.
 */
import { useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Link as LinkIcon, Mail, UserPlus, Users } from "@/components/icons";
import { rosterAPI } from "@/api/roster";
import { BookAthleteDialog } from "@/components/athletes/BookAthleteDialog";
import { AddAthleteModal } from "@/components/athletes/AddAthleteModal";
import { RosterTable } from "@/components/athletes/roster/RosterTable";
import { ALL_PILLARS, RosterToolbar } from "@/components/athletes/roster/RosterToolbar";
import { rosterCard } from "@/components/athletes/roster/styles";
import { InvitesView, usePendingInviteCount } from "@/pages/Invites";
import { PageHeader } from "@/components/ui/page-header";
import { card, primaryButton, secondaryButton, textButton } from "@/components/schedule/styles";
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

  const pendingInvites = usePendingInviteCount(isCoach ? coachId : undefined);
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
  const openAdd = (initial: "email" | "import" = "email") => {
    setAddTab(initial);
    setAdding(true);
  };
  const subtitle = onInvites
    ? "Families you invited to book you on AthaNext"
    : empty
      ? "Nobody on your roster yet"
      : rows.length
        ? plural(rows.length, "athlete")
        : "";

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-wrapper flex-col gap-4 md:gap-6">
        <PageHeader
          title="My athletes"
          subtitle={subtitle || undefined}
          actions={
            <button type="button" className={primaryButton} onClick={() => openAdd()}>
              <UserPlus strokeWidth={1.5} aria-hidden="true" />
              Add athlete
            </button>
          }
        />

        {onInvites ? (
          <>
            <button type="button" className={cn(textButton, "self-start")} onClick={() => setTab("roster")}>
              <ChevronLeft strokeWidth={1.5} aria-hidden="true" />
              All athletes
            </button>
            <InvitesView coachId={coachId} onImport={() => openAdd("import")} />
          </>
        ) : empty ? (
          <>
          {pendingInvites ? (
            <button type="button" className={cn(textButton, "self-start")} onClick={() => setTab("invites")}>
              <Mail strokeWidth={1.5} aria-hidden="true" />
              {plural(pendingInvites, "pending invite")}
              <ChevronRight strokeWidth={1.5} aria-hidden="true" />
            </button>
          ) : null}
          <section className={card}>
            <div className="flex flex-col items-center gap-2.5 px-4 py-7 text-center text-dark-300">
              <Users className="size-6 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
              <span className="text-subtitle text-dark">Bring your athletes to AthaNext</span>
              <p className="max-w-[44ch] text-body-m">
                Invite the families you already coach. They book you here with no marketplace fee.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button type="button" className={secondaryButton} onClick={copyInviteLink} disabled={!coachId}>
                  <LinkIcon strokeWidth={1.5} aria-hidden="true" />
                  Copy invite link
                </button>
                <button type="button" className={primaryButton} onClick={() => openAdd()}>
                  <UserPlus strokeWidth={1.5} aria-hidden="true" />
                  Invite families
                </button>
              </div>
            </div>
          </section>
          </>
        ) : (
          <section className={rosterCard}>
            <div className="flex flex-col gap-3">
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
            {pendingInvites ? (
              <button type="button" className={cn(textButton, "self-start")} onClick={() => setTab("invites")}>
                <Mail strokeWidth={1.5} aria-hidden="true" />
                {plural(pendingInvites, "pending invite")}
                <ChevronRight strokeWidth={1.5} aria-hidden="true" />
              </button>
            ) : null}
            </div>

            {roster.isLoading ? <p className="text-caption text-dark-300">Loading your athletes…</p> : null}
            {!roster.isLoading && !list.length ? (
              <div className="rounded-control border border-dashed border-light-600 p-[18px] text-center text-body-m text-dark-300">
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
                <p className="text-caption text-dark-300">
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
