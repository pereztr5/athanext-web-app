// Types only. The useProfile hook lives in contexts/ProfileContext —
// this file's duplicate query implementation was removed.
import type { CoachDetails } from "./useCoachDetails";
import { type UserProfile as SupabaseUserProfile } from "@/api/userProfiles";

export type UserType = "coach" | "athlete" | null;

export interface AthleteProfile {
  id: string;
  user_id: string;
  full_name: string;
  date_of_birth: string;
  sport: string;
  position?: string | null;
  phone_number?: string | null;
  location?: string | null;
  tags: string[];
  pathway_tags?: string[];
  profile_image_url?: string | null;
  cover_image_urls: string[];
  bio?: string | null;
  profile_completed?: boolean;
  created_at: string;
  updated_at: string;
  instagram_handle?: string | null;
  graduation_year?: string | number | null;
  current_year?: string | null;
  high_school?: string | null;
  gpa?: string | number | null;
  height?: string | number | null;
  weight?: string | number | null;
  dominant_hand?: string | null;
}

export interface AthleteProfileUpsertPayload {
  full_name: string;
  sport: string;
  position?: string | null;
  date_of_birth: string;
  phone_number?: string | null;
  location?: string | null;
  tags: string[];
  pathway_tags?: string[];
  profile_image_url?: string | null;
  cover_image_urls: string[];
  bio?: string | null;
  instagram_handle?: string | null;
  graduation_year?: string | number | null;
  current_year?: string | null;
  high_school?: string | null;
  gpa?: string | number | null;
  height?: string | number | null;
  weight?: string | number | null;
  dominant_hand?: string | null;
}

export interface ProfileState {
  type: UserType;
  data: CoachDetails | AthleteProfile | null;
  userProfile: SupabaseUserProfile | null;
}
