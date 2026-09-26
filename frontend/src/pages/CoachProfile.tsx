import { useRef, useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { COACH_PROFILE_THEMES } from "@/config/colors";
import { useCoachDetails } from "@/hooks/useCoachDetails";
import { useCoachPackages } from "@/hooks/useCoachPackages";
import { Home } from "lucide-react";
import CoachSchedulingModal from "@/components/coach/CoachSchedulingModal";
import { ReviewModal } from "@/components/reviews/ReviewModal";
import { FreeConsultationInfoDialog } from "@/components/coach/FreeConsultationInfoDialog";
import { useReviews } from "@/hooks/useReviews";
import { BookingType } from "@/types/common";
import { CoachAvailabilitySlot } from "@/types/availability";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import {
  CoachHeader,
  AboutSection,
  CertificationsSection,
  TrainingSpecialization,
  ReviewsSection,
  QuickInfo,
  FAQSection,
  OtherTopCoaches
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
import { ROUTES } from "@/routes";

const CoachProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, userProfile } = useAuth();

  const resolvedCoachId =
    id ||
    (typeof (userProfile as any)?.coach_id === "string" ? (userProfile as any).coach_id : "") ||
    (typeof (user?.user_metadata as any)?.coach_id === "string" ? (user?.user_metadata as any).coach_id : "");

  const { coach, loading, error } = useCoachDetails(resolvedCoachId);
  const { data: packages = [], isLoading: packagesLoading } = useCoachPackages(resolvedCoachId);
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
  const { reviews = [], averageRating = 0, ratingDistribution = {}, totalReviews = 0 } = useReviews(id);
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
    if (!loading && coach && location.state && ((location.state as any).scrollToAvailability || (location.state as any).scrollTo === "availability")) {
      scrollToSection(availabilitySectionRef);
    } else if (!loading && coach && location.state && ((location.state as any).scrollToPackages || (location.state as any).scrollTo === "packages")) {
      scrollToSection(packagesSectionRef);
    }
  }, [loading, coach, location.state, scrollToSection]);

  // Sport detection for dynamic theming
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
        title: "Coach to Coach messaging is not currently available.",
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
    const loadingTheme = getSportTheme();
    return (
      <div className={`min-h-screen bg-gradient-to-br ${loadingTheme.gradientFrom} via-slate-50/30 ${loadingTheme.gradientTo} dark:from-slate-900 dark:via-slate-950/30 dark:to-slate-950/20 mt-[3.8rem]`}>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-lg mb-8 w-48"></div>
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
              </div>
              <div className="space-y-6">
                <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!coach) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${sportTheme.gradientFrom} via-slate-50/30 ${sportTheme.gradientTo} dark:from-slate-900 dark:via-slate-950/30 dark:to-slate-950/20 flex items-center justify-center`}>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Coach Not Found</h1>
        </div>
      </div>
    );
  }

  function submitReview(rating: number, reviewText: string): Promise<{ error: Error; }> {
    throw new Error("Function not implemented.");
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden bg-app-background">
        <CoachProfileView
          readOnly
          coach={coach as any}
          packages={packages}
          averageRating={averageRating > 0 ? averageRating : coach.rating || 0}
          totalReviews={totalReviews}
          ratingDistribution={ratingDistribution}
          reviews={reviews}
          onEdit={() => undefined}
          onEditPackages={() => undefined}
          onEditCertifications={() => undefined}
          availability={
            <div ref={availabilitySectionRef}>
              <CoachAvailabilitySection
                coachId={coach.id}
                allowEditing={false}
                onBookSlot={canBookSlots ? handleBookSlot : !user ? handleGuestSignInRedirect : undefined}
              />
            </div>
          }
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
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen w-full overflow-x-hidden px-4 pb-20 md:px-0 ${
        isAuthenticated
          ? "bg-app-background pt-2"
          : `bg-gradient-to-br ${sportTheme.gradientFrom} via-slate-50/30 ${sportTheme.gradientTo} dark:from-slate-900 dark:via-slate-950/30 dark:to-slate-950/20 mt-[3.8rem] mb-20`
      }`}
    >
      <div className="mx-auto flex max-w-[1000px] flex-col gap-6 md:gap-6">

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
            onViewPackages={() => {
              scrollToSection(packagesSectionRef);
            }}
          />
        </section>

        <section className="w-full" ref={availabilitySectionRef}>
          <CoachAvailabilitySection
            coachId={coach.id}
            allowEditing={false}
            iconColor={sportTheme.iconColor}
            onBookSlot={canBookSlots ? handleBookSlot : !user ? handleGuestSignInRedirect : undefined}
          />
        </section>

        <div className="flex flex-col lg:flex-row gap-6 md:gap-8">
          {/* Main Content */}

          <div className="min-w-0 lg:flex-1 space-y-6">
            <section className="w-full" ref={packagesSectionRef}>
              <CoachingPackages
                packages={packages}
                coachId={coach.id}
                coachName={coach.name}
                coachSport={(coach as any)?.sport_type || coach.sport}
                iconColor={sportTheme.iconColor}
              />
            </section>

            {/* About Section */}
            <AboutSection
              coachName={coach.name}
              bio={coach.bio}
              iconColor={sportTheme.iconColor}
            />

            {/* Certifications & Credentials */}
            <CertificationsSection
              certifications={coach.certifications}
              iconColor={sportTheme.iconColor}
              certBg={sportTheme.certBg}
              certIcon={sportTheme.certIcon}
            />

            {/* Training Specialization + Format */}
            <TrainingSpecialization
              specializations={coach.specialties}
              trainingFormats={{
                inPerson: true,
                virtual: true,
                individualSessions: true,
                groupSessions: true
              }}
              locations={coach.locations}
              iconColor={sportTheme.iconColor}
            />

            {/* Reviews Section */}
            <ReviewsSection
              averageRating={averageRating > 0 ? averageRating : coach.rating || 0}
              totalReviews={totalReviews}
              distribution={ratingDistribution}
              reviews={reviews}
              iconColor={sportTheme.iconColor}
              onLeaveReview={() => setShowReviewModal(true)}
            />
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-[22rem] flex-shrink-0 space-y-6 md:space-y-8">
            {/* Quick Info */}
            <QuickInfo
              responseTime={coach.response_time_hours}
              sessionTypes={coach.session_types}
              languages={coach.languages}
              locations={coach.locations}
              zipCode={coach.zip_code}
              cancellationPolicy={coach.cancellation_policy}
            />

            {/* FAQ Section */}
            <FAQSection />
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
