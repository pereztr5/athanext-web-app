import { Activity, Calendar } from "lucide-react";
import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROWING_BLUE_THEME, SOCCER_THEME } from "@/config/colors";
import CoachSchedulingModal from "./CoachSchedulingModal";
import { PackagesModal } from "./PackagesModal";
import CoachQuickPreviewModal from "./CoachQuickPreviewModal";
import CoachChatPanel from "@/components/chat/CoachChatPanel";
import CoachCard from "@/components/coach/CoachCard";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCoachPackages } from "@/hooks/useCoachPackages";
import { ROUTES } from "@/routes";
import { getSportPillars, type SPORTPILLARS, type CoachSportPillarLink } from "@/api/sport-pillars";
import type { Enums } from "@/integrations/supabase/types";
import { DEFAULT_PILLARS, ICON_MAP, type SportKey } from "@/utils/pillarIcons";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { chatAPI } from "@/api";
import { buildId } from "@/utils/chatHelpers";
import type { Coach } from "@/types/coachProfile";
import { SPORTS_OPTIONS, normalizePosition } from "@/utils/db";

interface AthletePillarsGraphicProps {
  initialSport?: SportKey;
}

type DefaultPillar = {
  id: string;
  title: string;
  description: string;
  iconKey: keyof typeof ICON_MAP;
  variant: "light" | "dark";
};

type PillarDisplay = {
  id: string;
  title: string;
  description: string;
  variant: "light" | "dark";
  Icon: typeof Activity;
};

const DEFAULT_PILLARS_WITH_META: Record<SportKey, DefaultPillar[]> = {
  soccer: DEFAULT_PILLARS.soccer.map((pillar) => ({
    id: `soccer-${pillar.title.toLowerCase().replace(/\s+/g, "-")}`,
    title: pillar.title,
    description:
      pillar.title === "On Field Training"
        ? "Individual or group sessions focused on technical and tactical development across multiple locations."
        : pillar.title === "Video Analysis"
        ? "In-depth review of game footage to identify strengths and improvement areas."
        : pillar.title === "Mentorship"
        ? "One-on-one guidance from experienced coaches and professionals."
        : pillar.title === "Strength + Conditioning"
        ? "Strength and conditioning programs to optimize physical performance."
        : pillar.title === "Academic Tutoring"
        ? "Subject-specific tutoring and standardized test preparation for academic success."
        : "Expert navigation through the college recruitment process.",
    iconKey: pillar.iconKey,
    variant: ["Strength + Conditioning", "Academic Tutoring", "College Recruiting"].includes(pillar.title)
      ? "dark"
      : "light",
  })),
  rowing: DEFAULT_PILLARS.rowing.map((pillar) => ({
    id: `rowing-${pillar.title.toLowerCase().replace(/\s+/g, "-")}`,
    title: pillar.title,
    description:
      pillar.title === "Technical Development"
        ? "Comprehensive technique refinement across all boat classes, including sculling and sweeping."
        : pillar.title === "Race Preparation"
        ? "Tactical training for head race endurance and sprint racing formats."
        : pillar.title === "Mentorship"
        ? "Building mental resilience, team cohesion, and leadership skills on and off the water."
        : pillar.title === "Strength + Conditioning"
        ? "Strategic workout preparation, strength conditioning, and nutrition guidance."
        : pillar.title === "Academic Tutoring"
        ? "Subject-specific tutoring and standardized test preparation for academic success."
        : "College recruiting support, summer programs, and pathways to U19, U23, and Senior National Teams.",
    iconKey: pillar.iconKey,
    variant: ["Strength + Conditioning", "Academic Tutoring", "College Recruiting"].includes(pillar.title)
      ? "dark"
      : "light",
  })),
};
const toVarValue = (hsl: string) => hsl.replace(/^hsl\((.*)\)$/, "$1");

// Local soccer palette overrides keep the original light/dark structure but swap the blue accent for green.
const soccerThemeStyles = {
  '--athlete-title': toVarValue(SOCCER_THEME.title),
  '--athlete-subtitle': toVarValue(SOCCER_THEME.subtitle),
  '--athlete-card-light': toVarValue(SOCCER_THEME.cardLight),
  '--athlete-card-light-text': toVarValue(SOCCER_THEME.cardLightText),
  '--athlete-card-dark-start': toVarValue(SOCCER_THEME.cardDarkStart),
  '--athlete-card-dark-end': toVarValue(SOCCER_THEME.cardDarkEnd),
  '--athlete-quote': toVarValue(SOCCER_THEME.quote),
  '--primary': toVarValue(SOCCER_THEME.primary),
  '--primary-foreground': toVarValue(SOCCER_THEME.primaryForeground),
  '--shadow-soft': SOCCER_THEME.shadowSoft,
  '--shadow-medium': SOCCER_THEME.shadowMedium,
  '--shadow-strong': SOCCER_THEME.shadowStrong,
} as CSSProperties;

// Rowing palette anchors to the requested primary blue (#0d7ff2) with stepped light-to-dark shades for all six cards.
const rowingShades = ROWING_BLUE_THEME.shades;
const rowingThemeStyles = {
  '--rowing-primary': ROWING_BLUE_THEME.primary,
  '--rowing-primary-hover': ROWING_BLUE_THEME.primaryHover,
  '--rowing-heading': ROWING_BLUE_THEME.heading,
  '--rowing-icon-light': ROWING_BLUE_THEME.iconLight,
  '--rowing-icon-dark': ROWING_BLUE_THEME.iconDark,
  '--rowing-text-light': ROWING_BLUE_THEME.textLight,
  '--rowing-text-dark': ROWING_BLUE_THEME.textDark,
  '--rowing-badge-bg': ROWING_BLUE_THEME.badgeBackground,
  '--rowing-badge-text': ROWING_BLUE_THEME.badgeText,
  '--rowing-shadow-light': ROWING_BLUE_THEME.shadowLight,
  '--rowing-shadow-dark': ROWING_BLUE_THEME.shadowDark,
  '--rowing-shade-1': rowingShades[0],
  '--rowing-shade-2': rowingShades[1],
  '--rowing-shade-3': rowingShades[2],
  '--rowing-shade-4': rowingShades[3],
  '--rowing-shade-5': rowingShades[4],
  '--rowing-shade-6': rowingShades[5],
} as CSSProperties;

const AthletePillarsGraphic = ({ initialSport = "soccer" }: AthletePillarsGraphicProps) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [selectedPillar, setSelectedPillar] = useState<string | null>(null);
  const [selectedCoach, setSelectedCoach] = useState<any>(null);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [isSchedulingOpen, setIsSchedulingOpen] = useState(false);
  const [showPackagesModal, setShowPackagesModal] = useState(false);
  const [showQuickPreview, setShowQuickPreview] = useState(false);
  const [previewCoach, setPreviewCoach] = useState<any>(null);
  const [selectedSport, setSelectedSport] = useState<SportKey>(initialSport);
  const [serviceType, setServiceType] = useState<'Free Consultation' | 'Single Session'>('Single Session');
  const [sportPillarsBySport, setSportPillarsBySport] = useState<Record<SportKey, SPORTPILLARS[]>>({
    soccer: [],
    rowing: [],
  });
  const [sportPillarsLoadingBySport, setSportPillarsLoadingBySport] = useState<Record<SportKey, boolean>>({
    soccer: false,
    rowing: false,
  });
  const [coachPillarLinks, setCoachPillarLinks] = useState<CoachSportPillarLink[]>([]);
  const bodyOverflowRef = useRef<string | null>(null);
  const { data: packages = [] } = useCoachPackages(selectedCoach?.id);
  const hasModalHistoryEntry = useRef(false);
  const activeThemeStyles = selectedSport === "soccer" ? soccerThemeStyles : rowingThemeStyles;
  const [startingChatForId, setStartingChatForId] = useState<string | null>(null);
  const [chatCoach, setChatCoach] = useState<Coach | null>(null);
  const [chatConversationId, setChatConversationId] = useState<string | null>(null);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const personaType = (user as any)?.user_metadata?.persona_type || null;
  const isCoachPersona = personaType === "coach";
  const [selectedFavoritePosition, setSelectedFavoritePosition] = useState<string | null>(null);

  const sportOption = useMemo(
    () =>
      SPORTS_OPTIONS.find(
        (option) => option.value.toLowerCase() === selectedSport.toLowerCase()
      ),
    [selectedSport]
  );
  const favoritePositionOptions = sportOption?.positions ?? [];
  const getFavoritePositionLabel = useCallback(
    (value: string) =>
      sportOption?.positions.find((position) => position.value === value)?.label || value,
    [sportOption]
  );

  const getCoachSportValue = useCallback((coach: any) => {
    // First try sport or sport_type fields
    const sportSource = (coach?.sport || coach?.sport_type || "").toLowerCase();
    if (sportSource.includes("row")) return "rowing";
    if (["soccer", "football", "scoccer"].some((s) => sportSource.includes(s))) {
      return "soccer";
    }

    // Fallback: infer sport from specialties if sport field is missing
    const specialties = Array.isArray(coach.specialties) ? coach.specialties : [];
    const rowingSpecialties = ["Technical Development", "Race Preparation"];
    const soccerSpecialties = ["On Field Training", "Video Analysis", "College Recruiting"];

    const hasRowingSpecialty = specialties.some((spec) =>
      rowingSpecialties.some((rs) => spec?.toLowerCase().includes(rs.toLowerCase()))
    );

    const hasSoccerSpecialty = specialties.some((spec) =>
      soccerSpecialties.some((ss) => spec?.toLowerCase().includes(ss.toLowerCase()))
    );

    // If specialties suggest rowing, return rowing
    if (hasRowingSpecialty && !hasSoccerSpecialty) {
      return "rowing";
    }

    // Default to soccer for common specialties
    if (specialties.length > 0) {
      return "soccer";
    }

    return "";
  }, []);

  const normalizeCoachForChat = useCallback((coach: any): Coach => ({
    id: coach.id,
    name: coach.name ?? "Coach",
    coach_position: coach.position ?? coach.coach_position,
    position: coach.position ?? undefined,
    company: coach.company ?? undefined,
    specialties: coach.specialties ?? [],
    image_url: coach.image_url ?? coach.profile_image_url ?? undefined,
    rating: coach.rating ?? undefined,
    total_reviews: coach.total_reviews ?? undefined,
    locations: coach.locations ?? [],
    years_experience: coach.years_experience ?? undefined,
    sport: coach.sport ?? coach.sport_type ?? undefined,
    hourly_rate: coach.hourly_rate ?? undefined,
  }), []);

  const closePillarModal = useCallback((shouldNavigateBack = false) => {
    if (shouldNavigateBack && hasModalHistoryEntry.current && typeof window !== "undefined") {
      window.history.back();
      return;
    }
    setSelectedPillar(null);
  }, []);

  const fetchCoaches = useCallback(async () => {
    try {
      console.log('Fetching coaches...');
      const { data, error } = await supabase
        .rpc('get_coaches_public');
      
      if (error) {
        console.error('❌ Error fetching coaches:', error);
        return;
      }

      if (!data) {
        console.warn('⚠️ No data returned from get_coaches_public RPC');
        setCoaches([]);
        return;
      }

      // Map coach_position to position for compatibility
      const mappedCoaches = data?.map((coach: any) => {
        // Ensure specialties is always an array
        const specialties = Array.isArray(coach.specialties) ? coach.specialties : [];
        
        // Infer sport from specialties if not provided
        let inferredSport = coach.sport || coach.sport_type || "";
        if (!inferredSport) {
          const rowingSpecialties = ["Technical Development", "Race Preparation"];
          const hasRowingSpecialty = specialties.some((spec) =>
            rowingSpecialties.some((rs) => spec?.toLowerCase().includes(rs.toLowerCase()))
          );
          inferredSport = hasRowingSpecialty ? "rowing" : "soccer";
        }

        const mapped = {
          ...coach,
          position: coach.coach_position,
          sport: inferredSport,
          specialties: specialties,
          // Map positions to favourite_positions for compatibility
          favourite_positions: coach.positions || []
        };
        console.log('Mapped coach:', {
          name: mapped.name,
          sport: mapped.sport,
          specialties: mapped.specialties,
          position: mapped.position,
          coach_position: mapped.coach_position,
          favourite_positions: mapped.favourite_positions,
          favorite_positions: mapped.favorite_positions,
          positions: mapped.positions
        });
        return mapped;
      }) || [];

      console.log(`✓ Successfully fetched ${mappedCoaches.length} coaches`);
      setCoaches(mappedCoaches);
    } catch (error) {
      console.error('❌ Exception fetching coaches:', error);
    }
  }, []);

  useEffect(() => {
    void fetchCoaches();
  }, [fetchCoaches]);

  const fetchSportPillars = useCallback(async (sport: SportKey) => {
    setSportPillarsLoadingBySport((prev) => ({ ...prev, [sport]: true }));
    try {
      const { data, error } = await getSportPillars(sport as Enums<'sport_type'>);
      if (!error && data?.sportPillars) {
        setSportPillarsBySport((prev) => ({ ...prev, [sport]: data.sportPillars }));
      } else {
        setSportPillarsBySport((prev) => ({ ...prev, [sport]: [] }));
        if (error) {
          console.warn('Unable to load sport pillars, falling back to defaults:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching sport pillars:', error);
      setSportPillarsBySport((prev) => ({ ...prev, [sport]: [] }));
    } finally {
      setSportPillarsLoadingBySport((prev) => ({ ...prev, [sport]: false }));
    }
  }, []);

  const fetchCoachPillarLinksForSport = useCallback(async (sport: SportKey) => {
    // Note: coach_sport_pillars table doesn't exist in current schema
    // Using specialty matching as fallback
    try {
      // Placeholder - will use specialty matching in getCoachesForSpecialty
      setCoachPillarLinks([]);
    } catch (error) {
      console.error('Error fetching coach pillar links:', error);
      setCoachPillarLinks([]);
    }
  }, []);

  useEffect(() => {
    void fetchSportPillars("soccer");
    void fetchSportPillars("rowing");
  }, [fetchSportPillars]);

  useEffect(() => {
    void fetchCoachPillarLinksForSport(selectedSport);
  }, [selectedSport, fetchCoachPillarLinksForSport]);

  useEffect(() => {
    if (!selectedPillar || typeof window === "undefined") return;

    const handlePopState = () => {
      hasModalHistoryEntry.current = false;
      setSelectedPillar(null);
    };

    window.history.pushState({ pillarModal: true }, "", window.location.href);
    hasModalHistoryEntry.current = true;
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      hasModalHistoryEntry.current = false;
    };
  }, [selectedPillar]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (selectedPillar) {
      if (bodyOverflowRef.current === null) {
        bodyOverflowRef.current = document.body.style.overflow;
      }
      document.body.style.overflow = "hidden";
    } else if (bodyOverflowRef.current !== null) {
      document.body.style.overflow = bodyOverflowRef.current;
      bodyOverflowRef.current = null;
    }
  }, [selectedPillar]);

  useEffect(() => {
    return () => {
      if (typeof document === "undefined") return;
      if (bodyOverflowRef.current !== null) {
        document.body.style.overflow = bodyOverflowRef.current;
        bodyOverflowRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (selectedPillar) {
      closePillarModal(false);
    }
    setSelectedFavoritePosition(null);
    // We only want to react to sport changes here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSport]);

  const handleSendMessage = async (coach: any) => {
    if (!coach?.id) return;
    if (isCoachPersona) {
      toast({
        title: "Coach to Coach messaging is not currently available.",
        variant: "default"
      });
      return;
    }
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to send a message",
        variant: "destructive"
      });
      navigate("/auth?mode=signin");
      return;
    }

    try {
      setStartingChatForId(coach.id);

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
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast({
        title: "Error",
        description: "Failed to start conversation. Please try again.",
        variant: "destructive"
      });
    } finally {
      setStartingChatForId((prev) => (prev === coach.id ? null : prev));
    }
  };

  const getCoachesForSpecialty = (pillarTitle: string) => {
    if (!pillarTitle) return [];

    const normalizedTitle = pillarTitle.toLowerCase();
    
    // Debug logging
    console.log('=== getCoachesForSpecialty DEBUG ===');
    console.log('Searching for pillar:', pillarTitle);
    console.log('Normalized pillar title:', normalizedTitle);
    console.log('Selected sport:', selectedSport);
    console.log('Total coaches:', coaches.length);
    console.log('All coaches:', coaches);
    
    // Filter coaches by:
    // 1. Sport matches selected sport
    // 2. Specialties match pillar title (case-insensitive)
    const filteredCoaches = coaches.filter((coach) => {
      const coachSport = getCoachSportValue(coach);
      const specialtiesArray = Array.isArray(coach.specialties) ? coach.specialties : [];
      
      console.log(`Coach: ${coach.name}, Sport: ${coachSport}, Specialties:`, specialtiesArray);
      
      if (!coachSport || coachSport !== selectedSport) {
        console.log(`  ❌ Sport mismatch or missing - coachSport: ${coachSport}, selectedSport: ${selectedSport}`);
        return false;
      }

      // Check if coach has specialties matching this pillar
      if (Array.isArray(coach.specialties)) {
        const hasMatch = coach.specialties.some(
          (specialty) => specialty?.toLowerCase() === normalizedTitle
        );
        console.log(`  ${hasMatch ? '✓' : '❌'} Specialty match - checking against:`, coach.specialties);
        return hasMatch;
      }

      console.log(`  ❌ Specialties not an array`);
      return false;
    });

    console.log('Filtered coaches (by sport & specialty):', filteredCoaches.length, filteredCoaches);

    const filteredByFavorite = filteredCoaches.filter((coach) => {
      if (!selectedFavoritePosition) return true;
      const rawFavoritePositions =
        (coach as any)?.favourite_positions ?? (coach as any)?.favorite_positions ?? [];
      const favoritePositions = Array.isArray(rawFavoritePositions)
        ? rawFavoritePositions
        : typeof rawFavoritePositions === "string"
          ? rawFavoritePositions.split(",").map((item: string) => item.trim()).filter(Boolean)
          : [];
      
      console.log(`Filtering by position "${selectedFavoritePosition}" for coach ${coach.name}:`, {
        rawFavoritePositions,
        favoritePositions,
        normalized: favoritePositions.map(p => normalizePosition(selectedSport, p))
      });
      
      return favoritePositions.some((position: string) => {
        const normalized = normalizePosition(selectedSport, position);
        return normalized.toLowerCase() === selectedFavoritePosition.toLowerCase();
      });
    });

    console.log('Final filtered coaches:', filteredByFavorite.length, filteredByFavorite);
    console.log('=== END DEBUG ===\n');

    return filteredByFavorite;
  };

  const handleCoachClick = (coach: any, specialty: string, bookingType: 'Free Consultation' | 'Single Session' = 'Single Session') => {
    setSelectedCoach(coach);
    setSelectedPillar(specialty);
    setServiceType(bookingType);
    setIsSchedulingOpen(true);
  };

  const getSportTitle = (sport: SportKey) => {
    return sport === "soccer" 
      ? "Our Pillars of Holistic Soccer Development"
      : "Our Pillars of Holistic Rowing Development";
  };

  const getSportDescription = (sport: SportKey) => {
    return sport === "soccer"
      ? "We provide comprehensive support across all aspects of a soccer player's journey"
      : "We provide comprehensive support across all aspects of a rower's journey";
  };

  const getSportQuote = (sport: SportKey) => {
    return sport === "soccer"
      ? "Soccer is more than a sport; it's a pathway to excellence. We develop complete athletes who master the game while building character, discipline, and skills that transcend the field."
      : "Excellence in rowing comes from the perfect blend of technical mastery, physical preparation, and mental fortitude - on and off the water.";
  };

  const getRowingPillarStyle = (_index: number, variant: 'light' | 'dark'): CSSProperties => {
    // Keep a consistent light shade for the first row and a consistent dark shade for the second row.
    const lightShade = 'var(--rowing-shade-2)';
    const darkShade = 'var(--rowing-shade-6)';
    return {
      background: variant === 'light' ? lightShade : darkShade,
      color: variant === 'light' ? 'var(--rowing-text-light)' : 'var(--rowing-text-dark)',
      boxShadow: variant === 'light' ? 'var(--rowing-shadow-light)' : 'var(--rowing-shadow-dark)',
    };
  };

  const displayPillars: PillarDisplay[] = useMemo(() => {
    const fallbackPillars = DEFAULT_PILLARS_WITH_META[selectedSport] || [];
    const sportPillars = sportPillarsBySport[selectedSport] || [];

    const basePillars = !sportPillars.length
      ? fallbackPillars.map((pillar) => ({
          id: pillar.id,
          title: pillar.title,
          description: pillar.description,
          variant: pillar.variant,
          Icon: ICON_MAP[pillar.iconKey] ?? Activity,
        }))
      : sportPillars.map((pillar, index) => {
          const fallback = fallbackPillars[index] || fallbackPillars[index % fallbackPillars.length];
          const iconName = pillar.icon?.toLowerCase() as keyof typeof ICON_MAP | undefined;
          return {
            id: pillar.id || fallback?.id || `pillar-${index}`,
            title: pillar.title || fallback?.title || `Pillar ${index + 1}`,
            description: pillar.description || fallback?.description || "",
            variant: fallback?.variant || (index < 3 ? "light" : "dark"),
            Icon: ICON_MAP[iconName || fallback?.iconKey || "activity"] ?? Activity,
          };
        });

    if (selectedSport !== "rowing") {
      return basePillars;
    }

    const order = ["Technical Development", "Race Preparation", "Mentorship"];
    const swapped = basePillars.map((pillar) => {
      if (pillar.title === "Race Preparation") {
        return { ...pillar, Icon: ICON_MAP.activity };
      }
      if (pillar.title === "Mentorship") {
        return { ...pillar, Icon: ICON_MAP.users };
      }
      return pillar;
    });

    return [...swapped].sort((a, b) => {
      const aIndex = order.indexOf(a.title);
      const bIndex = order.indexOf(b.title);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [selectedSport, sportPillarsBySport]);

  const isPillarsLoading = sportPillarsLoadingBySport[selectedSport];

  return (
    <section 
      style={activeThemeStyles}
      className={`w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-0 ${selectedSport === "rowing" ? "" : ""}`}
    >
      {/* Sport Selection Tabs */}  
      <div className="flex justify-center mb-8">
        <Tabs value={selectedSport} onValueChange={(value) => setSelectedSport((value as SportKey) || "soccer")} className="w-auto">
          <TabsList className="grid w-full grid-cols-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 shadow-sm">
            <TabsTrigger 
              value="soccer" 
              style={{ ['--tab-color' as any]: SOCCER_THEME.primary }}
              className="data-[state=active]:bg-[var(--tab-color)] data-[state=active]:text-white data-[state=inactive]:text-[var(--tab-color)] data-[state=inactive]:hover:bg-muted transition-colors text-sm"
            >
              Soccer
            </TabsTrigger>
            <TabsTrigger 
              value="rowing"
              style={{ ['--tab-color' as any]: ROWING_BLUE_THEME.primary }}
              className="data-[state=active]:bg-[var(--tab-color)] data-[state=active]:text-white data-[state=inactive]:text-[var(--tab-color)] data-[state=inactive]:hover:bg-muted transition-colors text-sm"
            >
              Rowing
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="text-center mb-10 animate-fade-in">
        <h2
          className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4"
          style={{ color: selectedSport === "rowing" ? ROWING_BLUE_THEME.heading : SOCCER_THEME.primary }}
        >
          {getSportTitle(selectedSport)}
        </h2>
        <p className={`text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed ${selectedSport === "rowing" ? "" : ""}`}>
          {getSportDescription(selectedSport)}
        </p>
      </div>
      
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10 transition-opacity duration-200 ${isPillarsLoading ? "opacity-70" : "opacity-100"}`}>
        {displayPillars.map((pillar, index) => {
          const { Icon } = pillar;
          const isRowing = selectedSport === "rowing";
          const iconColorStyle = isRowing
            ? { color: pillar.variant === 'light' ? ROWING_BLUE_THEME.iconLight : ROWING_BLUE_THEME.iconDark }
            : undefined;
          const descriptionStyle = isRowing
            ? { color: pillar.variant === 'light' ? ROWING_BLUE_THEME.textLight : ROWING_BLUE_THEME.textDark }
            : undefined;
          const iconWrapperClass = isRowing
            ? (pillar.variant === 'light' ? 'bg-white shadow-md' : 'bg-white/20 border border-white/25 backdrop-blur-sm')
            : (pillar.variant === 'light' ? 'bg-white shadow-soft' : 'bg-white/20 backdrop-blur-sm');
          const headingStyle = isRowing 
            ? { color: pillar.variant === 'light' ? ROWING_BLUE_THEME.heading : ROWING_BLUE_THEME.textDark }
            : undefined;
          return (
            <div
              key={pillar.id || index}
              onClick={() => {
                setSelectedPillar(pillar.title);
              }}
              className={`
                relative p-6 rounded-3xl transition-all duration-300 min-h-[224px] flex flex-col
                cursor-pointer hover:scale-105
                ${isRowing 
                  ? 'border border-transparent' 
                  : (
                    pillar.variant === 'light' 
                      ? 'bg-athlete-card-light text-athlete-card-light-text shadow-soft hover:shadow-medium' 
                      : 'bg-gradient-primary text-white shadow-medium hover:shadow-strong'
                  )
                }
              `}
              style={isRowing ? getRowingPillarStyle(index, pillar.variant) : (
                !isRowing && pillar.variant === 'dark' ? { 
                  background: 'linear-gradient(135deg, hsl(var(--athlete-card-dark-start)), hsl(var(--athlete-card-dark-end)))' 
                } : undefined
              )}
            >
              <div className={`
                w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto
                ${iconWrapperClass}
              `}>
                <Icon 
                  size={22} 
                  style={iconColorStyle}
                />
              </div>
              
              <h3 className="text-xl font-inter font-bold mb-3 text-center" style={headingStyle}>
                {pillar.title}
              </h3>
              
              <p className="text-sm text-center leading-relaxed font-inter flex-1 flex items-center justify-center"
                style={descriptionStyle}
              >
                {pillar.description}
              </p>
            </div>
          );
        })}
      </div>
      
      <div className="text-center animate-fade-in mb-16 sm:mb-20">
        <blockquote className={`text-base sm:text-lg font-medium italic max-w-4xl mx-auto text-muted-foreground leading-relaxed`}>
          "{getSportQuote(selectedSport)}"
        </blockquote>
      </div>
      
      <Dialog
        modal={false}
        open={selectedPillar !== null}
        onOpenChange={(open) => {
        if (!open) {
          closePillarModal(true);
        }
      }}
      >
        <DialogContent
          onInteractOutside={(event) => event.preventDefault()}
          className={`max-w-4xl max-h-[85vh] flex flex-col ${
          isMobile 
            ? 'w-[95vw] m-2' 
            : ''
        }`}>
          <DialogHeader className="flex-shrink-0 pb-4 pr-10 sm:pr-4">
            <DialogTitle
              className="text-2xl font-bold pr-4 sm:pr-0"
              style={{ color: selectedSport === "rowing" ? ROWING_BLUE_THEME.heading : undefined }}
            >
              {selectedPillar} Coaches
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Browse available coaches specializing in {selectedPillar}
            </DialogDescription>
            <div className="mt-3 flex justify-center">
              <div className="inline-flex items-center rounded-full bg-white/80 dark:bg-slate-800/80 border border-gray-200 dark:border-gray-700 shadow-sm p-1">
                {favoritePositionOptions.map((option, index) => {
                  const isActive = selectedFavoritePosition === option.value;
                  const isSoccer = selectedSport === "soccer";
                  const activeStyle = isSoccer
                    ? { backgroundColor: SOCCER_THEME.primary, color: SOCCER_THEME.primaryForeground }
                    : { backgroundColor: ROWING_BLUE_THEME.primary, color: ROWING_BLUE_THEME.primaryText };
                  const inactiveStyle = isSoccer
                    ? { color: SOCCER_THEME.primary }
                    : { color: ROWING_BLUE_THEME.primary };

                  return (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      onClick={() =>
                        setSelectedFavoritePosition((prev) => (prev === option.value ? null : option.value))
                      }
                      className={cn(
                        "text-xs px-5 py-1.5 transition-colors",
                        index === 0 ? "rounded-full rounded-r-none" : "rounded-full rounded-l-none",
                        isActive ? "" : "bg-transparent hover:bg-muted"
                      )}
                      style={isActive ? activeStyle : inactiveStyle}
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-4 pb-4 overscroll-contain">
                {selectedPillar && getCoachesForSpecialty(selectedPillar).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-6 text-center min-h-[300px]">
                    <div
                      className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                      style={{
                        backgroundColor: selectedSport === "rowing" ? ROWING_BLUE_THEME.badgeBackground : undefined,
                      }}
                    >
                      <Calendar
                        size={40}
                        style={{ color: selectedSport === "rowing" ? ROWING_BLUE_THEME.badgeText : undefined }}
                      />
                    </div>
                    <h3
                      className="text-xl font-bold mb-2"
                      style={{ color: selectedSport === "rowing" ? ROWING_BLUE_THEME.heading : undefined }}
                    >
                      Coaches Coming Soon!
                    </h3>
                    <p className="text-muted-foreground max-w-md mb-6">
                      We're currently onboarding exceptional coaches in this specialty. 
                      Check back soon or explore our other available coaches.
                    </p>
                    <Button 
                      variant="outline" 
                      style={selectedSport === "rowing" ? { borderColor: ROWING_BLUE_THEME.primary, color: ROWING_BLUE_THEME.primary } : undefined}
                      onClick={() => navigate(ROUTES.COACHES)}
                    >
                      View All Coaches
                    </Button>
                  </div>
                ) : (
                  selectedPillar && getCoachesForSpecialty(selectedPillar).map((coach) => (
                    <CoachCard
                      key={coach.id}
                      coach={coach}
                      onViewProfile={(coachId) => navigate(`/coach/${coachId}`)}
                      onSession={(coachId) => navigate(`/coach/${coachId}`, { state: { scrollToAvailability: true } })}
                      onViewPackages={() => navigate(`/coach/${coach.id}`, { state: { scrollToPackages: true } })}
                      onSendMessage={handleSendMessage}
                      disableSendMessage={false}
                      isSendingMessage={startingChatForId === coach.id}
                    />
                  ))
                )}
          </div>
          
          <div
            className="flex-shrink-0 mt-4 pt-4 border-t"
            style={{ borderColor: selectedSport === "rowing" ? ROWING_BLUE_THEME.shades[1] : undefined }}
          >
            <div className="flex gap-3">
              <Button 
                onClick={() => {
                  closePillarModal(false);
                  navigate(ROUTES.COACHES);
                }}
                className={`flex-1 ${
                  selectedSport === "rowing" 
                    ? "text-white" 
                    : "text-white"
                }`}
                style={selectedSport === "rowing"
                  ? { backgroundColor: ROWING_BLUE_THEME.primary, color: ROWING_BLUE_THEME.primaryText }
                  : { backgroundColor: SOCCER_THEME.primary, color: SOCCER_THEME.primaryForeground }
                }
                size={isMobile ? "lg" : "default"}
              >
                View All Coaches
              </Button>
              <Button 
                onClick={() => closePillarModal(true)}
                variant="outline"
                className="flex-1"
                size={isMobile ? "lg" : "default"}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CoachSchedulingModal
        coach={selectedCoach}
        isOpen={isSchedulingOpen}
        onClose={() => {
          setIsSchedulingOpen(false);
          setSelectedCoach(null);
        }}
        serviceType={serviceType}
      />
      
      {selectedCoach && (
        <PackagesModal
          isOpen={showPackagesModal}
          onClose={() => setShowPackagesModal(false)}
          packages={packages}
          coachName={selectedCoach.name}
        />
      )}

      <CoachQuickPreviewModal
        coach={previewCoach}
        isOpen={showQuickPreview}
        onClose={() => {
          setShowQuickPreview(false);
          setPreviewCoach(null);
        }}
        onBookSession={(serviceType) => {
          setServiceType(serviceType);
          setSelectedCoach(previewCoach);
          setShowQuickPreview(false);
          setIsSchedulingOpen(true);
        }}
        onViewPackages={() => {
          setShowQuickPreview(false);
          if (previewCoach?.id) {
            navigate(`/coach/${previewCoach.id}`, { state: { scrollToPackages: true } });
          }
        }}
        onViewFullProfile={() => {
          setShowQuickPreview(false);
          navigate(`/coach/${previewCoach?.id}`);
        }}
      />

      {showChatPanel && chatCoach && (
        <CoachChatPanel
          coach={chatCoach}
          conversationId={chatConversationId ?? undefined}
          onClose={() => setShowChatPanel(false)}
        />
      )}

    </section>
  );
};

export default AthletePillarsGraphic;
