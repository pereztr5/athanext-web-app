import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chatAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

/** Athlete-side Join / Open / Leave for a coach's community channel (ATH-21). */
export const CommunityChannelButton = ({ coachId }: { coachId: string }) => {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = ["coach-channel", coachId];
  // Wait for the profile so a coach never briefly sees "Join community".
  const isAthleteViewer = Boolean(user) && Boolean(userProfile) && !userProfile?.coach_id;

  const { data: channel } = useQuery({
    queryKey,
    enabled: isAthleteViewer && Boolean(coachId),
    queryFn: () => chatAPI.getCoachChannel(coachId),
  });

  const membership = useMutation({
    mutationFn: async (join: boolean) => {
      if (!channel) return;
      if (join) await chatAPI.joinCoachChannel(channel.conversationId);
      else await chatAPI.leaveCoachChannel(channel.conversationId);
    },
    onSuccess: (_data, join) => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: join ? "Joined community" : "Left community",
        description: join ? "You'll find it in Messages." : "You won't see new posts from this channel.",
      });
      if (join && channel) navigate(`/chat?conversationId=${channel.conversationId}`);
    },
    onError: () => {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    },
  });

  if (!isAthleteViewer || !channel) return null;

  if (!channel.isMember) {
    return (
      <Button variant="outline" disabled={membership.isPending} onClick={() => membership.mutate(true)}>
        {membership.isPending ? <Loader2 className="animate-spin" strokeWidth={1.5} /> : <Users strokeWidth={1.5} />}
        Join community
      </Button>
    );
  }

  return (
    <>
      <Button variant="outline" onClick={() => navigate(`/chat?conversationId=${channel.conversationId}`)}>
        <Users strokeWidth={1.5} />
        Open community
      </Button>
      <Button variant="ghost" disabled={membership.isPending} onClick={() => membership.mutate(false)}>
        Leave
      </Button>
    </>
  );
};
