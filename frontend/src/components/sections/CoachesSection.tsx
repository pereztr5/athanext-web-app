import { useState } from "react";
import CoachCard from "../coach/CoachCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { PublicCoach } from "@/hooks/useCoaches";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import CoachSchedulingModal from "@/components/coach/CoachSchedulingModal";
import CoachChatPanel from "@/components/chat/CoachChatPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { chatAPI } from "@/api";
import type { Coach } from "@/types/coachProfile";
import { buildId } from "@/utils/chatHelpers";

interface CoachesSectionProps {
  coaches: PublicCoach[];
  coachesLoading: boolean;
  onViewProfile: (coachId: string) => void;
  onSession?: (coachId: string) => void;
  onViewPackages?: (coachId: string) => void;
}

export const CoachesSection = ({
  coaches,
  coachesLoading,
  onViewProfile,
  onSession,
  onViewPackages,
}: CoachesSectionProps) => {
  const [selectedCoach, setSelectedCoach] = useState<PublicCoach | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [chatCoach, setChatCoach] = useState<Coach | null>(null);
  const [chatConversationId, setChatConversationId] = useState<string | null>(null);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [sendingMessageFor, setSendingMessageFor] = useState<string | null>(null);
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const personaType =
    (userProfile as any)?.persona_type || (user?.user_metadata as any)?.persona_type || null;

  // Normalize hourly rates to be between $120-200
  const getNormalizedRate = (rate: number | null): number => {
    if (!rate) return 150;

    // If rate seems to be in cents (> 1000), convert to dollars
    const dollarRate = rate > 1000 ? rate / 100 : rate;

    // Clamp between 120 and 200
    return Math.max(120, Math.min(200, Math.round(dollarRate)));
  };

  const handleBookSession = (coach: PublicCoach) => {
    setSelectedCoach(coach);
    setIsModalOpen(true);
  };

  const normalizeCoachForChat = (coach: PublicCoach): Coach => ({
    id: coach.id,
    name: coach.name ?? "Coach",
    coach_position: (coach as any).position ?? coach.coach_position,
    position: (coach as any).position ?? undefined,
    company: coach.company ?? undefined,
    specialties: coach.specialties ?? [],
    image_url: (coach as any).image_url ?? (coach as any).profile_image_url ?? undefined,
    rating: coach.rating ?? undefined,
    total_reviews: coach.total_reviews ?? undefined,
    locations: coach.locations ?? [],
    years_experience: coach.years_experience ?? undefined,
    sport: (coach as any).sport ?? undefined,
    hourly_rate: coach.hourly_rate ?? undefined,
  });

  const handleSendMessage = async (coach: PublicCoach) => {
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

  const handleViewPackagesClick = (coachId: string) => {
    if (onViewPackages) {
      onViewPackages(coachId);
      return;
    }
    navigate(`/coach/${coachId}`, { state: { scrollToPackages: true } });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCoach(null);
  };

  return (
    <>
      <section
        data-section="coaches"
        aria-labelledby="coaches-heading"
        className="py-16 bg-gradient-to-br from-slate-50/80 via-blue-50/60 to-slate-100/70 dark:from-slate-900/80 dark:via-blue-900/60 dark:to-slate-800/70  px-4"
      >
        <div className="max-w-8xl mx-auto">
          <div className="text-center mb-12">
            <h2
              id="coaches-heading"
              className="text-2xl sm:text-4xl lg:text-5xl font-bold text-slate-800 dark:text-slate-200 mb-4"
            >
              Meet Our Elite Coaches
            </h2>
            <p className="text-xs sm:text-lg text-muted-foreground max-w-3xl mx-auto">
              Work with former professionals and certified experts who understand what it takes to excel
            </p>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8 mb-12 items-stretch">
            {coachesLoading ? (
              // Loading skeleton
              [...Array(3)].map((_, index) => (
                <Card key={index} className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      <Skeleton className="w-16 h-16 rounded-full mr-4" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-24 mb-1" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : coaches?.length === 0 ? (
              // No coaches message
              <div className="col-span-full text-center py-12">
                <p className="text-muted-foreground text-lg">No coaches available at the moment.</p>
                <p className="text-muted-foreground text-sm mt-2">Please check back soon!</p>
              </div>
            ) : (
              // Real coaches data - sort to put Ronald left, Henry center, Cata right, then show only first 3
              coaches
                ?.filter(coach => coach.is_verified)
                .slice(0, 3)
                .map((coach, index) => (
                  <CoachCard
                    key={coach.id}
                    coach={coach}
                    onViewProfile={onViewProfile}
                    onSession={onSession}
                    onViewPackages={() => handleViewPackagesClick(coach.id)}
                    onSendMessage={handleSendMessage}
                    disableSendMessage={false}
                    isSendingMessage={sendingMessageFor === coach.id}
                  />
                ))
            )}
          </div>
          {!coachesLoading && coaches?.length > 0 && (
            <div className="flex justify-center">
              <Button
                size="lg"
                className="animate-fade-in hover-scale"
                onClick={() => navigate("/coaches")}
              >
                View All Coaches
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Booking Modal */}
      {selectedCoach && (
        <CoachSchedulingModal
          coach={{
            id: selectedCoach.id,
            name: selectedCoach.name || 'Unknown Coach',
            company: selectedCoach.company || undefined,
            locations: selectedCoach.locations || [],
            specialties: selectedCoach.specialties || [],
            hourly_rate: getNormalizedRate(selectedCoach.hourly_rate) * 100, // Convert back to cents for modal
            bio: selectedCoach.bio || undefined
          }}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          serviceType={selectedCoach.specialties?.[0] || 'Coaching Session'}
        />
      )}

      {showChatPanel && chatCoach && (
        <CoachChatPanel
          coach={chatCoach}
          conversationId={chatConversationId ?? undefined}
          onClose={() => setShowChatPanel(false)}
        />
      )}
    </>
  );
};
