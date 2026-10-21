import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Building2, MapPin, Search, Users } from "@/components/icons";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import CoachCard from "@/components/coach/CoachCard";
import { OrganizationCard } from "@/components/coach/OrganizationCard";
import { organizationsAPI, type PublicOrganization } from "@/api/organizations";
import CoachChatPanel from "@/components/chat/CoachChatPanel";
import { chatAPI } from "@/api";
import { buildId } from "@/utils/chatHelpers";
import { normalizePosition } from "@/utils/db";
import { useProfile } from "@/contexts/ProfileContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/hooks/use-toast";
import { useSlowLoading } from "@/hooks/useSlowLoading";
import { stripRichTextToPlainText } from "@/utils/richText";
import { isPublicCoachRatingVisible, publicCoachRatingLabel } from "@/utils/publicRating";
import { BrandPill } from "@/components/brand";
import { secondaryButton, segButton, segGroup, smallButton } from "@/components/schedule/styles";
import { PageHeader } from "@/components/ui/page-header";
import { athleteHomeAPI } from "@/api/athleteHome";
import { AGE_GROUPS, agePillLabel, matchesAgeGroup } from "@/utils/coachAges";
import {
  ALL_ACADEMIES,
  academySlug,
  applyOrganizations,
  buildOrgDirectory,
  findOrganization,
  coachAcademy,
  matchesAcademy,
  orgPathByCoach,
} from "@/utils/coachAcademy";
import { organizationPartners } from "@/utils/brands";
import { getCoachSport } from "@/utils/coachSport";
import { useBrandsByCoach } from "@/hooks/useBrands";
import { fetchZipPoint } from "@/utils/geolocation";
import { coachLocationAPI } from "@/api/coachLocation";
import { cn } from "@/lib/utils";
import { BrowseCoachCard } from "@/components/browse/BrowseCoachCard";
import { FilterSelect } from "@/components/browse/FilterSelect";
import { useIntroEnabledCoachIds } from "@/components/intro-calls";
import {
  RADIUS_OPTIONS,
  cleanZipInput,
  coachDistance,
  coachPoint,
  distanceLabel,
  distanceSortValue,
  usableZip,
  withinRadius,
  type CoachDistance,
  type Radius,
} from "@/components/browse/area";

// Public coach type without email for privacy

type Coach = Omit<
  Tables<"coaches">,
  | "email"
  | "slug"
  | "profile_faqs"
  | "cover_image_urls"
  | "favourite_positions"
  | "is_verified"
  | "pathway_tags"
  // Not returned by get_coaches_public.
  | "requires_booking_confirmation"
  | "new_family_booking"
  | "booking_window_weeks"
  | "affiliate_links"
  | "deals_enabled"
  | "listed"
  | "deactivated_at"
  | "pay_mode"
  | "pay_note"
  | "offline_pay"
  | "stripe_customer_id"
  | "stripe_subscription_id"
  | "subscription_status"
  | "trial_ends_at"
> & {
  is_verified?: boolean;
  favourite_positions?: string[];
  pathway_tags?: string[];
  cover_image_urls?: string[] | null;
  zip_code?: string | null;
  slug?: string | null;
  position?: string | null;
  sport_type?: string | null;
  profile_faqs?: Tables<"coaches">["profile_faqs"];
  /** get_coaches_public returns the coaches.position column under this name. */
  coach_position?: string | null;
};

type DirectoryView = "coaches" | "organizations";
type SessionFilter = "any" | "in-person" | "virtual";
type SortKey = "recommended" | "rating" | "price-asc" | "price-desc";

const ANY_AGE = "Any age";
const SPORTS = ["All Sports", "Soccer", "Rowing"];

const AGE_OPTIONS = [ANY_AGE, ...AGE_GROUPS.map((g) => g.label)].map((label) => ({ value: label, label }));
const SESSION_OPTIONS: { value: SessionFilter; label: string }[] = [
  { value: "any", label: "Any session type" },
  { value: "in-person", label: "In person" },
  { value: "virtual", label: "Video call" },
];
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Rating" },
  { value: "price-asc", label: "Price, low to high" },
  { value: "price-desc", label: "Price, high to low" },
];

const DIRECTORY_VIEWS: { value: DirectoryView; label: string; icon: typeof Users }[] = [
  { value: "coaches", label: "Coaches", icon: Users },
  { value: "organizations", label: "Organizations", icon: Building2 },
];

const textLink = "font-medium text-primary hover:text-primary-600";

const matchesSearch = (coach: Coach, query: string) => {
  const has = (value: string | null | undefined) => Boolean(value && value.toLowerCase().includes(query));
  return (
    has(coach.name) ||
    has(stripRichTextToPlainText(coach.bio)) ||
    (coach.locations ?? []).some(has) ||
    (coach.specialties ?? []).some(has) ||
    has(coachAcademy(coach.company)) ||
    (coach.pathway_tags ?? []).some(has)
  );
};

/** Session type filter: in person or virtual. */
const matchesSessionType = (coach: Coach, type: SessionFilter) =>
  type === "any" || (coach.session_types ?? []).some((t) => t.toLowerCase().replace(/\s+/g, "-") === type);

/** Nearest first; two unknown distances tie. */
const compareNear = (a: number, b: number) => (a === b ? 0 : a - b);

const sportRank = (sport: string) => (sport === "soccer" ? 0 : sport === "rowing" ? 1 : 2);

/**
 * Browse Coaches (Working Copy `a-browse`): Coaches and Organizations tabs, search, area, age
 * group, session type and sort, then a grid of coach or organization cards. Signed-out visitors
 * get the directory hero and a sport select on top of the same filters.
 */
const AllCoaches = () => {
  const navigate = useNavigate();
  const { profile, loading: profileLoading } = useProfile();
  const { user, userProfile } = useAuth();
  const { isAuthenticated, isAthleteLike, role: personaType } = useRole();
  const { toast } = useToast();
  // Coaches this family already trains with get a "Your coach" pill (ATH-96).
  const homeQuery = useQuery({ queryKey: ["athlete-home"], queryFn: () => athleteHomeAPI.get(), enabled: isAthleteLike });
  const myCoachIds = useMemo(() => new Set((homeQuery.data?.coaches ?? []).map((c) => c.id)), [homeQuery.data]);
  const introCoachIds = useIntroEnabledCoachIds();

  const [searchParams, setSearchParams] = useSearchParams();
  const directoryView: DirectoryView = searchParams.get("view") === "organizations" ? "organizations" : "coaches";
  const setDirectoryView = (view: DirectoryView) =>
    setSearchParams(
      (params) => {
        if (view === "organizations") params.set("view", view);
        else params.delete("view");
        return params;
      },
      { replace: true }
    );

  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [publicOrgs, setPublicOrgs] = useState<PublicOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const isLoadingSlow = useSlowLoading(loading, 8000);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSport, setSelectedSport] = useState("All Sports");
  const [hasSetInitialSport, setHasSetInitialSport] = useState(false);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState(ANY_AGE);
  const [sessionType, setSessionType] = useState<SessionFilter>("any");
  const [sortBy, setSortBy] = useState<SortKey>("recommended");

  // ZIP filter: prefilled from the family's profile ZIP; coaches sort nearest first and a radius
  // narrows the list. Distance uses ZIP centers, or ZIP prefixes when a center isn't known.
  const profileZip = isAthleteLike ? usableZip(userProfile?.zip_code) : "";
  const [zipInput, setZipInput] = useState(profileZip);
  const [zipEdited, setZipEdited] = useState(false);
  const [radius, setRadius] = useState<Radius>("any");
  useEffect(() => {
    if (!zipEdited) setZipInput(profileZip);
  }, [profileZip, zipEdited]);
  const homeZip = /^\d{5}$/.test(zipInput) ? zipInput : "";
  const homePointQuery = useQuery({
    queryKey: ["zip-point", homeZip],
    enabled: Boolean(homeZip),
    staleTime: Infinity,
    queryFn: () => fetchZipPoint(homeZip),
  });
  const homePoint = homeZip ? (homePointQuery.data ?? null) : null;
  const city = homePoint?.label ?? "";
  const coachPointsQuery = useQuery({
    queryKey: ["coach-coordinates"],
    staleTime: 10 * 60 * 1000,
    queryFn: () => coachLocationAPI.points(),
  });

  // Organization pages link here with ?academy=<name>. Show all clears it.
  const [selectedAcademy, setSelectedAcademy] = useState(searchParams.get("academy") ?? ALL_ACADEMIES);
  useEffect(() => {
    const academy = searchParams.get("academy");
    if (!academy) return;
    setSelectedAcademy(academy);
    setSearchParams(
      (params) => {
        params.delete("academy");
        return params;
      },
      { replace: true }
    );
  }, [searchParams, setSearchParams]);

  const academyCoachIds = useMemo(
    () => coaches.filter((coach) => coach && coachAcademy(coach.company)).map((coach) => coach.id),
    [coaches]
  );
  const { data: brandsByCoach = {} } = useBrandsByCoach(academyCoachIds);

  const [chatCoach, setChatCoach] = useState<Coach | null>(null);
  const [chatConversationId, setChatConversationId] = useState<string | null>(null);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [sendingMessageFor, setSendingMessageFor] = useState<string | null>(null);

  useEffect(() => {
    fetchCoaches();
  }, []);

  // Pick the viewer's sport once the profile loads.
  useEffect(() => {
    if (profileLoading || hasSetInitialSport) return;
    const pick = (raw: unknown) => {
      if (typeof raw !== "string" || !raw.trim()) return false;
      const sport = raw.toLowerCase().trim();
      if (sport === "soccer" || sport === "scoccer" || sport === "football") setSelectedSport("Soccer");
      else if (sport === "rowing" || sport === "crew") setSelectedSport("Rowing");
      else return false;
      return true;
    };
    const sources = [
      profile?.userProfile as Record<string, unknown> | undefined,
      (profile as { coachProfile?: Record<string, unknown> } | null)?.coachProfile,
      profile?.data as Record<string, unknown> | undefined,
    ];
    sources.some((source) => source && (pick(source.sport) || pick(source.sport_type)));
    setHasSetInitialSport(true);
  }, [profile, profileLoading, hasSetInitialSport]);

  const fetchCoaches = async () => {
    try {
      const { data, error } = await supabase.rpc("get_coaches_public");
      if (error || !Array.isArray(data)) {
        if (error) console.error("Error fetching coaches:", error);
        setCoaches([]);
        return;
      }
      const orgs = await organizationsAPI.listPublic().catch(() => [] as PublicOrganization[]);
      setPublicOrgs(orgs);
      setCoaches(
        applyOrganizations(
          data.map((coach) => ({
            ...coach,
            position: coach?.coach_position || null,
            // CoachCard reads favourite_positions.
            favourite_positions: coach.positions || [],
          })),
          orgs
        )
      );
    } catch (error) {
      console.error("Failed to fetch coaches:", error);
    } finally {
      setLoading(false);
    }
  };

  const query = searchQuery.toLowerCase().trim();
  const distances = useMemo(() => {
    const map = new Map<string, CoachDistance>();
    if (!homeZip) return map;
    const points = coachPointsQuery.data ?? new Map();
    for (const coach of coaches) {
      if (!coach) continue;
      map.set(coach.id, coachDistance(coach.zip_code, coachPoint(coach.id, coach.zip_code, points), homeZip, homePoint));
    }
    return map;
  }, [coaches, coachPointsQuery.data, homeZip, homePoint]);
  const distanceOf = (coachId: string) => distances.get(coachId);

  const filteredCoaches = useMemo(() => {
    const target = selectedSport.toLowerCase();
    const list = coaches.filter(
      (coach) =>
        coach &&
        (!query || matchesSearch(coach, query)) &&
        (selectedSport === "All Sports" || getCoachSport(coach) === target) &&
        matchesSessionType(coach, sessionType) &&
        (selectedAgeGroup === ANY_AGE || matchesAgeGroup(coach, selectedAgeGroup)) &&
        (selectedAcademy === ALL_ACADEMIES || matchesAcademy(coach.company, selectedAcademy)) &&
        (!homeZip || radius === "any" || withinRadius(distances.get(coach.id) ?? { miles: null, rank: 3 }, radius))
    );
    const near = (coach: Coach) => (homeZip ? distanceSortValue(distances.get(coach.id) ?? { miles: null, rank: 3 }) : 0);
    const price = (coach: Coach) => Number(coach.hourly_rate) || 0;
    return list.sort((a, b) => {
      switch (sortBy) {
        case "rating":
          return (b.rating || 0) - (a.rating || 0);
        case "price-asc":
          return (price(a) || Infinity) - (price(b) || Infinity);
        case "price-desc":
          return price(b) - price(a);
        default:
          // Recommended: closest first, then Soccer, Rowing, others, then rating.
          return (
            (homeZip ? compareNear(near(a), near(b)) : 0) ||
            sportRank(getCoachSport(a)) - sportRank(getCoachSport(b)) ||
            (b.rating || 0) - (a.rating || 0) ||
            (a.name || "").localeCompare(b.name || "")
          );
      }
    });
  }, [coaches, query, selectedSport, sessionType, selectedAgeGroup, selectedAcademy, radius, homeZip, distances, sortBy]);

  const handleSendMessage = async (coach: Coach) => {
    if (!coach?.id) return;
    if (personaType === "coach") {
      toast({ title: "Coach-to-coach messaging isn't available yet" });
      return;
    }
    if (!user) {
      navigate("/auth?mode=signin");
      return;
    }
    try {
      setSendingMessageFor(coach.id);
      const { data: coachProfile, error: coachProfileError } = await chatAPI.getCoachUserProfile(coach.id);
      if (coachProfileError || !coachProfile?.id) throw coachProfileError || new Error("Coach profile not found");
      const coachUserId = coachProfile.id;
      const { data: existingConversation, error: existingError } = await chatAPI.findConversationBetweenUsers(user.id, coachUserId);
      if (existingError) throw existingError;

      let conversationId = existingConversation?.id || null;
      if (!conversationId) {
        const newConversationId = buildId();
        const { error: conversationError } = await chatAPI.createConversation({
          id: newConversationId,
          created_by: user.id,
          last_message_at: new Date().toISOString(),
          title: coach.name,
          is_group: false,
        });
        if (conversationError) throw conversationError;
        conversationId = newConversationId;
        const { error: participantsError } = await chatAPI.addParticipants([
          { conversation_id: conversationId, user_id: user.id, role: "owner" },
          { conversation_id: conversationId, user_id: coachUserId, role: "member" },
        ]);
        if (participantsError) throw participantsError;
      }

      setChatCoach({
        ...coach,
        positions: coach.positions || (coach.coach_position ? [coach.coach_position] : null),
        coach_position: coach.coach_position || coach.positions?.[0] || undefined,
        specialties: coach.specialties || [],
        image_url: coach.image_url || coach.profile_image_url || null,
      });
      setChatConversationId(conversationId);
      setShowChatPanel(true);
    } catch (err) {
      console.error("Failed to start chat", err);
      toast({ title: "Chat didn't open", description: "Try again in a moment.", variant: "destructive" });
    } finally {
      setSendingMessageFor(null);
    }
  };

  const onViewProfile = (coachId: string) => navigate(`/coach/${coachId}`);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedAgeGroup(ANY_AGE);
    setSessionType("any");
    setSelectedAcademy(ALL_ACADEMIES);
    setRadius("any");
  };

  const verifiedCoachesCount = coaches.filter((coach) => coach?.is_verified).length;
  const sportList = Array.from(new Set(coaches.map((coach) => getCoachSport(coach)).filter(Boolean)));
  const pillarCount = new Set(coaches.flatMap((coach) => coach?.specialties ?? []).filter((p) => p && p.trim())).size;
  const sportNames = sportList.map((sport) => sport.charAt(0).toUpperCase() + sport.slice(1));
  const heroStats = [
    { value: verifiedCoachesCount.toLocaleString(), label: "Verified coaches" },
    {
      value: String(sportList.length),
      label: sportNames.length ? `Sports: ${sportNames.length > 1 ? `${sportNames.slice(0, -1).join(", ")} & ${sportNames[sportNames.length - 1]}` : sportNames[0]}` : "Sports",
    },
    { value: pillarCount.toLocaleString(), label: "Coaching pillars" },
  ];

  if (loading) {
    return (
      <div className={isAuthenticated ? "flex min-h-[50vh] items-center justify-center px-4" : "flex min-h-screen items-center justify-center bg-light px-4"}>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="size-10 animate-spin rounded-full border-2 border-light-525 border-t-primary" />
          <p className="text-label-sm text-dark">Loading coaches</p>
          {isLoadingSlow && (
            <p className="max-w-[320px] text-paragraph-sm text-dark-300">
              This is taking longer than usual. Hang on while we fetch the latest profiles.
            </p>
          )}
        </div>
      </div>
    );
  }

  const showOrganizations = directoryView === "organizations";
  // Same search and filters in both views: an organization is listed when any of its
  // coaches matches, while its card describes the whole organization. Only organizations set
  // up in the app are listed; a coach's own business name never makes one.
  const matchingCoachIds = new Set(filteredCoaches.map((coach) => coach?.id));
  const allOrganizations = buildOrgDirectory(coaches, publicOrgs, getCoachSport);
  const organizations = allOrganizations.filter((org) => org.coachIds.some((id) => matchingCoachIds.has(id)));
  const orgPaths = orgPathByCoach(publicOrgs);
  const selectedOrg = selectedAcademy === ALL_ACADEMIES ? undefined : findOrganization(publicOrgs, academySlug(selectedAcademy));
  const viewCounts: Record<DirectoryView, number> = { coaches: coaches.length, organizations: allOrganizations.length };

  const sportWord = selectedSport === "All Sports" ? "" : selectedSport;
  const place = city || homeZip;
  const subtitle = place
    ? `${sportWord || "Sports"} coaching near ${place}`
    : `${sportWord ? `${sportWord} coaching` : "Coaching"} in person and online`;
  const where = place ? (radius === "any" ? ` near ${place}` : ` within ${radius} miles of ${place}`) : "";
  const countLabel = showOrganizations
    ? `${organizations.length} ${organizations.length === 1 ? "organization" : "organizations"}${where}`
    : `${filteredCoaches.length} ${filteredCoaches.length === 1 ? "coach" : "coaches"}${where}`;
  const filtersOn = Boolean(query) || selectedAgeGroup !== ANY_AGE || sessionType !== "any" || (Boolean(homeZip) && radius !== "any");

  const caption = "text-caption text-dark-300";
  const emptyCard = "flex flex-col items-center gap-[15px] rounded-card border border-light-525 bg-light-300 px-[25px] pb-[25px] pt-[30px] text-center sm:col-span-2 lg:col-span-3";

  return (
    <div className={isAuthenticated ? "overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12" : "min-h-screen bg-light font-sans"}>
      {!isAuthenticated ? (
        <section className="border-b border-light-525 px-4 pb-12 pt-14 md:pb-16 md:pt-20">
          <div className="mx-auto flex max-w-wrapper flex-col items-center gap-[30px] text-center">
            <div className="flex flex-col items-center gap-[15px]">
              <BrandPill tone="blue">Coach directory</BrandPill>
              <h1 className="max-w-[720px] text-highlight text-dark md:text-page-title">
                Discover your coach in our growing directory
              </h1>
              <p className="max-w-[640px] text-body-l text-dark-300">
                Every AthaNext coach has a searchable profile. Explore their experience, compare
                specialties, and find the right fit for your goals.
              </p>
            </div>
            <div className="grid w-full max-w-[760px] grid-cols-1 gap-[10px] sm:grid-cols-3">
              {heroStats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center gap-[6px] rounded-card border border-light-525 bg-light-300 px-[25px] pb-[25px] pt-[30px]"
                >
                  <span className="text-stat text-dark">{stat.value}</span>
                  <span className="text-body-m text-dark-300">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <div className={cn("mx-auto flex w-full max-w-wrapper flex-col gap-4", !isAuthenticated && "px-4 pb-16 pt-10 md:px-0")}>
        {isAuthenticated ? (
          <PageHeader title="View All Coaches" subtitle={subtitle} />
        ) : (
          <div className="flex flex-col gap-2.5">
            <h2 className="text-section text-dark">View All Coaches</h2>
            <p className="text-body-m text-dark-300">{subtitle}</p>
          </div>
        )}

        <div role="group" aria-label="Show" className={cn(segGroup, "inline-flex max-w-full self-start overflow-x-auto [scrollbar-width:none]")}>
          {DIRECTORY_VIEWS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={directoryView === value}
              onClick={() => setDirectoryView(value)}
              className={cn(segButton(directoryView === value), "flex-none")}
            >
              <Icon strokeWidth={1.5} aria-hidden="true" />
              {label}
              <BrandPill tone="neutral">{viewCounts[value]}</BrandPill>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-[1_1_260px]">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute left-3 top-[11px] size-4 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={showOrganizations ? "Search organizations" : "Search coaches, pillars"}
              className="h-[38px] w-full rounded-control border border-dark-250 bg-light pl-9 pr-3 text-body-m text-dark placeholder:text-dark-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
          </label>
          {!isAuthenticated ? (
            <FilterSelect
              label="Sport"
              value={selectedSport}
              options={SPORTS.map((sport) => ({ value: sport, label: sport === "All Sports" ? "All sports" : sport }))}
              onChange={(value) => setSelectedSport(value)}
            />
          ) : null}
          <label className="relative w-[118px] flex-none">
            <span className="sr-only">ZIP code</span>
            <MapPin className="pointer-events-none absolute left-3 top-[11px] size-4 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
            <input
              value={zipInput}
              onChange={(e) => {
                setZipEdited(true);
                setZipInput(cleanZipInput(e.target.value));
              }}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="ZIP code"
              aria-label="ZIP code"
              className="h-[38px] w-full rounded-control border border-dark-250 bg-light pl-9 pr-3 text-body-m tabular-nums text-dark placeholder:text-dark-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
          </label>
          {homeZip ? (
            <div role="group" aria-label="Distance" className={cn(segGroup, "inline-flex max-w-full flex-none overflow-x-auto [scrollbar-width:none]")}>
              {RADIUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={radius === option.value}
                  onClick={() => setRadius(option.value)}
                  className={cn(segButton(radius === option.value), "flex-none")}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
          {!showOrganizations ? (
            <>
              <FilterSelect label="Age group" value={selectedAgeGroup} options={AGE_OPTIONS} onChange={(value) => setSelectedAgeGroup(value)} />
              <FilterSelect label="Session type" value={sessionType} options={SESSION_OPTIONS} onChange={(value) => setSessionType(value)} />
              <FilterSelect label="Sort" value={sortBy} options={SORT_OPTIONS} onChange={(value) => setSortBy(value)} />
            </>
          ) : null}
        </div>

        <p className={caption}>
          {countLabel}
          {!showOrganizations && selectedAcademy !== ALL_ACADEMIES ? (
            <>
              {" · Coaches at "}
              {selectedOrg ? (
                <Link to={`/organizations/${selectedOrg.slug}`} className={textLink}>
                  {selectedAcademy}
                </Link>
              ) : (
                selectedAcademy
              )}
              {". "}
              <button type="button" onClick={() => setSelectedAcademy(ALL_ACADEMIES)} className={textLink}>
                Show all
              </button>
            </>
          ) : null}
          {filtersOn && !showOrganizations ? (
            <>
              {" · "}
              <button type="button" onClick={clearFilters} className={textLink}>
                Clear filters
              </button>
            </>
          ) : null}
        </p>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {showOrganizations ? (
            organizations.length === 0 ? (
              <div className={emptyCard}>
                <Search className="size-5 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
                <p className="text-subtitle text-dark">No organizations match</p>
              </div>
            ) : (
              organizations.map((organization) => (
                <OrganizationCard
                  key={organization.name}
                  organization={organization}
                  page={findOrganization(publicOrgs, organization.slug)}
                  partners={organizationPartners(organization.coachIds, brandsByCoach, 3)}
                />
              ))
            )
          ) : filteredCoaches.length === 0 ? (
            <div className={emptyCard}>
              <Search className="size-5 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
              <div className="flex flex-col gap-[6px]">
                <p className="text-subtitle text-dark">No coaches match</p>
                <p className="text-body-m text-dark-300">Try a different search or clear the filters.</p>
              </div>
              <button
                type="button"
                onClick={clearFilters}
                className={cn(secondaryButton, smallButton)}
              >
                Clear filters
              </button>
            </div>
          ) : (
            filteredCoaches.map((coach) => {
              if (!isAuthenticated) {
                return (
                  <CoachCard
                    key={coach.id}
                    coach={coach}
                    onViewProfile={onViewProfile}
                    onSession={(coachId) => navigate(`/coach/${coachId}`, { state: { scrollToAvailability: true } })}
                    onViewPackages={() => navigate(`/coach/${coach.id}`, { state: { scrollToPackages: true } })}
                    onSendMessage={handleSendMessage}
                    disableSendMessage={false}
                    isSendingMessage={sendingMessageFor === coach.id}
                    organizationTo={orgPaths.get(coach.id) ?? null}
                  />
                );
              }
              const sport = getCoachSport(coach);
              return (
                <BrowseCoachCard
                  key={coach.id}
                  name={coach.name}
                  photoUrl={coach.profile_image_url || coach.image_url}
                  verified={coach.is_verified}
                  role={normalizePosition(sport, coach.coach_position || coach.positions?.[0] || "") || "Coach"}
                  rating={isPublicCoachRatingVisible(coach.total_reviews, coach.rating) ? publicCoachRatingLabel(coach.rating, coach.total_reviews) : null}
                  reviewCount={coach.total_reviews ?? 0}
                  area={[coach.locations?.[0], distanceLabel(distanceOf(coach.id) ?? { miles: null, rank: 3 })].filter(Boolean).join(" · ")}
                  pillars={(coach.specialties ?? []).filter(Boolean).slice(0, 3)}
                  agePill={agePillLabel(coach)}
                  price={Number(coach.hourly_rate) || null}
                  academy={coachAcademy(coach.company)}
                  academyTo={orgPaths.get(coach.id) ?? null}
                  isMine={myCoachIds.has(coach.id)}
                  freeIntro={introCoachIds.has(coach.id)}
                  onOpen={() => onViewProfile(coach.id)}
                />
              );
            })
          )}
        </div>
      </div>

      {showChatPanel && chatCoach && (
        <CoachChatPanel coach={chatCoach} conversationId={chatConversationId ?? undefined} onClose={() => setShowChatPanel(false)} />
      )}
    </div>
  );
};

export default AllCoaches;
