import type { User } from "@supabase/supabase-js";
import type { SessionUIModel } from "@/types/sessions-api";
import type { ProfileState } from "@/hooks/useProfile";

export type ConversationCardItem = {
  id: string;
  sender: string;
  message: string;
  time: string;
};

export type ViewAllSection = "sessions" | "messages";

export type AthleteStatMetrics = {
  sessions_completed: number;
  hours_trained: number;
  coaches_worked_with: number;
  average_rating: number;
};

export type AthleteStatDefinition = {
  key: keyof AthleteStatMetrics;
  label: string;
  subtitle: string;
  iconColor: string;
  bgColor: string;
  iconType: "Calendar" | "Clock" | "Trophy" | "Star";
};

export interface AthleteProfileProps {
  profile: ProfileState;
  loading: boolean;
  error: string | null;
  saveAthleteProfile: (payload: any) => Promise<any>;
  refetchProfile: () => Promise<void>;
  user: User | null;
  authLoading: boolean;
  upcomingSessions?: SessionUIModel[];
  sessionsLoading?: boolean;
  sessionsError?: string | null;
}
