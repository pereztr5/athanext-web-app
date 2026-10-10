import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { chatAPI } from "@/api";
import { secondaryButton, smallButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { useFamilyCoachChannels } from "./family/hooks";

type Channel = ReturnType<typeof useFamilyCoachChannels>["channels"][number];

/**
 * Group chat rows inside the profile's More list (Working Copy `sp2-more` chat item):
 * "#title", "N families · about", and Join or Joined. Joining adds the family in Messages.
 */
export const GroupChatRows = ({ coachId, channels }: { coachId: string; channels: Channel[] }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const join = useMutation({
    mutationFn: (conversationId: string) => chatAPI.joinChannel(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-channels", coachId] });
      queryClient.invalidateQueries({ queryKey: ["coach-channel", coachId] });
      toast({ title: "Joined", description: "You'll find it in Messages." });
    },
    onError: () => toast({ title: "Couldn't join", description: "Please try again.", variant: "destructive" }),
  });

  return (
    <>
      {channels.map((channel) => (
        <div key={channel.conversationId} className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-[14px] font-medium leading-[18px] text-[#1A202C]">#{channel.title || "group-chat"}</span>
            <span className="truncate text-[12px] leading-[14px] text-[#767980]">
              {[`${channel.memberCount} ${channel.memberCount === 1 ? "family" : "families"}`, channel.description ?? ""].filter(Boolean).join(" · ")}
            </span>
          </span>
          {channel.isMember ? (
            <button
              type="button"
              onClick={() => navigate(`/chat?conversationId=${channel.conversationId}`)}
              className={cn(secondaryButton, smallButton, "shrink-0")}
            >
              <Check strokeWidth={1.75} aria-hidden="true" />
              Joined
            </button>
          ) : (
            <button
              type="button"
              onClick={() => join.mutate(channel.conversationId)}
              disabled={join.isPending}
              className={cn(secondaryButton, smallButton, "shrink-0")}
            >
              {join.isPending && join.variables === channel.conversationId ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Join
            </button>
          )}
        </div>
      ))}
    </>
  );
};
