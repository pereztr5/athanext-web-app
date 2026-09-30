import type { ReactNode } from "react";

export type Coach = {
  id: string;
  name: string;
  bio?: string;
  coach_position?: string;
  position?: string;
  is_verified?: boolean;
  company?: string;
  specialties?: string[];
  pathway_tags?: string[];
  favourite_positions?: string[];
  image_url?: string;
  rating?: number;
  total_reviews?: number;
  locations?: string[];
  years_experience?: number;
  instagram_handle?: string;
  profile_image_url?: string;
  hourly_rate?: number;
  cover_image_urls?: string[];
  gender?: string;
  zip_code?: string;
  sport?: string;
};

export interface SportTheme {
  buttonClass: string;
  badgeClass: string;
}

export interface CoachHeaderProps {
  showStrengthMeter?: boolean;
  isCoachProfile?: boolean;
  coachPillarOptions?: any[];
  isEditMode?: boolean;
  className?: string;
  coach: Coach;
  editedCoach?: Partial<Coach>;
  sportTheme: SportTheme;
  sport: string;
  onBook: () => void;
  /** Replaces the default "Book a session" button, e.g. with the guided booking flow (ATH-28). */
  bookAction?: ReactNode;
  onViewPackages: () => void;
  onSendMessage: () => void;
  canSendMessage?: boolean;
  isSendingMessage?: boolean;
  onImageSelect?: (file: File) => void;
  onCoverImageRemove?: (urlOrIndex: string | number) => void;
  onCoverImagesSelect?: (files: File[]) => void;
  onFieldChange?: (field: string, value: unknown) => void;
  onEdit?: () => void;
  onCancelEdit?: () => void;
  onSaveEdit?: () => void;
  isSaving?: boolean;
}
