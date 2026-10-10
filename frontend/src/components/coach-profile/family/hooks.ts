import { useQuery } from "@tanstack/react-query";
import { athleteHomeAPI } from "@/api/athleteHome";
import { chatAPI, reviewsAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { coachProfileAPI, type CoachProfileExtras } from "@/api/coachProfile";
import type { Review } from "@/api/reviews";
import { useRole } from "@/hooks/useRole";

/** Full review rows for the family view, so reply and age fields pass through untouched. */
export const useFamilyReviews = (coachId: string | undefined) =>
  useQuery({
    queryKey: ["coach-reviews-family", coachId],
    enabled: Boolean(coachId),
    queryFn: async (): Promise<Review[]> => {
      const res = await reviewsAPI.getCoachReviews(coachId as string);
      if (res.error) return [];
      return res.data ?? [];
    },
    staleTime: 60_000,
  });

/** Session types, most booked package and academy. Null until the RPC exists or when it fails. */
export const useCoachExtras = (coachId: string | undefined) =>
  useQuery({
    queryKey: ["coach-profile-extras-family", coachId],
    enabled: Boolean(coachId),
    queryFn: async (): Promise<CoachProfileExtras | null> => {
      try {
        return await coachProfileAPI.extras(coachId as string);
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 60_000,
  }).data ?? null;

/** A coach's open group chats. Only signed-in athletes and parents load them. */
export const useFamilyCoachChannels = (coachId: string) => {
  const { user, userProfile } = useAuth();
  const isFamily = Boolean(user) && Boolean(userProfile) && !userProfile?.coach_id;
  const query = useQuery({
    queryKey: ["coach-channels", coachId],
    enabled: isFamily && Boolean(coachId),
    queryFn: () => chatAPI.getCoachChannels(coachId),
  });
  return { channels: isFamily ? query.data ?? [] : [], isFamily };
};

/** True when this family already trains with the coach (same source as Browse's "Your coach"). */
export const useIsMyCoach = (coachId: string | undefined) => {
  const { isAthleteLike } = useRole();
  const { data } = useQuery({ queryKey: ["athlete-home"], queryFn: () => athleteHomeAPI.get(), enabled: isAthleteLike });
  return Boolean(coachId && data?.coaches.some((c) => c.id === coachId));
};
