import type { SessionUIModel } from "@/types/sessions-api";

export type UISession = SessionUIModel & {
  /** parentName and age show in the face tooltip on coach My sessions when the source has them. */
  athletes?: { id: string; name: string; avatar?: string | null; parentName?: string | null; age?: number | null }[];
  totalAthletes?: number;
  coachAvatar?: string | null;
};
