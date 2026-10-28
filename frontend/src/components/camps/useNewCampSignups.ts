/**
 * New camp sign-ups for the signed-in coach: the Camps nav count and Home's "2 new sign-ups".
 * Opening Camps or "Mark all read" in the bell clears them (see markCampSignupsSeen).
 */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { campsAPI } from "@/api/camps";
import type { AppNotification } from "@/api/notifications";
import { NO_NEW_CAMP_SIGNUPS, type NewCampSignups } from "@/utils/campSignupAlerts";

export const NEW_CAMP_SIGNUPS_KEY = ["new-camp-signups"] as const;

export const useNewCampSignups = (enabled = true) => {
  const query = useQuery({
    queryKey: NEW_CAMP_SIGNUPS_KEY,
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
    queryFn: () => campsAPI.newSignups(),
  });
  return query.data ?? NO_NEW_CAMP_SIGNUPS;
};

/**
 * Camps page: keeps the counts it opened with (so each camp still shows "2 new" while the
 * coach looks), then marks them read so the nav count, Home and the bell clear.
 */
export const useSeeNewCampSignups = (enabled: boolean): NewCampSignups => {
  const queryClient = useQueryClient();
  const [seen, setSeen] = useState<NewCampSignups>(NO_NEW_CAMP_SIGNUPS);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void campsAPI
      .newSignups()
      .then((counts) => {
        if (cancelled) return;
        setSeen(counts);
        // Also clear unread camp items in the bell (refunds aren't counted as sign-ups).
        const unreadInBell = queryClient
          .getQueriesData<AppNotification[]>({ queryKey: ["notifications"] })
          .some(([, list]) => list?.some((n) => n.kind === "camp" && n.unread));
        if (!counts.total && !unreadInBell) return;
        return campsAPI.markSignupsSeen().then(() => {
          void queryClient.invalidateQueries({ queryKey: NEW_CAMP_SIGNUPS_KEY });
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled, queryClient]);
  return seen;
};
