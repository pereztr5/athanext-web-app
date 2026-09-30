import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { chatAPI } from "@/api";
import { getInitials } from "@/utils/chatHelpers";

/** Members of a coach community channel (ATH-58). Athletes are listed as
 * first name + last initial with no photos; only the owner coach has one. */
export const CommunityMembersDialog = ({
  conversationId,
  open,
  onOpenChange,
}: {
  conversationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { data: members = [], isLoading, isError } = useQuery({
    queryKey: ["community-members", conversationId],
    enabled: open,
    queryFn: () => chatAPI.getCommunityMembers(conversationId),
    retry: false,
  });
  const memberCount = members.filter((member) => member.role !== "owner").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-md gap-4 overflow-y-auto font-sans tracking-[-0.03em] text-[#1A202C]">
        <div className="flex flex-col gap-1.5 pr-8 text-left">
          <DialogTitle className="text-[20px] font-semibold leading-[24px]">Community members</DialogTitle>
          <DialogDescription className="text-[14px] leading-[18px] text-[#767980]">
            {isLoading || isError ? "Everyone in this community." : `${memberCount} ${memberCount === 1 ? "member" : "members"}`}
          </DialogDescription>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-6 text-[#767980]">
            <Loader2 className="size-5 animate-spin" strokeWidth={1.5} />
          </div>
        ) : isError ? (
          <p className="text-[14px] leading-[18px] text-[#767980]">Couldn't load members. Please try again.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {members.map((member, index) => (
              <li key={`${member.role}-${member.displayName}-${index}`} className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E5EDF7] text-[12px] font-medium text-[#0054B4]">
                  {member.role === "owner" && member.avatarUrl ? (
                    <img src={member.avatarUrl} alt="" className="size-full object-cover" />
                  ) : (
                    getInitials(member.displayName)
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] leading-[18px]">
                  {member.displayName}
                  {member.isYou ? <span className="text-[#767980]"> (You)</span> : null}
                </span>
                {member.role === "owner" ? <span className="text-[12px] leading-[14px] text-[#767980]">Coach</span> : null}
              </li>
            ))}
            {memberCount === 0 ? (
              <li className="text-[14px] leading-[18px] text-[#767980]">No athletes have joined yet.</li>
            ) : null}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
};
