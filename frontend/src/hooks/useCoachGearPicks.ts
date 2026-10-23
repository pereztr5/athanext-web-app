import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gearPicksAPI } from "@/api/gearPicks";

export const coachGearPicksQueryKey = (coachId: string | undefined) => ["coach-gear-picks", coachId] as const;

/** A coach's picked store products (Shopify handles) in their order. Public. */
export const useCoachGearPicks = (coachId: string | undefined) =>
  useQuery({
    queryKey: coachGearPicksQueryKey(coachId),
    queryFn: () => gearPicksAPI.getCoachPicks(coachId!),
    enabled: Boolean(coachId),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

/** Saves the signed-in coach's picks and refreshes their cached list. */
export const useSaveMyGearPicks = (coachId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (handles: string[]) => gearPicksAPI.setMyPicks(handles),
    onSuccess: (saved) => queryClient.setQueryData(coachGearPicksQueryKey(coachId), saved),
  });
};
