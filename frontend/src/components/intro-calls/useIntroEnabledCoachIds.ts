import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { introCallsAPI } from "@/api/introCalls";
import { INTRO_KEYS } from "./helpers";

/** Coaches with free intro calls on, for the Browse pill. Empty while loading or if it fails. */
export const useIntroEnabledCoachIds = (): Set<string> => {
  const query = useQuery({
    queryKey: INTRO_KEYS.enabled,
    queryFn: () => introCallsAPI.enabledCoachIds(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return useMemo(() => new Set(query.data ?? []), [query.data]);
};
