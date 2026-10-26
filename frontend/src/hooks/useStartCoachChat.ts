import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { chatAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { buildId } from "@/utils/chatHelpers";

/** Opens (or starts) the family's direct chat with a coach, then goes to Messages. */
export const useStartCoachChat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [starting, setStarting] = useState(false);

  const start = async (coachId: string, title: string) => {
    if (!user) {
      navigate("/auth?mode=signin");
      return;
    }
    setStarting(true);
    try {
      const { data: coachProfile, error: profileError } = await chatAPI.getCoachUserProfile(coachId);
      if (profileError || !coachProfile?.id) {
        toast({
          title: "Can't open chat",
          description: "This coach hasn't finished account setup yet.",
          variant: "destructive",
        });
        return;
      }
      const { data: existing, error: existingError } = await chatAPI.findConversationBetweenUsers(user.id, coachProfile.id);
      if (existingError) throw existingError;
      let conversationId = existing?.id || null;
      if (!conversationId) {
        conversationId = buildId();
        // Leave last_message_at null until the first real message so email notify fires.
        const { error } = await chatAPI.createConversation({
          id: conversationId,
          created_by: user.id,
          title,
          is_group: false,
        });
        if (error) throw error;
        const { error: participantsError } = await chatAPI.addParticipants([
          { conversation_id: conversationId, user_id: user.id, role: "owner" },
          { conversation_id: conversationId, user_id: coachProfile.id, role: "member" },
        ]);
        if (participantsError) throw participantsError;
      }
      navigate(`/chat?conversationId=${conversationId}`);
    } catch {
      toast({ title: "Unable to open chat", description: "Please try again later.", variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  return { start, starting };
};
