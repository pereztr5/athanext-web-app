/**
 * Shown on every signed-in page while the account is scheduled for deletion, so "sign in and
 * choose Keep my account" (the deletion email) is true wherever the person lands.
 */
import { useMutation } from "@tanstack/react-query";
import { userProfilesAPI } from "@/api";
import { sendAccountEmail } from "@/api/accountEmails";
import { primaryButton } from "@/components/schedule/styles";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatDeletionDate } from "@/utils/accountDeletion";

export const AccountDeletionBanner = ({ className }: { className?: string }) => {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  const requestedAt = (userProfile as { deletion_requested_at?: string | null } | null)?.deletion_requested_at;

  const keep = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sign in again");
      const { error } = await userProfilesAPI.updateUserProfile(user.id, { deletion_requested_at: null });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await refreshUserProfile();
      void sendAccountEmail("deletion_cancelled");
      toast({ title: "Your account is staying", description: "Nothing will be deleted." });
    },
    onError: () => toast({ title: "Couldn't keep your account", description: "Try again.", variant: "destructive" }),
  });

  if (!requestedAt) return null;
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-error-300 bg-error-50 px-4 py-3">
        <span className="text-body-m text-error-700">
          <b className="font-medium">This account will be deleted on {formatDeletionDate(requestedAt)}.</b> Changed your mind? Keep it and
          nothing is deleted.
        </span>
        <button type="button" className={primaryButton} disabled={keep.isPending} onClick={() => keep.mutate()}>
          {keep.isPending ? "Saving…" : "Keep my account"}
        </button>
      </div>
    </div>
  );
};
