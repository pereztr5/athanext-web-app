import { Activity, Calendar } from "@/components/icons";
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
import { segButton, segGroup } from "@/components/schedule/styles";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCoachPackages } from "@/hooks/useCoachPackages";
import { ROUTES } from "@/routes";
import { getSportPillars, type SPORTPILLARS, type CoachSportPillarLink } from "@/api/sport-pillars";
import type { Enums } from "@/integrations/supabase/types";
import { DEFAULT_PILLARS, ICON_MAP, type SportKey } from "@/utils/pillarIcons";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/hooks/use-toast";
import { chatAPI } from "@/api";
import { buildId } from "@/utils/chatHelpers";
import type { Coach } from "@/types/coachProfile";
import { SPORTS_OPTIONS, normalizePosition } from "@/utils/db";
import { sportFromText } from "@/utils/coachSport";

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
      pillar.title === "On-field training"
        ? "Technical and tactical work on the ball, in 1-on-1 or group sessions."
        : pillar.title === "Video analysis"
        ? "In-depth review of game footage to identify strengths and improvement areas."
        : pillar.title === "Mentorship"
        ? "One-on-one guidance from experienced coaches and professionals."
        : pillar.title === "Performance coaching"
        ? "Speed, strength and conditioning to raise physical performance."
        : pillar.title === "Academic tutoring"
        ? "Subject-specific tutoring and standardized test preparation for academic success."
        : "Expert navigation through the college recruitment process.",
    iconKey: pillar.iconKey,
    variant: ["Performance coaching", "Academic tutoring", "College recruiting"].includes(pillar.title)
      ? "dark"
      : "light",
  })),
  rowing: DEFAULT_PILLARS.rowing.map((pillar) => ({
    id: `rowing-${pillar.title.toLowerCase().replace(/\s+/g, "-")}`,
    title: pillar.title,
    description:
      pillar.title === "Technical development"
        ? "Comprehensive technique refinement across all boat classes, including sculling and sweeping."
        : pillar.title === "Race preparation"
        ? "Tactical training for head race endurance and sprint racing formats."
        : pillar.title === "Mentorship"
        ? "Building mental resilience, team cohesion, and leadership skills on and off the water."
        : pillar.title === "Performance coaching"
        ? "Strategic workout preparation, strength conditioning, and nutrition guidance."
        : pillar.title === "Academic tutoring"
        ? "Subject-specific tutoring and standardized test preparation for academic success."
        : "College recruiting support, summer programs, and pathways to U19, U23, and Senior National Teams.",
    iconKey: pillar.iconKey,
    variant: ["Performance coaching", "Academic tutoring", "College recruiting"].includes(pillar.title)
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
  const { role: personaType, isCoach: isCoachPersona } = useRole();
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
    const fromField = sportFromText(coach?.sport || coach?.sport_type);
    if (fromField) return fromField;

    // Fallback: infer sport from specialties if sport field is missing
    const specialties = Array.isArray(coach.specialties) ? coach.specialties : [];
    const rowingSpecialties = ["Technical development", "Race preparation"];
    const soccerSpecialties = ["On-field training", "Video analysis", "College recruiting"];

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
          const rowingSpecialties = ["Technical development", "Race preparation"];
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
        return mapped;
      }) || [];

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
        title: "Coach to coach messaging isn't available yet",
        variant: "default"
      });
      return;
    }
    if (!user) {
      toast({
        title: "Sign in to send a message",
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
        title: "Conversation didn't start",
        description: "Try again.",
        variant: "destructive"
      });
    } finally {
      setStartingChatForId((prev) => (prev === coach.id ? null : prev));
    }
  };

  const getCoachesForSpecialty = (pillarTitle: string) => {
    if (!pillarTitle) return [];

    const normalizedTitle = pillarTitle.toLowerCase();

    // Filter coaches by:
    // 1. Sport matches selected sport
    // 2. Specialties match pillar title (case-insensitive)
    const filteredCoaches = coaches.filter((coach) => {
      const coachSport = getCoachSportValue(coach);
      const specialtiesArray = Array.isArray(coach.specialties) ? coach.specialties : [];

      if (!coachSport || coachSport !== selectedSport) {
        return false;
      }

      // Check if coach has specialties matching this pillar
      if (Array.isArray(coach.specialties)) {
        const hasMatch = coach.specialties.some(
          (specialty) => specialty?.toLowerCase() === normalizedTitle
        );
        return hasMatch;
      }

      return false;
    });

    const filteredByFavorite = filteredCoaches.filter((coach) => {
      if (!selectedFavoritePosition) return true;
      const rawFavoritePositions =
        (coach as any)?.favourite_positions ?? (coach as any)?.favorite_positions ?? [];
      const favoritePositions = Array.isArray(rawFavoritePositions)
        ? rawFavoritePositions
        : typeof rawFavoritePositions === "string"
          ? rawFavoritePositions.split(",").map((item: string) => item.trim()).filter(Boolean)
          : [];

      return favoritePositions.some((position: string) => {
        const normalized = normalizePosition(selectedSport, position);
        return normalized.toLowerCase() === selectedFavoritePosition.toLowerCase();
      });
    });

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
      ? "Our pillars of holistic soccer development"
      : "Our pillars of holistic rowing development";
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

    const order = ["Technical development", "Race preparation", "Mentorship"];
    const swapped = basePillars.map((pillar) => {
      if (pillar.title === "Race preparation") {
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
      className="mx-auto w-full max-w-wrapper px-4 pb-0 pt-6 sm:px-6 lg:px-8"
    >
      {/* Sport Selection Tabs */}
      <div className="mb-8 flex justify-center">
        <Tabs value={selectedSport} onValueChange={(value) => setSelectedSport((value as SportKey) || "soccer")} className="w-auto">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="soccer">Soccer</TabsTrigger>
            <TabsTrigger value="rowing">Rowing</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mb-10 flex flex-col items-center gap-4 text-center animate-fade-in">
        <h2 className="text-page-title-phone text-dark md:text-page-title">{getSportTitle(selectedSport)}</h2>
        <p className="mx-auto max-w-[640px] text-paragraph text-dark-300">{getSportDescription(selectedSport)}</p>
      </div>

      <div className={`mb-10 grid grid-cols-1 gap-6 transition-opacity duration-200 md:grid-cols-2 lg:grid-cols-3 ${isPillarsLoading ? "opacity-70" : "opacity-100"}`}>
        {displayPillars.map((pillar, index) => {
          const { Icon } = pillar;
          return (
            <button
              type="button"
              key={pillar.id || index}
              onClick={() => {
                setSelectedPillar(pillar.title);
              }}
              className="relative flex min-h-[224px] cursor-pointer flex-col items-center gap-3 rounded-card border border-light-525 bg-light-300 px-[25px] pb-[25px] pt-[30px] text-center text-dark transition-colors hover:border-primary-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <div className="mx-auto mb-1 flex size-12 items-center justify-center rounded-full border border-primary-200 bg-primary-50 text-primary">
                <Icon className="size-6" strokeWidth={1.5} />
              </div>

              <h3 className="text-card-title text-dark">{pillar.title}</h3>

              <p className="flex flex-1 items-center justify-center text-paragraph text-dark-300">{pillar.description}</p>
            </button>
          );
        })}
      </div>

      <div className="mb-16 text-center animate-fade-in sm:mb-20">
        <blockquote className="mx-auto max-w-[640px] text-paragraph italic text-dark-300">
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
          className={`max-w-4xl max-h-[85dvh] flex flex-col ${
          isMobile
            ? 'w-[95vw] m-2'
            : ''
        }`}>
          <DialogHeader className="flex-shrink-0 pb-4 pr-10 sm:pr-4">
            <DialogTitle className="pr-4 text-section text-dark sm:pr-0">{selectedPillar} coaches</DialogTitle>
            <DialogDescription className="mt-1 text-body-m text-dark-300">
              Browse available coaches specializing in {selectedPillar}
            </DialogDescription>
            <div className="mt-3 flex justify-center">
              <div className={cn(segGroup, "inline-flex")} role="group" aria-label="Position">
                {favoritePositionOptions.map((option) => {
                  const isActive = selectedFavoritePosition === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() =>
                        setSelectedFavoritePosition((prev) => (prev === option.value ? null : option.value))
                      }
                      className={cn(segButton(isActive), "flex-none px-5")}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-4 pb-4 overscroll-contain">
                {selectedPillar && getCoachesForSpecialty(selectedPillar).length === 0 ? (
                  <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                    <Calendar className="size-6 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
                    <h3 className="text-card-title text-dark">Coaches coming soon</h3>
                    <p className="mb-3 max-w-md text-paragraph text-dark-300">
                      We're currently onboarding exceptional coaches in this specialty.
                      Check back soon or explore our other available coaches.
                    </p>
                    <Button variant="secondary" onClick={() => navigate(ROUTES.COACHES)}>
                      View all coaches
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

          <div className="mt-4 flex-shrink-0 border-t border-light-525 pt-4">
            <div className="flex gap-3">
              <Button
                onClick={() => closePillarModal(true)}
                variant="secondary"
                className="flex-1"
                size={isMobile ? "lg" : "default"}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  closePillarModal(false);
                  navigate(ROUTES.COACHES);
                }}
                className="flex-1"
                size={isMobile ? "lg" : "default"}
              >
                View all coaches
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
