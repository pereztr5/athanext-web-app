import { useToast } from "@/hooks/use-toast";

export const useCopyInviteLink = () => {
  const { toast } = useToast();
  return async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Invite link copied", description: "Send it to your client. It works for 14 days." });
    } catch {
      toast({ title: "Copy failed", description: link, variant: "destructive" });
    }
  };
};
