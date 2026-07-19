import type { AthleteProfileFormData } from "@/types/athleteProfile";
import type { AthleteProfileUpsertPayload, AthleteProfile as DbAthleteProfile } from "@/hooks/useProfile";
import { deriveInitials } from "@/utils/helperFunctions";

export { deriveInitials };

/**
 * Empty athlete profile data template
 * Used as default values for new profiles or when profile data is unavailable
 */
export const emptyProfileData: AthleteProfileFormData = {
  fullName: "",
  initials: "",
  sport: "",
  position: "",
  dateOfBirth: "",
  phoneNumber: "",
  location: "",
  tags: [],
  profileImageUrl: null,
  coverImageUrls: [],
  graduationYear: null,
  highSchool: null,
  gpa: null,
  height: null,
  weight: null,
  dominantHand: null,
  gender: null,
  zipCode: null,
  currentYear: null,
};

/**
 * Maps database athlete profile to form data structure
 * @param profile - Database athlete profile object
 * @param userProfile - User profile object (contains gender, zip_code, and image_url)
 * @returns Form-ready athlete profile data
 */
export const mapDbProfileToForm = (
  profile?: DbAthleteProfile | null,
  userProfile?: { gender?: string | null; zip_code?: string | null; image_url?: string | null } | null
): AthleteProfileFormData => {
  if (!profile) return { ...emptyProfileData };
  const coverImages = Array.isArray(profile.cover_image_urls) ? profile.cover_image_urls.filter(Boolean) : [];
  return {
    fullName: profile.full_name ?? "",
    initials: deriveInitials(profile.full_name),
    sport: profile.sport ?? "",
    position: profile.position ?? "",
    dateOfBirth: profile.date_of_birth ?? "",
    phoneNumber: profile.phone_number ?? "",
    location: profile.location ?? "",
    tags: Array.isArray(profile.tags) ? profile.tags.filter(Boolean) : [],
    profileImageUrl: profile.profile_image_url ?? userProfile?.image_url ?? null,
    coverImageUrls: coverImages,
    graduationYear: profile.graduation_year ?? null,
    currentYear: profile.current_year ?? null,
    highSchool: profile.high_school ?? null,
    gpa: profile.gpa ?? null,
    height: profile.height ?? null,
    weight: profile.weight ?? null,
    dominantHand: profile.dominant_hand ?? null,
    gender: userProfile?.gender ?? null,
    zipCode: userProfile?.zip_code ?? null,
  };
};

/**
 * Maps form data to database payload structure
 * @param profile - Form athlete profile data
 * @returns Database-ready payload for upsert operation
 */
export const mapFormToDbPayload = (profile: AthleteProfileFormData): AthleteProfileUpsertPayload => ({
  full_name: profile.fullName.trim(),
  sport: profile.sport.trim(),
  position: profile.position.trim() || null,
  date_of_birth: profile.dateOfBirth,
  phone_number: profile.phoneNumber.trim() || null,
  location: profile.location.trim() || null,
  tags: profile.tags.filter((tag) => Boolean(tag?.trim())),
  profile_image_url: profile.profileImageUrl,
  cover_image_urls: profile.coverImageUrls.filter(Boolean).slice(0, 3),
  graduation_year: profile.graduationYear,
  current_year: profile.currentYear,
  high_school: profile.highSchool?.trim() || null,
  gpa: profile.gpa,
  height: profile.height,
  weight: profile.weight,
  dominant_hand: profile.dominantHand?.trim() || null,
});
