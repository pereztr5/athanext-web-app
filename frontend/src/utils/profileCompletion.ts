export interface ProfileData {
  name?: string;
  full_name?: string;
  image_url?: string;
  profile_image_url?: string;
  coach_position?: string;
  position?: string;
  specialties?: string[];
  years_experience?: number;
  instagram_handle?: string;
  cover_image_urls?: string[];
  gender?: string;
  zip_code?: string;
  company?: string;
  bio?: string;
  graduation_year?: number;
  high_school?: string;
  gpa?: number;
  height?: number;
  weight?: number;
  dominant_hand?: "left" | "right" | "ambidextrous";
}

export interface ProfileProgress {
  completion: number;
  consistency: number;
  completedFields: number;
  totalFields: number;
  missingFields: string[];
  consistencyIssues: string[];
}

const FIELD_LABELS: Record<string, string> = {
  full_name: "Name",
  profile_image_url: "Profile image",
  name: "Name",
  instagram: "Instagram handle",
  position: "Position",
  specialties: "Specialties",
  company: "Company",
  gender: "Gender",
  about: "Bio",
  image: "Profile image",
  coverImage: "Cover images",
  graduationYear: "Graduation year",
  highSchool: "High school",
  gpa: "GPA",
  height: "Height",
  weight: "Weight",
  dominantHand: "Dominant hand",
};

export const DEFAULT_PROFILE_PROGRESS: ProfileProgress = {
  completion: 100,
  consistency: 0,
  completedFields: 0,
  totalFields: 9,
  missingFields: [],
  consistencyIssues: [],
};

/**
 * Calculate overall profile progress, including completion and consistency.
 * Returns percentages plus helpful metadata so the UI can surface gaps.
 */
export const calculateProfileProgress = (
  profile?: ProfileData
): ProfileProgress => {
  if (!profile) {
    return {
      completion: 0,
      completedFields: 0,
      totalFields: 4,
      consistency: 0,
      missingFields: [],
      consistencyIssues: [],
    };
  }

  // Detect if this is an athlete profile based on presence of athlete-specific fields
  // Athletes have: full_name, position (and lack coach-specific fields like specialties)
  // Coaches have: specialties, years_experience, instagram_handle, company, etc.
  const hasCoachFields = !!(
    profile.specialties?.length ||
    profile.years_experience ||
    profile.instagram_handle ||
    profile.company ||
    profile.zip_code ||
    profile.gender ||
    profile.bio
  );
  
  // If has full_name + position but no coach-specific fields, it's an athlete
  const isAthlete = !!(profile.full_name && profile.position && !hasCoachFields);

  const totalFields = isAthlete ? 4 : 9;

  const completedFields = isAthlete
    ? countAthleteFields(profile)
    : countCoachFields(profile);

  const completion = Math.round((completedFields / totalFields) * 100);

  // Calculate missing fields
  const missingFields: string[] = [];
  if (isAthlete) {
    if (!profile.full_name) missingFields.push(FIELD_LABELS["full_name"]);
    if (!profile.position) missingFields.push(FIELD_LABELS["position"]);
    if (!profile.profile_image_url)
      missingFields.push(FIELD_LABELS["profile_image_url"]);
    if (!profile.cover_image_urls || profile.cover_image_urls.length === 0)
      missingFields.push(FIELD_LABELS["coverImage"]);
  } else {
    if (!profile.name) missingFields.push(FIELD_LABELS["name"]);
    if (!profile.instagram_handle)
      missingFields.push(FIELD_LABELS["instagram"]);
    if (!profile.coach_position && !profile.position)
      missingFields.push(FIELD_LABELS["position"]);
    if (!profile.specialties || profile.specialties.length === 0)
      missingFields.push(FIELD_LABELS["specialties"]);
    if (!profile.company) missingFields.push(FIELD_LABELS["company"]);
    if (!profile.gender) missingFields.push(FIELD_LABELS["gender"]);
    if (!profile.bio) missingFields.push(FIELD_LABELS["about"]);
    if (!profile.image_url) missingFields.push(FIELD_LABELS["image"]);
    if (!profile.cover_image_urls || profile.cover_image_urls.length === 0)
      missingFields.push(FIELD_LABELS["coverImage"]);
  }

  return {
    completion,
    completedFields,
    totalFields,
    consistency: 100,
    missingFields,
    consistencyIssues: [],
  };
};

const countCoachFields = (profile: ProfileData): number => {
  let count = 0;
  // Align with UI: coaches use `name` not `full_name`
  if (profile.name) count++;
  if (profile.instagram_handle) count++;
  if (profile.coach_position || profile.position) count++;
  if (
    profile.specialties &&
    Array.isArray(profile.specialties) &&
    profile.specialties.length > 0
  )
    count++;
  if (profile.company) count++;
  if (profile.gender) count++;
  if (profile.bio) count++;
  if (profile.image_url) count++;
  if (
    profile.cover_image_urls &&
    Array.isArray(profile.cover_image_urls) &&
    profile.cover_image_urls.length > 0
  )
    count++;
  return count;
};

const countAthleteFields = (profile: ProfileData): number => {
  let count = 0;
  if (profile.full_name) count++;
  if (profile.position) count++;
  if (profile.profile_image_url) count++;
  if (
    profile.cover_image_urls &&
    Array.isArray(profile.cover_image_urls) &&
    profile.cover_image_urls.length > 0
  )
    count++;
  return count;
};

/**
 * Backwards compatible helper for callers that only need the completion value.
 */
export function calculateProfileCompletion(profile: ProfileData): number {
  return calculateProfileProgress(profile).completion;
}
