/** Monthly group passes the family can cancel (stops the next renewal). */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { packagesAPI } from "@/api/packages";
import { secondaryButton, smallButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { plural } from "@/utils/schedule";

export const RenewingPackages = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [canceling, setCanceling] = useState<string | null>(null);
  const packages = useQuery({
    queryKey: ["my-packages"],
    queryFn: async () => {
      const res = await packagesAPI.getMyPackages();
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
    staleTime: 60_000,
  });

  const renewing = (packages.data ?? []).filter(
    (p) => p.stripe_subscription_id && (p.status === "active" || p.status === "trialing"),
  );

  const cancel = useMutation({
    mutationFn: (id: string) => packagesAPI.cancelSubscription(id),
    onSuccess: (_, id) => {
      toast({
        title: "Renewal cancelled",
        description: "You'll keep access until the end of the current period. Then it won't renew.",
      });
      setCanceling(null);
      void queryClient.invalidateQueries({ queryKey: ["my-packages"] });
      void id;
    },
    onError: (err) => {
      toast({
        title: "Couldn't cancel renewal",
        description: err instanceof Error ? err.message : "Try again in a moment.",
        variant: "destructive",
      });
      setCanceling(null);
    },
  });

  if (!renewing.length) return null;

  return (
    <section className="flex flex-col gap-2 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-4 py-3">
      <span className="text-[12px] font-medium leading-[14px] text-[#767980]">Monthly packages</span>
      {renewing.map((p) => (
        <div key={p.id} className="flex items-center justify-between gap-3">
          <span className="min-w-0 text-[14px] leading-[18px]">
            {p.status === "trialing"
              ? "Renews monthly · no credits yet"
              : `${plural(p.sessions_remaining, "credit")} left`}
            {p.expiry_date ? (
              <span className="text-[#767980]">
                {" "}
                · through {new Date(p.expiry_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            ) : null}
          </span>
          <button
            type="button"
            className={cn(secondaryButton, smallButton)}
            disabled={canceling !== null || cancel.isPending}
            onClick={() => {
              setCanceling(p.id);
              cancel.mutate(p.id);
            }}
          >
            {canceling === p.id ? "Cancelling…" : "Cancel renewal"}
          </button>
        </div>
      ))}
    </section>
  );
};
