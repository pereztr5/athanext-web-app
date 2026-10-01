import { useQuery } from "@tanstack/react-query";
import { brandsAPI } from "@/api/brands";

export const BRANDS_QUERY_KEY = ["brands"] as const;
export const coachBrandsQueryKey = (coachId: string | undefined) => ["coach-brands", coachId] as const;

/** All brands, for the coach's brand picker. */
export const useBrands = (enabled = true) =>
  useQuery({
    queryKey: BRANDS_QUERY_KEY,
    queryFn: brandsAPI.listBrands,
    enabled,
  });

/** A coach's brands in display order (public). */
export const useCoachBrands = (coachId: string | undefined) =>
  useQuery({
    queryKey: coachBrandsQueryKey(coachId),
    queryFn: () => brandsAPI.getCoachBrands(coachId!),
    enabled: Boolean(coachId),
  });

/** Brands of many coaches in one query, keyed by coach id. */
export const useBrandsByCoach = (coachIds: string[]) =>
  useQuery({
    queryKey: ["brands-by-coach", [...coachIds].sort()],
    queryFn: () => brandsAPI.getBrandsByCoach(coachIds),
    enabled: coachIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
