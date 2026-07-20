import { useCallback } from "react";
import {
  athleteProfilesAPI,
  type AthleteProfileInsert,
  type AthleteProfileUpdate,
} from "@/api";

export const useAthleteProfileActions = () => {
  const createAthleteProfile = useCallback(
    (payload: AthleteProfileInsert) => athleteProfilesAPI.createAthleteProfile(payload),
    []
  );

  const updateAthleteProfile = useCallback(
    (athleteId: string, updates: AthleteProfileUpdate) =>
      athleteProfilesAPI.updateAthleteProfile(athleteId, updates),
    []
  );

  return {
    createAthleteProfile,
    updateAthleteProfile,
  };
};
