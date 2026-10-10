/** Data the coach's own profile reads on top of the coach row. Every query tolerates a missing RPC. */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { coachProfileAPI, type CoachProfileExtras, type ProfileService } from "@/api/coachProfile";
import { reviewsAPI, type Review } from "@/api/reviews";
import { chatAPI } from "@/api/chat";
import { payoutsAPI } from "@/api/payouts";
import { scheduleSettingsAPI } from "@/api/scheduleSettings";
import { useCoachAvailabilityWithOccurrences } from "@/hooks/useCoachAvailabilityWithOccurrences";
import { useMyOrganization } from "@/hooks/useOrganizations";
import { ROUTES } from "@/routes";
import type { CoachProfileData } from "../CoachProfileView";
import { cancellationLine } from "./shared";

export const extrasKey = (coachId: string) => ["coach-profile-extras", coachId];
export const ownReviewsKey = (coachId: string) => ["coach-reviews-own", coachId];

export const useProfileExtras = (coachId: string) =>
  useQuery({
    queryKey: extrasKey(coachId),
    queryFn: () => coachProfileAPI.extras(coachId),
    enabled: Boolean(coachId),
    retry: false,
    staleTime: 60_000,
  });

/** Saves the session type list and updates the cached extras. Throws so callers can toast. */
export const useSaveServices = (coachId: string) => {
  const queryClient = useQueryClient();
  return async (next: ProfileService[]) => {
    await coachProfileAPI.setServices(next);
    queryClient.setQueryData<CoachProfileExtras | undefined>(extrasKey(coachId), (old) => (old ? { ...old, services: next } : old));
    void queryClient.invalidateQueries({ queryKey: extrasKey(coachId) });
  };
};

/** Full review rows, so coach_reply and athlete_age pass through (useReviews drops them). */
export const useOwnReviews = (coachId: string) =>
  useQuery({
    queryKey: ownReviewsKey(coachId),
    queryFn: async (): Promise<Review[]> => {
      const res = await reviewsAPI.getCoachReviews(coachId);
      if (res.error) throw res.error;
      return res.data ?? [];
    },
    enabled: Boolean(coachId),
    retry: false,
    staleTime: 60_000,
  });

export const useOwnChannels = (coachId: string) =>
  useQuery({
    queryKey: ["coach-channels", coachId, "owner"],
    queryFn: () => chatAPI.getCoachChannels(coachId),
    enabled: Boolean(coachId),
    retry: false,
    staleTime: 60_000,
  });

/** Booking rules shown under Sessions and pricing ("Free cancellation up to 24 hours before"). */
export const useBookingRules = () => {
  const { data } = useQuery({ queryKey: ["schedule-settings"], queryFn: () => scheduleSettingsAPI.get(), retry: false, staleTime: 5 * 60_000 });
  return {
    cancelHours: data?.cancelNoticeHours ?? 24,
    cancellation: cancellationLine(data?.cancelNoticeHours, data?.cancellationPolicy),
    windowWeeks: data?.bookingWindowWeeks ?? 4,
  };
};

/** The academy line in the hero: from the extras RPC, else the org this coach owns. */
export const useOwnOrganization = (extras: CoachProfileExtras | undefined) => {
  const { data: mine } = useMyOrganization();
  const org = extras?.organization ?? (mine ? { name: mine.name, slug: mine.slug, isOwner: true } : null);
  if (!org) return null;
  return { name: org.name, to: org.isOwner ? ROUTES.MY_ORGANIZATION : `/organizations/${org.slug}` };
};

export type StepName =
  | "Profile photo"
  | "Bio"
  | "Pillars and pricing"
  | "Availability"
  | "Background check"
  | "Payout details"
  | "Coaching video"
  | "Certifications";

/** The Working Copy's 8 completeness steps, from the data we have. */
export const useCompleteness = (coach: CoachProfileData & { image_url?: string | null; profile_image_url?: string | null }, extras: CoachProfileExtras | undefined) => {
  const payout = useQuery({ queryKey: ["payout-account"], queryFn: () => payoutsAPI.status(), retry: false, staleTime: 5 * 60_000 });
  const needsAvailabilityFallback = extras?.hasAvailability == null;
  const { data: windows } = useCoachAvailabilityWithOccurrences(needsAvailabilityFallback ? coach.id : null);
  const hasAvailability = extras?.hasAvailability ?? Boolean(windows?.length);
  const hourly = Number(coach.hourly_rate) || 0;
  const priced = hourly > 0 || Boolean(extras?.services.some((s) => s.on && s.price > 0));
  const steps: [StepName, boolean][] = [
    ["Profile photo", Boolean(coach.profile_image_url || coach.image_url)],
    ["Bio", Boolean(coach.bio?.trim())],
    ["Pillars and pricing", Boolean(coach.specialties?.length) && priced],
    ["Availability", hasAvailability],
    ["Background check", Boolean(coach.is_verified)],
    // Coaches who take payment themselves have nothing to connect.
    ["Payout details", coach.pay_mode === "self" || Boolean(payout.data?.connected && payout.data.transfersActive)],
    ["Coaching video", Boolean(extras?.coachingVideoUrl)],
    ["Certifications", Boolean(coach.certifications?.length)],
  ];
  return { steps, done: steps.filter(([, ok]) => ok).length, next: steps.find(([, ok]) => !ok)?.[0] ?? null };
};
