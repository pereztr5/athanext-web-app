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
  /** Athlete: all-time completed. Coach: completed this calendar month. */
  completedCount: number;
  /** Athlete: hours trained. Coach: unused when revenue is shown. */
  hoursTotal: number;
  /** Athlete: unique coaches. Coach: unique athletes on roster. */
  thirdStat: number;
  /** Coach only — null when no revenue source is wired. */
  revenueThisMonth: number | null;
  sessionsThisMonth: number;
  activeAthletes: number;
}

function isSameMonth(iso: string, now = new Date()) {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
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

    const athleteMap = new Map<string, { name: string; type?: string }>();
    for (const s of sessions) {
      if (Array.isArray(s.athleteNames)) {
        for (const name of s.athleteNames) {
          if (name && !athleteMap.has(name)) {
            athleteMap.set(name, { name, type: s.type });
          }
        }
      }
    }

    const finishedThisMonth = finished.filter((s) => isSameMonth(s.end));
    const sessionsThisMonth = finishedThisMonth.length;

    const activities: DashboardActivity[] = [];
    if (finished[0]) {
      const withWhom =
        role === "athlete"
          ? finished[0].coachName
          : finished[0].athleteNames?.[0];
      activities.push({
        label: withWhom
          ? `Completed session with ${withWhom}`
          : "Completed session",
        when: finished[0].end,
      });
    }
    if (upcoming[0]) {
      if (role === "coach") {
        const who = upcoming[0].athleteNames?.[0];
        activities.push({
          label: who ? `New booking from ${who}` : "New booking",
          when: upcoming[0].start,
        });
      } else {
        activities.push({ label: "Booked session", when: upcoming[0].start });
      }
    }

    const hoursTotal =
      Math.round(finished.reduce((sum, s) => sum + (s.durationMinutes || 0), 0) / 6) / 10;

    return {
      nextSession: upcoming[0] ?? null,
      upcoming: upcoming.slice(0, 2),
      stats: {
        completedCount: role === "coach" ? sessionsThisMonth : finished.length,
        hoursTotal,
        thirdStat: role === "coach" ? athleteMap.size : coachMap.size,
        revenueThisMonth: null,
        sessionsThisMonth,
        activeAthletes: athleteMap.size,
      } satisfies DashboardStats,
      activities,
      coaches: Array.from(coachMap.values()).slice(0, 3),
      athletes: Array.from(athleteMap.values()).slice(0, 4),
    };
  }, [sessions, role]);

  return { isLoading: query.isLoading, error: query.error, sessions, ...derived };
}
