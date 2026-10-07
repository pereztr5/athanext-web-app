import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BadgeCheck, Building2, MapPin, Search, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import CoachSchedulingModal from "@/components/coach/CoachSchedulingModal";
import { CoachVerificationBadge } from "@/components/coach/CoachVerificationBadge";
import { PackagesModal } from "@/components/coach/PackagesModal";
import { FreeConsultationInfoDialog } from "@/components/coach/FreeConsultationInfoDialog";
import { useCoachPackages } from "@/hooks/useCoachPackages";
import { useProfile } from "@/contexts/ProfileContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/hooks/use-toast";
import { strings } from "@/config/strings";
import starIcon from "../assets/images/star.png";
import footballIcon from "../assets/images/colored-soccer.png";
import rowerIcon from "../assets/images/colored-rowing.png";
import CoachCard from "@/components/coach/CoachCard";
import { OrganizationCard } from "@/components/coach/OrganizationCard";
import { organizationsAPI, type PublicOrganization } from "@/api/organizations";
import CoachChatPanel from "@/components/chat/CoachChatPanel";
import { chatAPI } from "@/api";
import { buildId } from "@/utils/chatHelpers";
import { SPORTS_OPTIONS, normalizePosition } from "@/utils/db";
import { useSportPillars } from "@/hooks/useSportPillars";
import type { Enums } from "@/integrations/supabase/types";
import { useSlowLoading } from "@/hooks/useSlowLoading";
import { stripRichTextToPlainText } from "@/utils/richText";
import { isPublicCoachRatingVisible, publicCoachRatingLabel } from "@/utils/publicRating";
import { BrandPill, BrandStar } from "@/components/brand";
import { athleteHomeAPI } from "@/api/athleteHome";
import { AGE_GROUPS, agePillLabel, matchesAgeGroup } from "@/utils/coachAges";
import {
  ALL_ACADEMIES,
  academySlug,
  applyOrganizations,
  buildOrganizations,
  findOrganization,
  coachAcademy,
  getAcademyOptions,
  matchesAcademy,
  organizationPath,
} from "@/utils/coachAcademy";
import { organizationPartners } from "@/utils/brands";
import { getCoachSport } from "@/utils/coachSport";
import { useBrandsByCoach } from "@/hooks/useBrands";
import {
  PATHWAY_TAGS,
  zipProximityRank,
} from "@/constants/pathwayTags";

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
const ALL_SESSION_TYPES = "All Session Types";
const ANY_AGE = "Any Age";

const DIRECTORY_VIEWS: { value: DirectoryView; label: string; icon: typeof Users }[] = [
  { value: "coaches", label: "Coaches", icon: Users },
  { value: "organizations", label: "Organizations", icon: Building2 },
];

/**
 * Coach card for signed-in families (ATH-96): the whole card opens the profile, with one
 * full-width View profile button. Name and badge, role, rating, area, pillar pills, "From $X",
 * and the coach's organization, "Your coach", or Independent.
 */
const AthleteBrowseCard = ({
  coach,
  sport,
  isMine,
  onOpen,
}: {
  coach: Coach;
  sport: string;
  isMine: boolean;
  onOpen: () => void;
}) => {
  const photo = coach.profile_image_url || coach.image_url || "";
  const initials = (coach.name || "Coach")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  const rawPosition = coach.coach_position || coach.positions?.[0] || "";
  const position = normalizePosition(sport, rawPosition) || "Coach";
  const location = coach.locations?.[0] || "";
  const ratingVisible = isPublicCoachRatingVisible(coach.total_reviews, coach.rating);
  const price = coach.hourly_rate ? `$${Math.round(Number(coach.hourly_rate))}` : null;
  const pillars = (coach.specialties || []).filter(Boolean).slice(0, 3);
  const academy = coachAcademy(coach.company);
  const agePill = agePillLabel(coach);

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`View ${coach.name}'s profile`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="flex min-w-0 cursor-pointer flex-col gap-4 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] p-4 transition-colors hover:border-[#C1C1B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E5EDF7] text-[14px] font-medium text-[#0054B4]">
          {photo ? <img src={photo} alt="" className="size-full object-cover" /> : initials}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-[5px]">
            <h2 className="truncate text-[18px] font-medium leading-[20px] tracking-[-0.8px] text-[#1A202C]">{coach.name}</h2>
            {coach.is_verified ? <BadgeCheck className="size-4 shrink-0 fill-[#0054B4] text-white" strokeWidth={2} aria-label="Verified" /> : null}
          </div>
          <p className="truncate text-[12px] font-medium leading-[14px] text-[#767980]">{position}</p>
          <p className="flex min-w-0 items-center gap-[6px] text-[12px] leading-[14px] text-[#767980]">
            {ratingVisible ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-[#1A202C]">
                <BrandStar size={10} />
                <b className="font-medium">{publicCoachRatingLabel(coach.rating, coach.total_reviews)}</b>
                <span className="text-[#767980]">({coach.total_reviews})</span>
              </span>
            ) : (
              <span className="shrink-0">New</span>
            )}
            {location ? (
              <>
                <span aria-hidden="true">·</span>
                <MapPin className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                <span className="truncate">{location}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      {pillars.length || agePill ? (
        <div className="flex flex-wrap gap-[5px]">
          {pillars.map((pillar) => (
            <span key={pillar} className="rounded-[4px] border border-[#EAEADF] bg-[#F4F4EB] px-2 py-1 text-[12px] font-medium leading-[13px] text-[#484D56]">
              {pillar}
            </span>
          ))}
          {agePill ? (
            <span className="rounded-[4px] border border-[#BFE3EC] bg-[#E7F4F8] px-2 py-1 text-[12px] font-medium leading-[13px] text-[#117A96]">
              {agePill}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto flex flex-col gap-3">
        <div className="flex min-w-0 items-center justify-between gap-2 text-[12px] text-[#767980]">
          <span className="whitespace-nowrap">
            {price ? (
              <>
                From <b className="text-[14px] font-medium text-[#1A202C]">{price}</b>
              </>
            ) : null}
          </span>
          {academy ? (
            <Link
              to={organizationPath(academy)}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex min-w-0 items-center gap-1 rounded-[4px] font-medium text-[#0054B4] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]"
            >
              <Building2 className="size-3 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span className="truncate">{academy}</span>
            </Link>
          ) : isMine ? (
            <BrandPill tone="green">Your coach</BrandPill>
          ) : (
            <span>Independent coach</span>
          )}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="h-[34px] w-full rounded-[8px] border border-[#6698D2] bg-[#0054B4] text-[14px] font-medium tracking-[-0.42px] text-[#F1F1E6] hover:bg-[#004390]"
        >
          View profile
        </button>
      </div>
    </article>
  );
};

const AllCoaches = () => {
  const navigate = useNavigate();
  const { profile, loading: profileLoading } = useProfile();
  const { user, userProfile } = useAuth();
  const { isAuthenticated, isAthleteLike } = useRole();
  // Coaches this family already trains with get a "Your coach" pill (ATH-96).
  const homeQuery = useQuery({ queryKey: ["athlete-home"], queryFn: () => athleteHomeAPI.get(), enabled: isAthleteLike });
  const myCoachIds = useMemo(() => new Set((homeQuery.data?.coaches ?? []).map((c) => c.id)), [homeQuery.data]);
  const { toast } = useToast();
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

  const [filteredCoaches, setFilteredCoaches] = useState<Coach[]>([]);

  const [loading, setLoading] = useState(true);
  const isLoadingSlow = useSlowLoading(loading, 8000);

  const [searchQuery, setSearchQuery] = useState("");

  const [selectedSport, setSelectedSport] = useState("All Sports");
  
  const [hasSetInitialSport, setHasSetInitialSport] = useState(false);

  const [selectedPillar, setSelectedPillar] = useState("All Pillars");
  const [selectedFavoritePosition, setSelectedFavoritePosition] = useState("All Positions");
  const [selectedPathway, setSelectedPathway] = useState("All Pathways");
  const [selectedSessionType, setSelectedSessionType] = useState(ALL_SESSION_TYPES);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState(ANY_AGE);
  // Organization pages link here with ?academy=<name>. The ref survives the automatic
  // filter reset that runs when the sport is set on load; any manual change clears it.
  const deepLinkAcademy = useRef<string | null>(searchParams.get("academy"));
  const [selectedAcademy, setSelectedAcademy] = useState(deepLinkAcademy.current ?? ALL_ACADEMIES);
  const chooseAcademy = (academy: string) => {
    deepLinkAcademy.current = null;
    setSelectedAcademy(academy);
  };
  // Apply ?academy= once, then drop it from the URL.
  useEffect(() => {
    const academy = searchParams.get("academy");
    if (!academy) return;
    deepLinkAcademy.current = academy;
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
  const [zipQuery, setZipQuery] = useState("");
  const [hasPrefilledZip, setHasPrefilledZip] = useState(false);

  const [sortBy, setSortBy] = useState("Highest Rated");

  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [allSpecialties, setAllSpecialties] = useState<string[]>([]);

  const [expandedCoaches, setExpandedCoaches] = useState<Set<string>>(
    new Set()
  );

  const [showPackagesModal, setShowPackagesModal] = useState(false);

  const [selectedCoachForPackages, setSelectedCoachForPackages] =
    useState<Coach | null>(null);

  const [serviceType, setServiceType] = useState<
    "consultation" | "session" | "Free Consultation"
  >("session");

  const [showFreeConsultInfo, setShowFreeConsultInfo] = useState(false);

  const [selectedCoachForFreeConsult, setSelectedCoachForFreeConsult] =
    useState<Coach | null>(null);

  const [chatCoach, setChatCoach] = useState<Coach | null>(null);
  const [chatConversationId, setChatConversationId] = useState<string | null>(null);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [sendingMessageFor, setSendingMessageFor] = useState<string | null>(null);

  const { role: personaType } = useRole();

  const sports = ["All Sports", "Soccer", "Rowing"];

  const { sportPillars: soccerSportPillars } = useSportPillars({
    sport: "soccer" as Enums<"sport_type">,
  });
  const { sportPillars: rowingSportPillars } = useSportPillars({
    sport: "rowing" as Enums<"sport_type">,
  });

  const soccerPillars = useMemo(
    () =>
      (soccerSportPillars ?? [])
        .map((pillar) => pillar.title)
        .filter((title): title is string => Boolean(title && title.trim())),
    [soccerSportPillars]
  );
  const rowingPillars = useMemo(
    () => {
      const order = [
        "Technical development",
        "Race preparation",
        "Mentorship",
        "Performance coaching",
        "Academic tutoring",
        "College recruiting",
      ];
      const titles = (rowingSportPillars ?? [])
        .map((pillar) => pillar.title)
        .filter((title): title is string => Boolean(title && title.trim()));
      return [...titles].sort((a, b) => {
        const aIndex = order.indexOf(a);
        const bIndex = order.indexOf(b);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    },
    [rowingSportPillars]
  );

  useEffect(() => {
    fetchCoaches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update selected sport when profile loads (only once on initial load)
  useEffect(() => {
    // Safety checks: ensure profile is loaded and we haven't set initial sport yet
    if (profileLoading || hasSetInitialSport) {
      return;
    }

    const normalizeSport = (value: string) => value.toLowerCase().trim();
    const selectSportIfKnown = (sportRaw: string | null | undefined) => {
      if (!sportRaw || typeof sportRaw !== "string" || !sportRaw.trim()) return false;
      const sport = normalizeSport(sportRaw);
      if (sport === "soccer" || sport === "scoccer" || sport === "football") {
        setSelectedSport("Soccer");
        setHasSetInitialSport(true);
        return true;
      }
      if (sport === "rowing" || sport === "crew") {
        setSelectedSport("Rowing");
        setHasSetInitialSport(true);
        return true;
      }
      return false;
    };

    // Try persona sport from userProfile first (covers coach/athlete/parent)
    if (profile?.userProfile) {
      const userSport = (profile.userProfile as any).sport || (profile.userProfile as any).sport_type;
      if (selectSportIfKnown(userSport)) {
        return;
      }
    }

    // Try coach profile specific field if present (sport or sport_type)
    if ((profile as any)?.coachProfile) {
      const coachSport = (profile as any).coachProfile?.sport || (profile as any).coachProfile?.sport_type;
      if (selectSportIfKnown(coachSport)) {
        return;
      }
    }

    // Fallback to legacy profile.data sport fields
    if (profile?.data) {
      const legacySport = (profile.data as any).sport || (profile.data as any).sport_type;
      if (selectSportIfKnown(legacySport)) {
        return;
      }
    }

    setHasSetInitialSport(true);
  }, [profile, profileLoading, hasSetInitialSport]);

  // Sort athletes' results near their own ZIP by default (once; they can edit or clear it).
  useEffect(() => {
    if (hasPrefilledZip || !userProfile) return;
    // US ZIPs only: stripping a postal code like "M5V 2T6" down to digits would sort by noise.
    const storedZip = (userProfile.zip_code || "").trim();
    const ownZip = /^\d{5}(-?\d{4})?$/.test(storedZip) ? storedZip.replace(/\D/g, "") : "";
    if (isAthleteLike && ownZip) setZipQuery((current) => current || ownZip);
    setHasPrefilledZip(true);
  }, [userProfile, isAthleteLike, hasPrefilledZip]);

  // Reset pillar when sport changes
  useEffect(() => {
    setSelectedPillar("All Pillars");
    setSelectedFavoritePosition("All Positions");
    setSelectedPathway("All Pathways");
    setSelectedAcademy(deepLinkAcademy.current ?? ALL_ACADEMIES);
  }, [selectedSport]);

  useEffect(() => {
    // Safety check: ensure coaches is an array
    if (!Array.isArray(coaches) || coaches.length === 0) {
      setFilteredCoaches([]);
      return;
    }

    let filtered = [...coaches];

    // Filter by search query
    if (searchQuery && searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase().trim();
      
      filtered = filtered.filter((coach) => {
        if (!coach) return false;
        
        // Check name
        if (coach.name && typeof coach.name === 'string' && 
            coach.name.toLowerCase().includes(query)) {
          return true;
        }
        
        // Check bio
        const plainTextBio = stripRichTextToPlainText(coach.bio);
        if (plainTextBio && plainTextBio.toLowerCase().includes(query)) {
          return true;
        }
        
        // Check locations
        if (Array.isArray(coach.locations) && coach.locations.length > 0) {
          if (coach.locations.some((location) => 
            location && typeof location === 'string' && 
            location.toLowerCase().includes(query)
          )) {
            return true;
          }
        }
        
        // Check specialties
        if (Array.isArray(coach.specialties) && coach.specialties.length > 0) {
          if (coach.specialties.some((specialty) => 
            specialty && typeof specialty === 'string' && 
            specialty.toLowerCase().includes(query)
          )) {
            return true;
          }
        }

        // Check academy / company
        if (coachAcademy(coach.company).toLowerCase().includes(query)) {
          return true;
        }

        // Check pathway tags
        if (Array.isArray(coach.pathway_tags) && coach.pathway_tags.length > 0) {
          if (coach.pathway_tags.some((tag) =>
            tag && typeof tag === "string" && tag.toLowerCase().includes(query)
          )) {
            return true;
          }
        }
        
        return false;
      });
    }

    // Filter by sport using sport_type (or sport) from API
    if (selectedSport && selectedSport !== "All Sports") {
      const targetSport = selectedSport.toLowerCase();
      filtered = filtered.filter((coach) => coach && getCoachSport(coach) === targetSport);
    }

    // Filter by pillar/specialty
    if (selectedPillar && selectedPillar !== "All Pillars") {
      filtered = filtered.filter((coach) => {
        if (!coach) return false;
        return Array.isArray(coach.specialties) && 
               coach.specialties.includes(selectedPillar);
      });
    }

    // Filter by pathway tag
    if (selectedPathway && selectedPathway !== "All Pathways") {
      filtered = filtered.filter((coach) => {
        if (!coach) return false;
        return Array.isArray(coach.pathway_tags) &&
          coach.pathway_tags.includes(selectedPathway);
      });
    }

    // Filter by session type: in person or virtual (ATH-96)
    if (selectedSessionType !== ALL_SESSION_TYPES) {
      filtered = filtered.filter((coach) =>
        (coach?.session_types ?? []).some((type) => type.toLowerCase().replace(/\s+/g, "-") === selectedSessionType)
      );
    }

    // Filter by age group: the coach's ages overlap it (ATH-96)
    if (selectedAgeGroup !== ANY_AGE) {
      filtered = filtered.filter((coach) => coach && matchesAgeGroup(coach, selectedAgeGroup));
    }

    // Filter by academy (coaches.company)
    if (selectedAcademy !== ALL_ACADEMIES) {
      filtered = filtered.filter((coach) => coach && matchesAcademy(coach.company, selectedAcademy));
    }

    // Filter by favorite position
    if (selectedFavoritePosition && selectedFavoritePosition !== "All Positions") {
      filtered = filtered.filter((coach) => {
        if (!coach) return false;
        const coachSport = getCoachSport(coach);
        const coachSportLabel = coachSport === "rowing" ? "Rowing" : "Soccer";
        const rawFavoritePositions =
          (coach as any)?.favourite_positions ?? (coach as any)?.favorite_positions ?? [];
        const parsedFavoritePositions = Array.isArray(rawFavoritePositions)
          ? rawFavoritePositions.filter((item) => Boolean(item && String(item).trim()))
          : typeof rawFavoritePositions === "string"
            ? rawFavoritePositions.split(",").map((item) => item.trim()).filter(Boolean)
            : [];
        const fallbackPositions = Array.isArray(coach.positions)
          ? coach.positions.filter((item) => Boolean(item && String(item).trim()))
          : [];
        const favoritePositions =
          parsedFavoritePositions.length > 0 ? parsedFavoritePositions : fallbackPositions;
        return favoritePositions.some((position) =>
          normalizePosition(coachSportLabel, position) === selectedFavoritePosition
        );
      });
    }

    const trimmedZip = zipQuery.replace(/\D/g, "").trim();

    // Apply sorting with safety checks
    filtered.sort((a, b) => {
      // Safety check: ensure both coaches exist
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;

      // When zip is entered, soft-sort by proximity first
      if (trimmedZip) {
        const zipDiff =
          zipProximityRank(a.zip_code, trimmedZip) -
          zipProximityRank(b.zip_code, trimmedZip);
        if (zipDiff !== 0) return zipDiff;
      }
      
      const sportA = getCoachSport(a);
      const sportB = getCoachSport(b);

      // Group by sport first (Soccer, then Rowing, then others)
      if (sportA === "soccer" && sportB !== "soccer") return -1;
      if (sportA !== "soccer" && sportB === "soccer") return 1;
      if (sportA === "rowing" && sportB !== "rowing" && sportB !== "soccer") return -1;
      if (sportA !== "rowing" && sportA !== "soccer" && sportB === "rowing") return 1;

      // Within the same sport group, apply the selected sort
      if (sportA === sportB) {
        switch (sortBy) {
          case "Highest Rated":
            return (b.rating || 0) - (a.rating || 0);

          case "Lowest Rated":
            return (a.rating || 0) - (b.rating || 0);

          default: {
            // Safety check for name comparison
            const nameA = a.name || '';
            const nameB = b.name || '';
            return nameA.localeCompare(nameB);
          }
        }
      }

      return 0;
    });

    setFilteredCoaches(filtered);
  }, [
    coaches,

    searchQuery,

    selectedSport,

    selectedPillar,

    selectedFavoritePosition,

    selectedPathway,

    selectedSessionType,

    selectedAgeGroup,

    selectedAcademy,

    zipQuery,

    sortBy,
  ]);

  const fetchCoaches = async () => {
    try {
      const { data, error } = await supabase.rpc("get_coaches_public");

      if (error) {
        console.error("Error fetching coaches:", error);
        setLoading(false);
        return;
      }
      
      // Safety check: ensure data is an array
      if (!data || !Array.isArray(data)) {
        console.warn("No coaches data returned");
        setCoaches([]);
        setFilteredCoaches([]);
        setLoading(false);
        return;
      }

      // Map coach_position to position for compatibility
      const orgs = await organizationsAPI.listPublic().catch(() => [] as PublicOrganization[]);
      setPublicOrgs(orgs);
      const mappedCoaches = applyOrganizations(
        data.map((coach) => ({
          ...coach,
          position: coach?.coach_position || null,
          // Map positions to favourite_positions for compatibility with CoachCard
          favourite_positions: coach.positions || []
        })),
        orgs
      );

      setCoaches(mappedCoaches);
      setFilteredCoaches(mappedCoaches);

      // Extract unique specialties from all coaches with safety checks
      const specialtiesSet = new Set<string>();
      data.forEach((coach) => {
        if (coach && Array.isArray(coach.specialties)) {
          coach.specialties.forEach((specialty) => {
            if (specialty && typeof specialty === 'string' && specialty.trim()) {
              specialtiesSet.add(specialty);
            }
          });
        }
      });

      setAllSpecialties([
        "All Pillars",
        ...Array.from(specialtiesSet).sort(),
      ]);

    } catch (error) {
      console.error("Failed to fetch coaches:", error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to determine coach sport

  // Helper function to check if coach should appear in rowing category
  const isRowingCoach = (coach: Coach) => getCoachSport(coach) === "rowing";

  // Get available pillars based on selected sport

  const getAvailablePillars = () => {

    if (selectedSport === "Soccer") {
      return ["All Pillars", ...soccerPillars];
    } else if (selectedSport === "Rowing") {
      return ["All Pillars", ...rowingPillars];
    }

    const combined = Array.from(new Set([...soccerPillars, ...rowingPillars]));
    return ["All Pillars", ...combined];
  };

  // Helper function to get sport-specific card styling

  const handleBookSession = (
    coach: Coach,

    type: "consultation" | "session" | "Free Consultation"
  ) => {
    setSelectedCoach(coach);

    setServiceType(type);

    setIsModalOpen(true);
  };

  const handleFreeConsultClick = (coach: Coach) => {
    setSelectedCoachForFreeConsult(coach);

    setShowFreeConsultInfo(true);
  };

  const handleFreeConsultContinue = () => {
    setShowFreeConsultInfo(false);

    if (selectedCoachForFreeConsult) {
      handleBookSession(selectedCoachForFreeConsult, "Free Consultation");
    }
  };

  const handleCloseFreeConsultInfo = () => {
    setShowFreeConsultInfo(false);

    setSelectedCoachForFreeConsult(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);

    setSelectedCoach(null);
  };

  const handleOpenPackages = (coach: Coach) => {
    setSelectedCoachForPackages(coach);

    setShowPackagesModal(true);
  };

  const handleClosePackages = () => {
    setShowPackagesModal(false);

    setSelectedCoachForPackages(null);
  };

  const getAvailableFavoritePositions = () => {
    if (selectedSport === "Soccer") {
      const sportOption = SPORTS_OPTIONS.find((option) => option.value === "Soccer");
      return [
        "All Positions",
        ...(sportOption?.positions.map((position) => position.value) ?? []),
      ];
    }
    if (selectedSport === "Rowing") {
      const sportOption = SPORTS_OPTIONS.find((option) => option.value === "Rowing");
      return [
        "All Positions",
        ...(sportOption?.positions.map((position) => position.value) ?? []),
      ];
    }
    const allPositions = SPORTS_OPTIONS.flatMap((option) =>
      option.positions.map((position) => position.value)
    );
    return ["All Positions", ...Array.from(new Set(allPositions))];
  };

  const normalizeCoachForChat = (coach: Coach): Coach => ({
    ...coach,
    positions: coach.positions || (coach.coach_position ? [coach.coach_position] : undefined),
    coach_position: coach.coach_position || (Array.isArray(coach.positions) ? coach.positions[0] : undefined) || undefined,
    specialties: coach.specialties || [],
    image_url: (coach as any).image_url || (coach as any).profile_image_url || undefined,
    hourly_rate: coach.hourly_rate || undefined,
  });

  const handleSendMessage = async (coach: Coach) => {
    if (!coach?.id) return;
    if (personaType === "coach") {
      toast({
        title: "Coach to Coach messaging is not currently available.",
      });
      return;
    }
    if (!user) {
      navigate("/auth?mode=signin");
      return;
    }

    try {
      setSendingMessageFor(coach.id);

      const { data: coachProfile, error: coachProfileError } = await chatAPI.getCoachUserProfile(coach.id);
      if (coachProfileError || !coachProfile?.id) {
        throw coachProfileError || new Error("Coach profile not found");
      }

      const coachUserId = coachProfile.id;
      const { data: existingConversation, error: existingError } = await chatAPI.findConversationBetweenUsers(
        user.id,
        coachUserId
      );
      if (existingError) throw existingError;

      let conversationId = existingConversation?.id || null;

      if (!conversationId) {
        const newConversationId = buildId();
        const nowIso = new Date().toISOString();
        const { error: conversationError } = await chatAPI.createConversation({
          id: newConversationId,
          created_by: user.id,
          last_message_at: nowIso,
          title: coach.name,
          is_group: false,
        });

        if (conversationError) {
          throw conversationError;
        }

        conversationId = newConversationId;

        const { error: participantsError } = await chatAPI.addParticipants([
          { conversation_id: conversationId, user_id: user.id, role: "owner" },
          { conversation_id: conversationId, user_id: coachUserId, role: "member" },
        ]);

        if (participantsError) {
          throw participantsError;
        }
      }

      setChatCoach(normalizeCoachForChat(coach));
      setChatConversationId(conversationId);
      setShowChatPanel(true);
    } catch (err) {
      console.error("Failed to start chat", err);
      toast({
        title: "Unable to open chat",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setSendingMessageFor(null);
    }
  };

  const onViewProfile = (coachId: string) => {
    navigate(`/coach/${coachId}`);
  };

  const onSession = (coachId: string) => {
    navigate(`/coach/${coachId}`, { state: { scrollToAvailability: true } });
  };

  const onViewPackages = (coachId: string) => {
    navigate(`/coach/${coachId}`, { state: { scrollToPackages: true } });
  };

  const { data: packages = [] } = useCoachPackages(
    selectedCoachForPackages?.id
  );

  const formatList = (items: string[]) => {
    if (items.length <= 1) return items[0] || "";
    if (items.length === 2) return items.join(" & ");
    const allButLast = items.slice(0, -1).join(", ");
    const last = items[items.length - 1];
    return `${allButLast} & ${last}`;
  };

  const verifiedCoachesCount = useMemo(
    () => coaches.filter((coach) => coach?.is_verified).length,
    [coaches]
  );

  const coachingPillars = useMemo(() => {
    const uniquePillars = new Set<string>();
    coaches.forEach((coach) => {
      if (coach && Array.isArray(coach.specialties)) {
        coach.specialties.forEach((pillar) => {
          if (pillar && typeof pillar === "string" && pillar.trim()) {
            uniquePillars.add(pillar);
          }
        });
      }
    });
    return Array.from(uniquePillars);
  }, [coaches]);

  const coachingPillarCount = coachingPillars.length;

  useEffect(() => {
    if (!Array.isArray(coaches)) return;
  }, [coaches, coachingPillarCount, coachingPillars]);

  const { sportCount, sportLabel } = useMemo(() => {
    const sportsSet = new Set<string>();
    coaches.forEach((coach) => {
      const sport = getCoachSport(coach);
      if (sport) {
        sportsSet.add(sport);
      }
    });

    const sportList = Array.from(sportsSet).filter(Boolean);
    const formattedList = sportList.map(
      (sport) => sport.charAt(0).toUpperCase() + sport.slice(1)
    );

    return {
      sportCount: sportList.length,
      sportLabel: formattedList.length
        ? `Sports: ${formatList(formattedList)}`
        : "Sports",
    };
  }, [coaches]);

  if (loading) {
    return (
      <div className={isAuthenticated ? "flex min-h-[50vh] items-center justify-center px-4" : "flex min-h-screen items-center justify-center bg-[#F1F1E6] px-4"}>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="size-10 animate-spin rounded-full border-2 border-[#EAEADF] border-t-[#0054B4]" />
          <p className="text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">Loading coaches</p>
          {isLoadingSlow && (
            <p className="max-w-[320px] text-[12px] leading-[16px] tracking-[-0.03em] text-[#767980]">
              This is taking longer than usual. Hang on while we fetch the latest profiles.
            </p>
          )}
        </div>
      </div>
    );
  }

  const filterTriggerClass =
    "!h-auto w-full !rounded-[8px] !border-[#EAEADF] !bg-[#F7F7F0] !px-[10px] !py-[10px] !text-[12px] !font-normal !leading-[14px] !tracking-[-0.36px] shadow-none focus:!ring-0 focus:!ring-offset-0 [&>svg]:!size-4 [&>svg]:!opacity-100 [&>svg]:!text-[#767980]";
  // Academies offered for the chosen sport, so the list stays relevant after switching sport.
  const academyOptions = getAcademyOptions(
    selectedSport === "All Sports"
      ? coaches
      : coaches.filter((coach) => coach && getCoachSport(coach) === selectedSport.toLowerCase())
  );

  const showOrganizations = directoryView === "organizations";
  // Same search and filters in both views: an organization is listed when any of its
  // coaches matches, while its card describes the whole organization.
  const matchingAcademies = new Set(filteredCoaches.map((coach) => academySlug(coach?.company)));
  const organizations = buildOrganizations(coaches, getCoachSport).filter((org) => matchingAcademies.has(org.slug));
  const viewCounts: Record<DirectoryView, number> = {
    coaches: filteredCoaches.length,
    organizations: organizations.length,
  };

  const filterLabel = (value: string) => {
    switch (value) {
      case "All Sports":
        return "All sports";
      case "All Pillars":
        return "All pillars";
      case "All Positions":
        return "All positions";
      case "All Pathways":
        return "All pathways";
      case ALL_SESSION_TYPES:
        return "In person or virtual";
      case ANY_AGE:
        return "Any age";
      case "in-person":
        return "In person";
      case "virtual":
        return "Virtual";
      case ALL_ACADEMIES:
        return "All academies";
      case "Highest Rated":
        return "Highest rated";
      case "Lowest Rated":
        return "Lowest rated";
      default:
        return value;
    }
  };
  const isDefaultFilter = (value: string) =>
    ["All Sports", "All Pillars", "All Positions", "All Pathways", ALL_SESSION_TYPES, ANY_AGE, ALL_ACADEMIES, "Highest Rated"].includes(value);
  const triggerClass = (value: string, width: string) =>
    `${filterTriggerClass} ${isAuthenticated ? "" : width} ${isDefaultFilter(value) ? "!text-[#767980]" : "!text-[#1A202C]"}`;
  const zipDigits = zipQuery.replace(/\D/g, "");
  const coachCountLabel = showOrganizations
    ? `${organizations.length} ${organizations.length === 1 ? "organization" : "organizations"} found`
    : `${filteredCoaches.length} ${filteredCoaches.length === 1 ? "coach" : "coaches"} found${zipDigits ? ` · closest to ZIP ${zipDigits} first` : ""}`;
  const heroStats = [
    { value: verifiedCoachesCount.toLocaleString(), label: "Verified coaches" },
    { value: String(sportCount), label: sportLabel },
    { value: coachingPillarCount.toLocaleString(), label: "Coaching pillars" },
  ];

  return (
    <div className={isAuthenticated ? "overflow-x-hidden px-4 pb-16 md:px-10" : "min-h-screen bg-[#F1F1E6] font-sans"}>
      {isAuthenticated ? (
        <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-[10px]">
          <h1 className="text-[32px] font-bold leading-[28px] tracking-[-1.6px] text-[#1A202C]">
            Browse coaches
          </h1>
          <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#767980]">
            Find your perfect coaching match
          </p>
        </div>
      ) : (
        <section className="mt-[3.8rem] border-b border-[#EAEADF] px-4 pb-12 pt-14 md:pb-16 md:pt-20">
          <div className="mx-auto flex max-w-[1000px] flex-col items-center gap-[30px] text-center">
            <div className="flex flex-col items-center gap-[15px]">
              <span className="rounded-[4px] border border-[#CCDDF0] bg-[#E5EDF7] px-2 py-1 text-[12px] font-medium leading-[13px] tracking-[-0.03em] text-[#0054B4]">
                Coach directory
              </span>
              <h1 className="max-w-[720px] text-[36px] font-bold leading-[38px] tracking-[-0.05em] text-[#1A202C] md:text-[48px] md:leading-[50px]">
                Discover your coach in our growing directory
              </h1>
              <p className="max-w-[640px] text-[16px] leading-[22px] tracking-[-0.03em] text-[#484D56]">
                Every AthaNext coach has a searchable profile. Explore their experience, compare
                specialties, and find the right fit for your goals.
              </p>
            </div>

            <div className="grid w-full max-w-[760px] grid-cols-1 gap-[10px] sm:grid-cols-3">
              {heroStats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center gap-[6px] rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] pb-[25px] pt-[30px]"
                >
                  <span className="text-[32px] font-bold leading-[30px] tracking-[-0.03em] text-[#1A202C]">
                    {stat.value}
                  </span>
                  <span className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">{stat.label}</span>
                </div>
              ))}
            </div>

            <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
              Use the filters below to narrow coaches by sport, pillar, or position.
            </p>
          </div>
        </section>
      )}

      {/* Search and Filters Header */}

      <div className={isAuthenticated ? "mx-auto mt-6 w-full max-w-[1000px]" : "px-4 pt-10"}>
        <div className={isAuthenticated ? "" : "mx-auto max-w-[1000px]"}>
          {!isAuthenticated && (
            <div className="mb-5 flex flex-col gap-[10px]">
              <h2 className="text-[24px] font-semibold leading-[30px] tracking-[-0.05em] text-[#1A202C]">
                Browse coaches
              </h2>
              <p className="text-[16px] leading-[18px] tracking-[-0.03em] text-[#767980]">
                Find your perfect coaching match
              </p>
            </div>
          )}

          <div
            role="tablist"
            aria-label="Directory view"
            className="mb-[10px] inline-flex gap-[2px] rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] p-[3px]"
          >
            {DIRECTORY_VIEWS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={directoryView === value}
                onClick={() => setDirectoryView(value)}
                className={
                  "inline-flex h-[30px] items-center gap-[6px] rounded-[6px] px-[14px] text-[14px] font-medium tracking-[-0.03em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2] " +
                  (directoryView === value ? "bg-[#0054B4] text-[#F1F1E6]" : "text-[#767980] hover:text-[#1A202C]")
                }
              >
                <Icon className="size-4" strokeWidth={1.5} aria-hidden="true" />
                {label}
                <span
                  className={
                    "rounded-[4px] px-[6px] py-px text-[12px] font-medium " +
                    (directoryView === value ? "bg-[#004390] text-[#F1F1E6]" : "bg-[#F1F1E6] text-[#484D56]")
                  }
                >
                  {viewCounts[value]}
                </span>
              </button>
            ))}
          </div>

          {/* Search and Filters */}

          <div className="flex flex-col gap-[10px] lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-[10px] rounded-[8px] border border-[#EAEADF] bg-[#F7F7F0] p-[10px] focus-within:ring-2 focus-within:ring-[#6698D2]">
              <Search className="size-4 shrink-0 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  showOrganizations
                    ? "Search organizations"
                    : isAuthenticated
                      ? "Search coaches"
                      : "Search coaches, specialties, locations"
                }
                aria-label={showOrganizations ? "Search organizations" : "Search coaches"}
                className="w-full bg-transparent text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#1A202C] outline-none placeholder:text-[#767980]"
              />
            </div>

            <div className="flex min-w-0 items-center gap-[10px] rounded-[8px] border border-[#EAEADF] bg-[#F7F7F0] p-[10px] focus-within:ring-2 focus-within:ring-[#6698D2] lg:w-[140px]">
              <input
                value={zipQuery}
                onChange={(e) => setZipQuery(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
                placeholder="ZIP"
                inputMode="numeric"
                aria-label="Sort by ZIP code"
                title="Coaches closest to this ZIP are shown first"
                className="w-full bg-transparent text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#1A202C] outline-none placeholder:text-[#767980]"
              />
            </div>

            <div className={isAuthenticated ? "grid min-w-0 flex-1 grid-cols-1 gap-[10px] sm:grid-cols-2 " + (academyOptions.length > 0 ? "lg:grid-cols-5" : "lg:grid-cols-4") : "grid min-w-0 grid-cols-1 gap-[10px] sm:grid-cols-2 lg:flex lg:flex-none"}>
              {!isAuthenticated && (
                <Select
                  value={selectedSport}
                  onValueChange={(sport) => {
                    deepLinkAcademy.current = null;
                    setSelectedSport(sport);
                  }}
                >
                  <SelectTrigger className={triggerClass(selectedSport, "lg:!w-[130px]")} aria-label="Sport">
                    <SelectValue placeholder="Sport">{filterLabel(selectedSport)}</SelectValue>
                  </SelectTrigger>

                  <SelectContent className="z-50">
                    {sports.map((sport, index) => (
                      <SelectItem key={index} value={sport}>
                        {filterLabel(sport)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={selectedPillar} onValueChange={setSelectedPillar}>
                <SelectTrigger className={triggerClass(selectedPillar, "lg:!w-[160px]")} aria-label="Coaching pillar">
                  <SelectValue>{filterLabel(selectedPillar)}</SelectValue>
                </SelectTrigger>

                <SelectContent className="z-50">
                  {getAvailablePillars().map((pillar) => (
                    <SelectItem key={pillar} value={pillar}>
                      {filterLabel(pillar)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedPathway} onValueChange={setSelectedPathway}>
                <SelectTrigger className={triggerClass(selectedPathway, "lg:!w-[160px]")} aria-label="Pathway">
                  <SelectValue>{filterLabel(selectedPathway)}</SelectValue>
                </SelectTrigger>
                <SelectContent className="z-50">
                  <SelectItem value="All Pathways">{filterLabel("All Pathways")}</SelectItem>
                  {PATHWAY_TAGS.map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedAgeGroup} onValueChange={setSelectedAgeGroup}>
                <SelectTrigger className={triggerClass(selectedAgeGroup, "lg:!w-[150px]")} aria-label="Age group">
                  <SelectValue>{filterLabel(selectedAgeGroup)}</SelectValue>
                </SelectTrigger>
                <SelectContent className="z-50">
                  {[ANY_AGE, ...AGE_GROUPS.map((g) => g.label)].map((group) => (
                    <SelectItem key={group} value={group}>
                      {filterLabel(group)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedSessionType} onValueChange={setSelectedSessionType}>
                <SelectTrigger className={triggerClass(selectedSessionType, "lg:!w-[170px]")} aria-label="Session type">
                  <SelectValue>{filterLabel(selectedSessionType)}</SelectValue>
                </SelectTrigger>
                <SelectContent className="z-50">
                  {[ALL_SESSION_TYPES, "in-person", "virtual"].map((type) => (
                    <SelectItem key={type} value={type}>
                      {filterLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {academyOptions.length > 0 && (
                <Select value={selectedAcademy} onValueChange={chooseAcademy}>
                  <SelectTrigger className={triggerClass(selectedAcademy, "lg:!w-[160px]")} aria-label="Academy">
                    <SelectValue>{filterLabel(selectedAcademy)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="z-50">
                    <SelectItem value={ALL_ACADEMIES}>{filterLabel(ALL_ACADEMIES)}</SelectItem>
                    {academyOptions.map((academy) => (
                      <SelectItem key={academy} value={academy}>
                        {academy}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={selectedFavoritePosition} onValueChange={setSelectedFavoritePosition}>
                <SelectTrigger className={triggerClass(selectedFavoritePosition, "lg:!w-[170px]")} aria-label="Favorite position">
                  <SelectValue placeholder="Favorite position">{filterLabel(selectedFavoritePosition)}</SelectValue>
                </SelectTrigger>

                <SelectContent className="z-50">
                  {getAvailableFavoritePositions().map((position) => (
                    <SelectItem key={position} value={position}>
                      {filterLabel(position)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className={triggerClass(sortBy, "lg:!w-[150px]")} aria-label="Sort coaches">
                  <SelectValue>{filterLabel(sortBy)}</SelectValue>
                </SelectTrigger>

                <SelectContent className="z-50">
                  <SelectItem value="Highest Rated">Highest rated</SelectItem>
                  {!isAuthenticated && (
                    <SelectItem value="Lowest Rated">Lowest rated</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <section className={isAuthenticated ? "mx-auto mt-6 w-full max-w-[1000px]" : "w-full px-4 pb-16 pt-6"}>
        <div className={isAuthenticated ? "" : "mx-auto max-w-8xl"}>

          <p className={isAuthenticated ? "mb-6 text-[14px] font-normal tracking-[-0.7px] text-[#767980]" : "mx-auto mb-6 max-w-[1000px] text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]"}>
            {coachCountLabel}
            {!showOrganizations && selectedAcademy !== ALL_ACADEMIES ? (
              <span className="ml-2 text-[12px] text-[#A3A6AB]">
                Showing coaches at{" "}
                <Link to={organizationPath(selectedAcademy)} className="text-[#0054B4] hover:underline">
                  {selectedAcademy}
                </Link>
                .{" "}
                <button
                  type="button"
                  onClick={() => chooseAcademy(ALL_ACADEMIES)}
                  className="text-[#0054B4] hover:underline"
                >
                  Show all
                </button>
              </span>
            ) : null}
          </p>

          {showOrganizations ? (
            organizations.length === 0 ? (
              <div className="mx-auto flex max-w-[1000px] flex-col items-center gap-[6px] rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] pb-[25px] pt-[30px] text-center">
                <p className="text-[20px] font-medium leading-[24px] tracking-[-0.05em] text-[#1A202C]">
                  No organizations found
                </p>
                <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
                  Organizations appear here once their coaches list an academy or club on their profile.
                </p>
              </div>
            ) : (
              <div className={isAuthenticated ? "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" : "mx-auto grid max-w-[1000px] grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"}>
                {organizations.map((organization) => (
                  <OrganizationCard
                    key={organization.name}
                    organization={organization}
                    page={findOrganization(publicOrgs, organization.slug)}
                    partners={organizationPartners(organization.coachIds, brandsByCoach, 3)}
                  />
                ))}
              </div>
            )
          ) : filteredCoaches.length === 0 ? (
            <div className="mx-auto flex max-w-[1000px] flex-col items-center gap-[15px] rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] pb-[25px] pt-[30px] text-center">
              <span className="inline-flex size-10 items-center justify-center rounded-[8px] bg-[#F4F4EB] text-[#767980]" aria-hidden="true">
                <Search className="size-5" strokeWidth={1.5} />
              </span>
              <div className="flex flex-col gap-[6px]">
                <p className="text-[20px] font-medium leading-[24px] tracking-[-0.05em] text-[#1A202C]">
                  No coaches match your filters
                </p>
                <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
                  Try a different search or clear the filters to see every coach.
                </p>
              </div>
              <Button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedSport("All Sports");
                  setSelectedPillar("All Pillars");
                  setSelectedFavoritePosition("All Positions");
                  setSelectedPathway("All Pathways");
                  setSelectedSessionType(ALL_SESSION_TYPES);
                  setSelectedAgeGroup(ANY_AGE);
                  chooseAcademy(ALL_ACADEMIES);
                  setZipQuery("");
                  setSortBy("Highest Rated");
                }}
                variant="outline"
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className={isAuthenticated ? "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"}>
              {filteredCoaches.map((coach) => {
                if (isAuthenticated) {
                  return (
                    <AthleteBrowseCard
                      key={coach.id}
                      coach={coach}
                      sport={getCoachSport(coach)}
                      isMine={myCoachIds.has(coach.id)}
                      onOpen={() => onViewProfile(coach.id)}
                    />
                  );
                }
                return (
                  <CoachCard
                    key={coach.id}
                    coach={coach}
                    onViewProfile={onViewProfile}
                    onSession={onSession}
                    onViewPackages={() => onViewPackages(coach.id)}
                    onSendMessage={handleSendMessage}
                    disableSendMessage={false}
                    isSendingMessage={sendingMessageFor === coach.id}
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Coach Scheduling Modal */}

      {selectedCoach && (
        <CoachSchedulingModal
          coach={selectedCoach}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          serviceType={serviceType}
        />
      )}

      {/* Packages Modal */}

      {selectedCoachForPackages && (
        <PackagesModal
          isOpen={showPackagesModal}
          onClose={handleClosePackages}
          packages={packages}
          coachName={selectedCoachForPackages.name}
        />
      )}

      {/* Free Consultation Info Dialog */}

      {selectedCoachForFreeConsult && (
        <FreeConsultationInfoDialog
          isOpen={showFreeConsultInfo}
          onClose={handleCloseFreeConsultInfo}
          onContinue={handleFreeConsultContinue}
          coachId={selectedCoachForFreeConsult.id}
          coachName={selectedCoachForFreeConsult.name}
          hourlyRate={selectedCoachForFreeConsult.hourly_rate}
        />
      )}

      {showChatPanel && chatCoach && (
        <CoachChatPanel
          coach={chatCoach}
          conversationId={chatConversationId ?? undefined}
          onClose={() => setShowChatPanel(false)}
        />
      )}
    </div>
  );
};

export default AllCoaches;
