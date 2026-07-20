import { PROFILE_TYPE } from "@/utils/db";

type PositionOption = { value: string };

type CompleteProfileReadyInput = {
  persona: string | null | undefined;
  name: string;
  phone: string;
  zipCode: string;
  gender: string;
  selectedSportOption: unknown | null | undefined;
  dateOfBirth: string;
  coachSpecializations: string[];
  coachFavoritePositions: string[];
  position: string;
  availablePositions: PositionOption[];
};

export const isCompleteProfileReady = ({
  persona,
  name,
  phone,
  zipCode,
  gender,
  selectedSportOption,
  dateOfBirth,
  coachSpecializations,
  coachFavoritePositions,
  position,
  availablePositions,
}: CompleteProfileReadyInput) => {
  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();
  const trimmedZip = zipCode.trim();
  const hasRequiredBase =
    Boolean(persona) &&
    trimmedName.length > 0 &&
    trimmedPhone.length > 0 &&
    Boolean(selectedSportOption) &&
    Boolean(gender);

  if (!hasRequiredBase) return false;

  // Zip/postal code is optional for profile completion.
  // If provided, enforce only basic length sanity checks.
  if (trimmedZip.length > 0 && trimmedZip.length < 3) return false;

  if (persona === PROFILE_TYPE.athlete || persona === PROFILE_TYPE.parent) {
    if (!dateOfBirth) return false;
  }

  if (persona === PROFILE_TYPE.coach) {
    if (coachSpecializations.length === 0) return false;
    if (coachFavoritePositions.length === 0) return false;
  } else {
    if (!position) return false;
    if (
      availablePositions.length > 0 &&
      !availablePositions.some((option) => option.value === position)
    ) {
      return false;
    }
  }

  return true;
};
