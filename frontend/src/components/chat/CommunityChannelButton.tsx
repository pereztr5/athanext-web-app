import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Users } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { chatAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ROUTES } from "@/routes";

/** Athlete-side Join / Open / Leave for a coach's community channel (ATH-21).
 * Shown for every coach; the channel is created on first join (ATH-53). */
export const CommunityChannelButton = ({ coachId }: { coachId: string }) => {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = ["coach-channel", coachId];
  // Wait for the profile so a coach never briefly sees "Join community".
  const isAthleteViewer = Boolean(user) && Boolean(userProfile) && !userProfile?.coach_id;

  const { data: channel, isLoading } = useQuery({
    queryKey,
    enabled: isAthleteViewer && Boolean(coachId),
    queryFn: () => chatAPI.getCoachChannel(coachId),
  });

  const membership = useMutation({
    mutationFn: async (join: boolean) => {
      if (join) return chatAPI.joinCoachChannel(coachId);
      if (channel) await chatAPI.leaveCoachChannel(channel.conversationId);
    },
    onSuccess: (conversationId, join) => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: join ? "Joined community" : "Left community",
        description: join ? "You'll find it in Messages." : "You won't see new posts from this channel.",
      });
      if (join && conversationId) navigate(`/chat?conversationId=${conversationId}`);
    },
    onError: (error) => {
      const message = (error as { message?: string })?.message ?? "";
      toast({
        title: "Something went wrong",
        description: message.includes("hasn't set up their community") ? message + "." : "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!user) {
    return (
      <div className="flex flex-wrap gap-[10px]">
        <Button variant="outline" onClick={() => navigate(`${ROUTES.AUTH}?mode=signin`, { state: { from: location } })}>
          <Users strokeWidth={1.5} />
          Sign in to join community
        </Button>
      </div>
    );
  }

  if (!isAthleteViewer || isLoading) return null;

  if (!channel?.isMember) {
    return (
      <div className="flex flex-wrap gap-[10px]">
        <Button variant="outline" disabled={membership.isPending} onClick={() => membership.mutate(true)}>
          {membership.isPending ? <Loader2 className="animate-spin" strokeWidth={1.5} /> : <Users strokeWidth={1.5} />}
          Join community
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-[10px]">
      <Button variant="outline" onClick={() => navigate(`/chat?conversationId=${channel.conversationId}`)}>
        <Users strokeWidth={1.5} />
        Open community
      </Button>
      <Button variant="ghost" disabled={membership.isPending} onClick={() => membership.mutate(false)}>
        Leave
      </Button>
    </div>
  );
};
