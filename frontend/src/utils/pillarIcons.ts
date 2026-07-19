import { Activity, Video, Users, Dumbbell, Pencil, MessageCircle, MapPin, Building2, Ship, Trophy, Calendar } from "lucide-react";
import type { Enums } from "@/integrations/supabase/types";
import type { SPORTPILLARS } from "@/api/sport-pillars";

export type SportKey = "soccer" | "rowing";

export const ICON_MAP = {
  activity: Activity,
  video: Video,
  users: Users,
  dumbbell: Dumbbell,
  pencil: Pencil,
  messagecircle: MessageCircle,
  mappin: MapPin,
  building2: Building2,
  ship: Ship,
  trophy: Trophy,
  calendar: Calendar,
} as const;

export type IconKey = keyof typeof ICON_MAP;

export const DEFAULT_PILLARS: Record<SportKey, { title: string; iconKey: IconKey }[]> = {
  soccer: [
    { title: "On Field Training", iconKey: "activity" },
    { title: "Video Analysis", iconKey: "video" },
    { title: "Mentorship", iconKey: "users" },
    { title: "Strength + Conditioning", iconKey: "dumbbell" },
    { title: "Academic Tutoring", iconKey: "pencil" },
    { title: "College Recruiting", iconKey: "trophy" },
  ],
  rowing: [
    { title: "Technical Development", iconKey: "ship" },
    { title: "Race Preparation", iconKey: "activity" },
    { title: "Mentorship", iconKey: "users" },
    { title: "Strength + Conditioning", iconKey: "dumbbell" },
    { title: "Academic Tutoring", iconKey: "pencil" },
    { title: "College Recruiting", iconKey: "trophy" },
  ],
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const resolvePillarIcon = (
  pillarName: string | null | undefined,
  sport: Enums<"sport_type"> | undefined,
  sportPillars?: SPORTPILLARS[] | null
) => {
  if (!pillarName) return null;
  const normalizedName = normalize(pillarName);
  const normalizedTargets = [normalizedName];

  const matchFromSportPillars = (sportPillars || []).find((pillar) => {
    if (!pillar?.title) return false;
    const normalizedTitle = normalize(pillar.title);
    return normalizedTargets.some((target) => normalizedTitle === target);
  });

  if (matchFromSportPillars?.icon) {
    const key = matchFromSportPillars.icon.toLowerCase() as IconKey;
    return ICON_MAP[key] ?? null;
  }

  const sportKey: SportKey | null =
    sport === "soccer" ? "soccer" : sport === "rowing" ? "rowing" : null;

  if (sportKey) {
    const fallbackMatch = DEFAULT_PILLARS[sportKey].find((pillar) => {
      const normalizedTitle = normalize(pillar.title);
      return normalizedTargets.some((target) => normalizedTitle === target);
    });
    if (fallbackMatch) {
      return ICON_MAP[fallbackMatch.iconKey] ?? null;
    }
  }

  return null;
};

