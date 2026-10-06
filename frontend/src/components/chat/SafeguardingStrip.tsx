import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Safeguard = { athlete_first: string; holder_name: string; viewer_is_family: boolean; held_by_parent: boolean };

/**
 * Under-18 safeguarding strip (ATH-98) for one-to-one chats with a family whose athlete is
 * under 18. Says who is in the conversation; renders nothing otherwise.
 */
export const SafeguardingStrip = ({ conversationId }: { conversationId: string }) => {
  const { data } = useQuery({
    queryKey: ["conversation-safeguard", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_conversation_safeguard", { p_conversation_id: conversationId });
      if (error) throw error;
      return (data ?? null) as Safeguard | null;
    },
    staleTime: 5 * 60_000,
  });
  if (!data) return null;

  const first = data.athlete_first;
  const text = data.held_by_parent
    ? data.viewer_is_family
      ? `${first} is under 18, so you're part of every message with coaches about ${first}.`
      : `${first} is under 18. You're messaging ${data.holder_name}, ${first}'s parent or guardian, who is part of every message about ${first}.`
    : data.viewer_is_family
      ? "You're under 18. Keep messages with coaches to sessions and training."
      : `${first} is under 18. Keep messages to sessions and training.`;

  return (
    <div className="flex items-start gap-2 border-b border-[#EAEADF] bg-[#E5EDF7] px-4 py-2 text-[12px] leading-[16px] text-[#00326C]">
      <ShieldCheck className="mt-[1px] size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
};
