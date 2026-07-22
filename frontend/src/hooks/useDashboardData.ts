import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMySessions } from "@/api/sessions";
import type { SessionUIModel } from "@/types/sessions-api";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";

export interface DashboardActivity {
  label: string;
  when: string; // ISO datetime for display formatting
}

export interface DashboardStats {
  completedCount: number;
  hoursTotal: number;
  thirdStat: number;
}

export function useDashboardData() {
  const { userProfile } = useAuth();
  const { isCoach } = useRole();
  const role: "coach" | "athlete" = isCoach ? "coach" : "athlete";
  const personaId = isCoach
    ? userProfile?.coach_id ?? null
    : userProfile?.athlete_id ?? userProfile?.id ?? null;

  const query = useQuery({
    queryKey: ["dashboard-sessions", role, personaId],
    queryFn: async () => {
      const { data, error } = await getMySessions(personaId as string, role);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: Boolean(personaId),
  });

  const sessions = useMemo(() => query.data ?? [], [query.data]);

  const derived = useMemo(() => {
    const upcoming = sessions
      .filter((s) => s.computedStatus === "upcoming" || s.computedStatus === "in-progress")
      .sort((a, b) => a.start.localeCompare(b.start));
    const finished = sessions
      .filter((s) => s.computedStatus === "past" || s.computedStatus === "completed")
      .sort((a, b) => b.end.localeCompare(a.end));

    const coachMap = new Map<string, SessionUIModel>();
    for (const s of sessions) {
      if (s.coachId && !coachMap.has(s.coachId)) coachMap.set(s.coachId, s);
    }

    const activities: DashboardActivity[] = [];
    if (finished[0]) {
      activities.push({
        label:
          role === "athlete"
            ? `Completed session${finished[0].coachName ? ` with ${finished[0].coachName}` : ""}`
            : "Completed session",
        when: finished[0].end,
      });
    }
    if (upcoming[0]) {
      activities.push({ label: "Booked session", when: upcoming[0].start });
    }

    const hoursTotal =
      Math.round(finished.reduce((sum, s) => sum + (s.durationMinutes || 0), 0) / 6) / 10;

    return {
      nextSession: upcoming[0] ?? null,
      upcoming: upcoming.slice(0, 2),
      stats: {
        completedCount: finished.length,
        hoursTotal,
        thirdStat: role === "coach" ? upcoming.length : coachMap.size,
      } satisfies DashboardStats,
      activities,
      coaches: Array.from(coachMap.values()).slice(0, 3),
    };
  }, [sessions, role]);

  return { isLoading: query.isLoading, error: query.error, ...derived };
}
