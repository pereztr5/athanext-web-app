import { useCallback } from "react";
import { coachesAPI, type CoachInsert, type CoachUpdate } from "@/api";

export const useCoachProfileActions = () => {
  const createCoach = useCallback(
    (payload: CoachInsert) => coachesAPI.createCoach(payload),
    []
  );

  const updateCoach = useCallback(
    (coachId: string, updates: CoachUpdate) => coachesAPI.updateCoach(coachId, updates),
    []
  );

  return {
    createCoach,
    updateCoach,
  };
};
