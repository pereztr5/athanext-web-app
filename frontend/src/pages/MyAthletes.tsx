/**
 * My Athletes (ATH-74): one sortable roster. "N pending invites" opens an in-page tab with
 * open invites and sign-ups to approve; the full history lives on the Invites page.
 */
import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Link as LinkIcon, Mail, UserPlus, Users } from "lucide-react";
import { rosterAPI } from "@/api/roster";
import { BookAthleteDialog } from "@/components/athletes/BookAthleteDialog";
import { AddAthleteModal } from "@/components/athletes/AddAthleteModal";
import { invitesFromReferrals, OPEN_INVITES_KEY } from "@/components/athletes/roster/invites";
import { RosterInvites } from "@/components/athletes/roster/RosterInvites";
import { RosterTable } from "@/components/athletes/roster/RosterTable";
import { ALL_PILLARS, RosterToolbar } from "@/components/athletes/roster/RosterToolbar";
import { rosterCard } from "@/components/athletes/roster/styles";
import { card, pageTitle, primaryButton, secondaryButton, textButton } from "@/components/schedule/styles";
import { useProfile } from "@/contexts/ProfileContext";
import { useToast } from "@/hooks/use-toast";
import { useCoachReferrals } from "@/hooks/useReferrals";
import { useRole } from "@/hooks/useRole";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { joinLinkFor } from "@/utils/referralHelpers";
import { ROSTER_SORTS, sortRoster, type RosterSort } from "@/utils/roster";
import { plural } from "@/utils/schedule";

const MyAthletesPage = () => {
  const { isCoach, ready } = useRole();
  const { profile } = useProfile();
  const { toast } = useToast();
  const timeZone = useViewerTimeZone();
  const coachId = profile?.userProfile?.coach_id ?? undefined;
  const roster = useQuery({ queryKey: ["coach-roster"], queryFn: () => rosterAPI.roster(), enabled: isCoach });
  const openInvites = useQuery({ queryKey: OPEN_INVITES_KEY, queryFn: () => rosterAPI.openInvites(), enabled: isCoach, retry: false });
  const coachPillars = useQuery({
    queryKey: ["coach-pillars", coachId],
    queryFn: () => rosterAPI.coachPillars(coachId!),
    enabled: Boolean(coachId),
  });
  const referrals = useCoachReferrals(openInvites.isError ? coachId : undefined);
  const [tab, setTab] = useState<"all" | "invites">("all");
  const [query, setQuery] = useState("");
  const [pillar, setPillar] = useState(ALL_PILLARS);
  const [sort, setSort] = useState<RosterSort>("name");
  const [dir, setDir] = useState<1 | -1>(1);
  const [adding, setAdding] = useState(false);
  const [booking, setBooking] = useState<{ id: string; name: string } | null>(null);

  const invites = useMemo(
    () => openInvites.data ?? invitesFromReferrals(referrals.data ?? []),
    [openInvites.data, referrals.data],
  );
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
  const onInvites = tab === "invites" && !empty;
  const sortLabel = ROSTER_SORTS.find(([k]) => k === sort)?.[1] ?? "Name A–Z";
  const subtitle = empty
    ? "Nobody on your roster yet"
    : onInvites
      ? "Families you invited who haven't joined yet"
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
          <button type="button" className={primaryButton} onClick={() => setAdding(true)}>
            <UserPlus strokeWidth={1.5} aria-hidden="true" />
            Add athlete
          </button>
        </header>

        {empty ? (
          <section className={card}>
            <div className="flex flex-col items-center gap-[10px] px-4 py-7 text-center text-[#767980]">
              <Users className="size-7 text-[#A3A6AB]" strokeWidth={1.5} aria-hidden="true" />
              <span className="text-[16px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">Bring your athletes to AthaNext</span>
              <p className="max-w-[44ch] text-[14px] leading-[18px]">
                Invite the families you already coach. They book you here with no marketplace fee.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button type="button" className={secondaryButton} onClick={copyInviteLink} disabled={!coachId}>
                  <LinkIcon strokeWidth={1.5} aria-hidden="true" />
                  Copy invite link
                </button>
                <button type="button" className={primaryButton} onClick={() => setAdding(true)}>
                  <UserPlus strokeWidth={1.5} aria-hidden="true" />
                  Invite families
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className={rosterCard}>
            {onInvites ? (
              <>
                <button type="button" className={cn(textButton, "self-start text-[#767980] hover:text-[#1A202C] hover:no-underline")} onClick={() => setTab("all")}>
                  <ChevronLeft strokeWidth={1.5} aria-hidden="true" />
                  All athletes
                </button>
                <RosterInvites invites={invites} />
              </>
            ) : (
              <>
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
                  {invites.length ? (
                    <button type="button" className={cn(textButton, "self-start hover:text-[#004390] hover:no-underline")} onClick={() => setTab("invites")}>
                      <Mail strokeWidth={1.5} aria-hidden="true" />
                      {plural(invites.length, "pending invite")}
                      <ChevronRight strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>

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
              </>
            )}
          </section>
        )}
      </div>
      <AddAthleteModal open={adding} onClose={() => setAdding(false)} coachId={coachId} />
      <BookAthleteDialog athleteId={booking?.id ?? null} name={booking?.name ?? ""} onClose={() => setBooking(null)} />
    </div>
  );
};

export default MyAthletesPage;
