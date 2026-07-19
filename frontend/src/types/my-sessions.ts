import type { SessionUIModel } from "@/types/sessions-api";

export type UISession = SessionUIModel & {
  athletes?: { id: string; name: string; avatar?: string | null }[];
  totalAthletes?: number;
  coachAvatar?: string | null;
};
