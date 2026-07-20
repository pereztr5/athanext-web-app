import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { strings } from "@/config/strings";
import starIcon from "../assets/images/star.png";
import footballIcon from "../assets/images/colored-soccer.png";
import rowerIcon from "../assets/images/colored-rowing.png";
import CoachCard from "@/components/coach/CoachCard";
import CoachChatPanel from "@/components/chat/CoachChatPanel";
import { chatAPI } from "@/api";
import { buildId } from "@/utils/chatHelpers";
import { SPORTS_OPTIONS, normalizePosition } from "@/utils/db";
import { useSportPillars } from "@/hooks/useSportPillars";
import type { Enums } from "@/integrations/supabase/types";
import { useSlowLoading } from "@/hooks/useSlowLoading";
import { stripRichTextToPlainText } from "@/utils/richText";

// Public coach type without email for privacy

type Coach = Omit<Tables<"coaches">, "email"> & {
  is_verified?: boolean;
  favourite_positions?: string[];
};

const AllCoaches = () => {
  const navigate = useNavigate();
  const { profile, loading: profileLoading } = useProfile();
  const { user, userProfile } = useAuth();
  const { toast } = useToast();

  const [coaches, setCoaches] = useState<Coach[]>([]);

  const [filteredCoaches, setFilteredCoaches] = useState<Coach[]>([]);

  const [loading, setLoading] = useState(true);
  const isLoadingSlow = useSlowLoading(loading, 8000);

  const [searchQuery, setSearchQuery] = useState("");

  const [selectedSport, setSelectedSport] = useState("All Sports");
  
  const [hasSetInitialSport, setHasSetInitialSport] = useState(false);

  const [selectedPillar, setSelectedPillar] = useState("All Pillars");
  const [selectedFavoritePosition, setSelectedFavoritePosition] = useState("All Positions");

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

  const personaType =
    (userProfile as any)?.persona_type || (user?.user_metadata as any)?.persona_type || null;

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
        "Technical Development",
        "Race Preparation",
        "Mentorship",
        "Strength + Conditioning",
        "Academic Tutoring",
        "College Recruiting",
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

  // Reset pillar when sport changes
  useEffect(() => {
    setSelectedPillar("All Pillars");
    setSelectedFavoritePosition("All Positions");
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

    // Apply sorting with safety checks
    filtered.sort((a, b) => {
      // Safety check: ensure both coaches exist
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      
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
      const mappedCoaches = data.map((coach) => ({
        ...coach,
        position: coach?.coach_position || null,
        // Map positions to favourite_positions for compatibility with CoachCard
        favourite_positions: coach.positions || []
      }));

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
  const getCoachSport = (coach: Coach) => {
    if (!coach) return "soccer";

    const rawSport = (coach as any).sport_type || (coach as any).sport;
    if (typeof rawSport === "string") {
      const normalized = rawSport.toLowerCase().trim();
      if (normalized.includes("row")) return "rowing";
      if (normalized.includes("soc") || normalized.includes("foot")) return "soccer";
    }

    // Fallback to derived cues
    const positions = Array.isArray(coach.positions)
      ? coach.positions.map((p) => String(p).toLowerCase())
      : [];
    const sessionTypes = Array.isArray(coach.session_types)
      ? coach.session_types.map((s) => String(s).toLowerCase())
      : [];
    const specialties = Array.isArray(coach.specialties)
      ? coach.specialties.map((s) => String(s).toLowerCase())
      : [];

    const hasRowingPosition =
      positions.includes("rower") || positions.includes("coxswain");
    const hasRowingSession = sessionTypes.some((s) => s.includes("rowing"));
    const hasRowingSpecialty = specialties.some((s) => s.includes("rowing"));

    if (hasRowingPosition || hasRowingSession || hasRowingSpecialty) {
      return "rowing";
    }

    return "soccer";
  };

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

  const getCardStyling = (sport: string) => {
    switch (sport) {
      case "soccer":
        return {
          card: "hover:shadow-xl transition-all duration-300 hover:-translate-y-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 cursor-pointer",

          header: "bg-blue-500 text-white",

          avatar: "bg-blue-500 text-white",

          button:
            "bg-blue-600 hover:bg-blue-700 text-white group-hover:scale-105 transition-transform",

          price: "text-blue-600 dark:text-blue-400",
        };

      case "rowing":
        return {
          card: "hover:shadow-xl transition-all duration-300 hover:-translate-y-2 bg-gradient-to-br from-red-50 to-gray-50 dark:from-red-900/20 dark:to-gray-900/20 border-red-200 dark:border-red-800 cursor-pointer",

          header: "bg-gradient-to-r from-red-600 to-gray-800 text-white",

          avatar: "bg-gradient-to-br from-red-600 to-gray-800 text-white",

          button:
            "bg-gradient-to-r from-red-600 to-gray-800 hover:from-red-700 hover:to-gray-900 text-white group-hover:scale-105 transition-transform",

          price: "text-red-600 dark:text-red-400",
        };

      default:
        return {
          card: "hover:shadow-xl transition-all duration-300 hover:-translate-y-2 cursor-pointer",

          header: "bg-primary text-white",

          avatar: "bg-primary text-primary-foreground",

          button:
            "bg-blue-600 hover:bg-blue-700 text-white group-hover:scale-105 transition-transform",

          price: "text-blue-600",
        };
    }
  };

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
    console.info("[Coaching Pillars] Derived from coach.specialties", {
      coachCount: coaches.length,
      pillarCount: coachingPillarCount,
      pillars: coachingPillars,
    });
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
        ? `Sports Today — ${formatList(formattedList)}`
        : "Sports Today — Updating...",
    };
  }, [coaches]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>

          <p className="text-muted-foreground">Loading coaches...</p>
          {isLoadingSlow && (
            <p className="mt-2 text-xs text-muted-foreground">
              This is taking longer than usual. Please wait while we fetch data.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background mt-[3.8rem]">
      {/* Hero Section */}

      <div className="relative overflow-hidden bg-gradient-to-br from-blue-100/40 via-blue-50/30 to-slate-100/20 dark:from-blue-900/40 dark:via-blue-800/30 dark:to-slate-900/20 px-4 py-16 border-b border-primary/20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.15),transparent_50%)]" />

        <div className="relative max-w-8xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-slate-800 dark:text-slate-200">
              Discover Your{" "}
            </span>

            <span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
              Coach
            </span>

            <span className="text-slate-800 dark:text-slate-200">
              {" "}
              in Our Growing Database
            </span>
          </h1>

          <p className="text-lg text-slate-700 dark:text-slate-300 max-w-3xl mx-auto mb-8">
            The AthaNext platform is built around a comprehensive coach
            database—verified, searchable, and tailored to athletes like you.
            With just a few clicks, you can explore profiles, compare
            specialties, and find the perfect fit for your goals.
          </p>

          {/* Database Highlights */}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 max-w-4xl mx-auto">
            <Card className="border border-primary/20 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent mb-1">
                  {verifiedCoachesCount.toLocaleString()}
                </div>

                <div className="text-sm text-muted-foreground font-medium">
                  Verified Coaches
                </div>
              </CardContent>
            </Card>

            <Card className="border border-primary/20 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent mb-1">
                  {sportCount}
                </div>

                <div className="text-sm text-muted-foreground font-medium">
                  {sportLabel}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-primary/20 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent mb-1">
                  {coachingPillarCount.toLocaleString()}
                </div>

                <div className="text-sm text-muted-foreground font-medium">
                  Coaching Pillars
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Guide */}

          <p className="text-sm text-slate-600 dark:text-slate-400">
            Use the filters below to search by sport, position, specialty, or
            price and discover the right coach for your next step.
          </p>
        </div>
      </div>

      {/* Search and Filters Header */}

      <div className="!bg-background px-4 py-8">
        <div className="max-w-8xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground">
              {strings.coach.allSportCoaches}
            </h1>

            <p className="text-muted-foreground mt-1">
              {strings.coach.findYourPerfectMatch}
            </p>
          </div>

          {/* Search and Filters */}

          <div className="flex flex-col md:flex-row gap-4 items-start">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />

              <Input
                placeholder={strings.coach.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 !rounded-[10px] focus-visible:ring-offset-0 focus-visible:!ring-0 focus-visible:!outline-none focus:ring-0"
              />
            </div>

            <div className="flex gap-2 flex-wrap items-start w-full md:w-auto">
              <Select value={selectedSport} onValueChange={setSelectedSport}>
                <SelectTrigger className="w-[120px] !rounded-[10px] focus:ring-offset-0 focus-visible:!ring-0 focus-visible:!outline-none focus:ring-0">
                  <SelectValue placeholder={strings.coach.sport} />
                </SelectTrigger>

                <SelectContent className="border border-border shadow-lg z-50 ">
                  {sports.map((sport, index) => (
                    <SelectItem key={index} value={sport}>
                      {sport}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedPillar} onValueChange={setSelectedPillar}>
                <SelectTrigger className="w-[150px] !rounded-[10px] focus:ring-offset-0 focus-visible:!ring-0 focus-visible:!outline-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent className="bg-background border border-border shadow-lg z-50">
                  {getAvailablePillars().map((pillar) => (
                    <SelectItem key={pillar} value={pillar}>
                      {pillar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedFavoritePosition} onValueChange={setSelectedFavoritePosition}>
                <SelectTrigger className="w-[170px] !rounded-[10px] focus:ring-offset-0 focus-visible:!ring-0 focus-visible:!outline-none focus:ring-0">
                  <SelectValue placeholder="Favorite Position" />
                </SelectTrigger>

                <SelectContent className="bg-background border border-border shadow-lg z-50">
                  {getAvailableFavoritePositions().map((position) => (
                    <SelectItem key={position} value={position}>
                      {position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[150px] !rounded-[10px] focus:ring-offset-0 focus-visible:!ring-0 focus-visible:!outline-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent className="bg-background border border-border shadow-lg z-50">
                  <SelectItem value="Highest Rated">
                    {strings.coach.highestRated}
                  </SelectItem>
                  <SelectItem value="Lowest Rated">Lowest Rated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <section className="w-full px-4">
        <div className="max-w-8xl mx-auto py-8">

          <p className="text-muted-foreground mb-6">
            {filteredCoaches.length} coaches found
          </p>

          {filteredCoaches.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg mb-4">
                No coaches found matching your criteria
              </p>

                  <Button
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedSport("All Sports");
                      setSelectedPillar("All Pillars");
                      setSelectedFavoritePosition("All Positions");
                      setSortBy("Highest Rated");
                    }}
                    variant="outline"
                  >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredCoaches.map((coach) => {
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
