import { useRef, useState, useEffect, useCallback } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { COACH_PROFILE_THEMES } from "@/config/colors";
import { useCoachDetails } from "@/hooks/useCoachDetails";
import { GearAndDealsCard } from "@/components/coach-profile/GearAndDealsCard";
import { normalizeCoachFaqs } from "@/components/coach-profile/FAQSection";
import { useCoachBrands } from "@/hooks/useBrands";
import { useCoachPackages } from "@/hooks/useCoachPackages";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import CoachSchedulingModal from "@/components/coach/CoachSchedulingModal";
import { BookSessionButton } from "@/components/coach/BookSessionFlow";
import { ReviewModal } from "@/components/reviews/ReviewModal";
import { FreeConsultationInfoDialog } from "@/components/coach/FreeConsultationInfoDialog";
import { useReviews } from "@/hooks/useReviews";
import { BookingType } from "@/types/common";
import { CoachAvailabilitySlot } from "@/types/availability";
import {
  CoachHeader,
  AboutSection,
  CertificationsSection,
  TrainingSpecialization,
  ReviewsSection,
  QuickInfo,
  FAQSection,
} from "@/components/coach-profile";
import { CoachProfileView } from "@/components/coach-profile/CoachProfileView";
import { CoachAvailabilitySection } from "@/components/coach-profile/CoachAvailabilitySection";
import { CoachingPackages } from "@/components/coach-profile/CoachingPackages";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { chatAPI } from "@/api";
import CoachChatPanel from "@/components/chat/CoachChatPanel";
import { buildId } from "@/utils/chatHelpers";
import { detectCoachSport } from "@/utils/coachSport";
import { coachPricingPath, coachProfilePath } from "@/utils/coachSlug";
import { recordCoachShareEvent } from "@/api/coachShare";
import { ROUTES } from "@/routes";
import { supabase } from "@/integrations/supabase/client";
import { toBookSlotPayload } from "@/utils/slotBooking";
import type { SlotOccurrence } from "@/types/availabilityWithOccurrences";

const CoachProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, userProfile } = useAuth();
  const isPricingPath = location.pathname.endsWith("/pricing");

  const resolvedCoachKey =
    id ||
    (typeof (userProfile as any)?.coach_id === "string" ? (userProfile as any).coach_id : "") ||
    (typeof (user?.user_metadata as any)?.coach_id === "string" ? (user?.user_metadata as any).coach_id : "");

  const { coach, loading, error } = useCoachDetails(resolvedCoachKey);
  const { data: packages = [], isLoading: packagesLoading } = useCoachPackages(coach?.id);
  const { data: coachBrands = [] } = useCoachBrands(coach?.id);
  const [serviceType, setServiceType] = useState<BookingType>(BookingType.SingleSession);
  const [showSchedulingModal, setShowSchedulingModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showFreeConsultInfo, setShowFreeConsultInfo] = useState(false);
  const [selectedSlotBooking, setSelectedSlotBooking] = useState<{
    slot: CoachAvailabilitySlot;
    date: string;
    availabilityId: string;
    weekStart: string;
    occurrenceId: string;
  } | null>(null);
  const { reviews = [], averageRating = 0, ratingDistribution = {}, totalReviews = 0, submitReview } = useReviews(coach?.id);
  const [startingChat, setStartingChat] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [chatConversationId, setChatConversationId] = useState<string | null>(null);
  const { role: personaType, isAthleteLike, isAuthenticated } = useRole();
  const canSendMessage = true;
  const canBookSlots = isAthleteLike;
  const availabilitySectionRef = useRef<HTMLDivElement | null>(null);
  const packagesSectionRef = useRef<HTMLDivElement | null>(null);
  const normalizedCoachSport = detectCoachSport(coach as any);

  const scrollToSection = useCallback((ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    if (loading || !coach?.slug || !id) return;
    const canonical = isPricingPath
      ? coachPricingPath(coach.slug)
      : coachProfilePath(coach.slug);
    if (location.pathname !== canonical) {
      navigate(`${canonical}${location.search}`, { replace: true, state: location.state });
    }
  }, [loading, coach?.slug, id, isPricingPath, location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    if (loading || !coach?.id || !isPricingPath) return;
    void recordCoachShareEvent(coach.id, "pricing_view");
  }, [loading, coach?.id, isPricingPath]);

  useEffect(() => {
    if (!loading && coach && (isPricingPath || (location.state as any)?.scrollToPackages || (location.state as any)?.scrollTo === "packages")) {
      scrollToSection(packagesSectionRef);
    } else if (!loading && coach && ((location.state as any)?.scrollToAvailability || (location.state as any)?.scrollTo === "availability")) {
      scrollToSection(availabilitySectionRef);
    }
  }, [loading, coach, location.state, isPricingPath, scrollToSection]);

  // A session link shared from My Schedule (?session=<id>, ATH-71) opens booking for that session.
  const sharedSessionId = new URLSearchParams(location.search).get("session");
  const handledSharedSession = useRef<string | null>(null);
  useEffect(() => {
    if (!sharedSessionId || loading || !coach?.id || handledSharedSession.current === sharedSessionId) return;
    handledSharedSession.current = sharedSessionId;
    if (!user) {
      navigate(`${ROUTES.AUTH}?mode=signin`, {
        state: { from: { pathname: location.pathname, search: location.search } },
      });
      return;
    }
    if (!canBookSlots) return;
    void (async () => {
      const { data } = await supabase.rpc("get_session_for_booking", { p_occurrence_id: sharedSessionId });
      const occ = data as unknown as SlotOccurrence | null;
      if (!occ || occ.coach_id !== coach.id) {
        toast({ title: "This session isn't available anymore", description: "Pick another time below." });
        scrollToSection(availabilitySectionRef);
        return;
      }
      handleBookSlot(toBookSlotPayload(occ));
    })();
    // handleBookSlot only sets state; leaving it out keeps this to one run per link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedSessionId, loading, coach?.id, user, canBookSlots]);

  // Only feeds CoachHeader's required sportTheme prop; colours come from the brand kit now
  const getSportTheme = () => {
    if (normalizedCoachSport === "soccer") {
      return COACH_PROFILE_THEMES.soccer;
    }

    if (normalizedCoachSport === "rowing") {
      return COACH_PROFILE_THEMES.rowing;
    }

    // Default theme - Blue
    return COACH_PROFILE_THEMES.default;
  };

  const sportTheme = getSportTheme();

  const handleBookSlot = (payload: {
    slot: CoachAvailabilitySlot;
    date: string;
    availabilityId: string;
    weekStart: string;
    occurrenceId: string;
  }) => {
    setSelectedSlotBooking(payload);
    setServiceType(BookingType.SingleSession);
    setShowSchedulingModal(true);
  };

  const handleGuestSignInRedirect = useCallback(() => {
    navigate(`${ROUTES.AUTH}?mode=signin`, {
      state: { scrollTo: "availability" },
    });
  }, [navigate]);

  // Handle errors
  if (error) {
    toast({
      title: "Coach not found",
      description: "The coach profile you're looking for doesn't exist.",
      variant: "destructive",
    });
    navigate('/');
  }

  const handleSendMessage = async () => {
    if (!coach?.id) return;
    if (personaType === "coach") {
      toast({
        title: "Coach-to-coach messaging isn't available yet.",
      });
      return;
    }
    if (!user) {
      navigate("/auth?mode=signin");
      return;
    }

    try {
      setStartingChat(true);

      // Find the coach's user id via user_profiles
      const { data: coachProfile, error: coachProfileError } = await chatAPI.getCoachUserProfile(
        coach.id
      );

      if (coachProfileError || !coachProfile?.id) {
        throw coachProfileError || new Error("Coach profile not found");
      }

      const coachUserId = coachProfile.id;

      // Check for existing direct conversation created by this user for this coach
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
          title: coach.name, // store other user's name as the title for easy display
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
      setStartingChat(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden bg-app-background px-4 pb-16 pt-[3.8rem] md:px-10">
        <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6 pt-6" aria-busy="true" aria-label="Loading coach profile">
          <Skeleton className="h-4 w-28 rounded-[4px]" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[147px_minmax(0,1fr)_minmax(0,1fr)_147px]">
            <Skeleton className="h-[165px] rounded-[10px]" />
            <Skeleton className="h-[165px] rounded-[10px]" />
            <Skeleton className="h-[165px] rounded-[10px]" />
            <Skeleton className="h-[165px] rounded-[10px]" />
          </div>
          <Skeleton className="h-[260px] rounded-[10px]" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_317px]">
            <div className="flex flex-col gap-6">
              <Skeleton className="h-[200px] rounded-[10px]" />
              <Skeleton className="h-[160px] rounded-[10px]" />
            </div>
            <div className="flex flex-col gap-6">
              <Skeleton className="h-[180px] rounded-[10px]" />
              <Skeleton className="h-[160px] rounded-[10px]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!coach) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-app-background px-4">
        <div className="flex max-w-[420px] flex-col items-center gap-3 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] py-[30px] text-center">
          <h1 className="text-[24px] font-semibold leading-[30px] tracking-[-0.05em] text-[#1A202C]">Coach not found</h1>
          <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
            This profile may have been removed or the link is wrong.
          </p>
          <Button variant="outline" onClick={() => navigate(ROUTES.COACHES)}>
            Browse coaches
          </Button>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden bg-app-background">
        <CoachProfileView
          coach={coach as any}
          packages={packages}
          averageRating={averageRating}
          totalReviews={totalReviews}
          reviews={reviews}
          // The Working Copy has no weekly table here: Book opens Book a Session with this coach.
          canBook={canBookSlots}
          onMessage={canSendMessage ? handleSendMessage : undefined}
          messaging={startingChat}
        />
        {coach ? (
          <>
            <CoachSchedulingModal
              isOpen={showSchedulingModal}
              onClose={() => {
                setShowSchedulingModal(false);
                setSelectedSlotBooking(null);
              }}
              coach={coach}
              serviceType={serviceType}
              prefillSlot={selectedSlotBooking}
            />
            <ReviewModal
              open={showReviewModal}
              onOpenChange={setShowReviewModal}
              coachName={coach.name}
              onSubmit={submitReview}
            />
            {showChatPanel && (
              <CoachChatPanel
                coach={coach}
                conversationId={chatConversationId ?? undefined}
                onClose={() => setShowChatPanel(false)}
              />
            )}
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-[3.8rem] min-h-screen w-full overflow-x-hidden bg-app-background px-4 pb-20 pt-6 md:px-10">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
        <Link
          to={ROUTES.COACHES}
          className="inline-flex w-fit items-center gap-1 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#767980] hover:text-[#1A202C]"
        >
          <ArrowLeft className="size-[15px]" strokeWidth={1.5} aria-hidden="true" />
          All coaches
        </Link>

        <section className="flex w-full">
          <CoachHeader
            coach={coach}
            sport={normalizedCoachSport ?? (coach?.sport ?? "")}
            sportTheme={sportTheme}
            showStrengthMeter={false}
            onSendMessage={handleSendMessage}
            isSendingMessage={startingChat}
            canSendMessage={canSendMessage}
            onBook={() => {
              scrollToSection(availabilitySectionRef);
            }}
            bookAction={<BookSessionButton coachId={coach.id} coachName={coach.name} />}
            onViewPackages={() => {
              scrollToSection(packagesSectionRef);
            }}
          />
        </section>

        <section className="w-full scroll-mt-24" ref={availabilitySectionRef}>
          <CoachAvailabilitySection
            coachId={coach.id}
            allowEditing={false}
            onBookSlot={canBookSlots ? handleBookSlot : !user ? handleGuestSignInRedirect : undefined}
          />
        </section>

        <div className="grid w-full grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_317px]">
          <div className="flex min-w-0 flex-col gap-6">
            <section className="w-full scroll-mt-24" ref={packagesSectionRef}>
              <CoachingPackages
                packages={packages}
                coachId={coach.id}
                coachName={coach.name}
                coachSport={(coach as any)?.sport_type || coach.sport}
              />
            </section>

            <AboutSection coachName={coach.name} bio={coach.bio} />

            <CertificationsSection certifications={coach.certifications} />

            <TrainingSpecialization
              specializations={coach.specialties}
              sessionTypes={coach.session_types}
              locations={coach.locations}
            />

            <ReviewsSection
              averageRating={averageRating}
              totalReviews={totalReviews}
              distribution={ratingDistribution}
              reviews={reviews}
              iconColor={sportTheme.iconColor}
              publicDisplay
              onLeaveReview={() => setShowReviewModal(true)}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <QuickInfo
              responseTime={coach.response_time_hours}
              sessionTypes={coach.session_types}
              languages={coach.languages}
              locations={coach.locations}
              zipCode={coach.zip_code}
              cancellationPolicy={coach.cancellation_policy}
            />

            <FAQSection coachFaqs={normalizeCoachFaqs(coach.profile_faqs)} />

            <GearAndDealsCard
              coachId={coach.id}
              coachName={coach.name}
              links={coach.affiliate_links}
              dealsEnabled={coach.deals_enabled}
              brandNames={coachBrands.map((brand) => brand.name)}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      {coach && (
        <>
          <CoachSchedulingModal
            isOpen={showSchedulingModal}
            onClose={() => {
              setShowSchedulingModal(false);
              setSelectedSlotBooking(null);
            }}
            coach={coach}
            serviceType={serviceType}
            prefillSlot={selectedSlotBooking}
          />

          <ReviewModal
            open={showReviewModal}
            onOpenChange={setShowReviewModal}
            coachName={coach.name}
            onSubmit={submitReview}
          />

          <FreeConsultationInfoDialog
            isOpen={showFreeConsultInfo}
            onClose={() => setShowFreeConsultInfo(false)}
            onContinue={() => {
              setShowFreeConsultInfo(false);
              setSelectedSlotBooking(null);
              setServiceType(BookingType.FreeConsultation);
              setShowSchedulingModal(true);
            }}
            coachId={coach.id}
            coachName={coach.name}
            hourlyRate={coach.hourly_rate}
          />

          {showChatPanel && (
            <CoachChatPanel
              coach={coach}
              conversationId={chatConversationId ?? undefined}
              onClose={() => setShowChatPanel(false)}
            />
          )}
        </>
      )}
    </div>
  );
};

export default CoachProfile;
