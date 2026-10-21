/** Session tag options and how a tag is saved (see SessionTag). */
import { useAuth } from "@/contexts/AuthContext";
import { pillarsForSport } from "@/utils/sessionPillars";

/** The signed-in coach's pillars, used as the tag options. */
export const useSessionTags = () => {
  const { userProfile } = useAuth();
  return pillarsForSport(userProfile?.sport ?? null);
};

/** Saved details for a tag: the pillar goes on both keys older screens read. */
export const tagDetails = (tag: string) => (tag.trim() ? { tag: tag.trim(), ages: tag.trim() } : {});
