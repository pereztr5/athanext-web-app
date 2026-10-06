import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Hash, Loader2 } from "lucide-react";
import { chatAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

/**
 * A coach's group chat on their profile (ATH-95), right under Book and Message. Families join
 * to get open spots and updates; joining adds them to the channel in Messages. Only signed-in
 * athletes and parents see it.
 */
export const GroupChatsCard = ({ coachId, coachFirst }: { coachId: string; coachFirst: string }) => {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isFamily = Boolean(user) && Boolean(userProfile) && !userProfile?.coach_id;
  const queryKey = ["coach-channel", coachId];

  const { data: channel, isLoading } = useQuery({
    queryKey,
    enabled: isFamily && Boolean(coachId),
    queryFn: () => chatAPI.getCoachChannel(coachId),
  });

  const join = useMutation({
    mutationFn: () => chatAPI.joinCoachChannel(coachId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Joined", description: "You'll find it in Messages." });
    },
    onError: (error) => {
      const message = (error as { message?: string })?.message ?? "";
      toast({
        title: "Couldn't join",
        description: message.includes("hasn't set up") ? `${message}.` : "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!isFamily || isLoading) return null;

  const title = channel?.title || `${coachFirst}'s group chat`;
  const members = channel?.memberCount ?? 0;

  return (
    <div className="flex flex-col gap-2 border-t border-[#EAEADF] pt-4">
      <span className="inline-flex items-center gap-1 text-[12px] font-medium leading-[14px] text-[#767980]">
        <Hash className="size-3" strokeWidth={1.75} aria-hidden="true" />
        Group chats · get open spots and updates from {coachFirst}
      </span>
      <div className="flex items-center gap-3 rounded-[8px] border border-[#EAEADF] bg-[#F9F9F5] px-3 py-2.5">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-[#E5EDF7] text-[#0054B4]">
          <Hash className="size-4" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="truncate text-[14px] font-medium text-[#1A202C]">{title}</b>
          {members ? <span className="text-[12px] text-[#767980]">{members} {members === 1 ? "family" : "families"}</span> : null}
        </span>
        {channel?.isMember ? (
          <button
            type="button"
            onClick={() => navigate(`/chat?conversationId=${channel.conversationId}`)}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-[#EAEADF] bg-[#F4F4EB] px-3 text-[13px] font-medium text-[#1A202C] hover:bg-[#EAEADF]"
          >
            <Check className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            Joined
          </button>
        ) : (
          <button
            type="button"
            onClick={() => join.mutate()}
            disabled={join.isPending}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-[#0054B4] px-3 text-[13px] font-medium text-white hover:bg-[#004390] disabled:opacity-50"
          >
            {join.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
            Join
          </button>
        )}
      </div>
    </div>
  );
};
