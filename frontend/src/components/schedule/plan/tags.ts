/** Session tag options and how a tag is saved (see SessionTag). */
import { useAuth } from "@/contexts/AuthContext";
import { usePillarTitles } from "@/hooks/usePillarTitles";

/** The signed-in coach's pillars (the database list, as at sign up), used as the tag options. */
export const useSessionTags = () => {
  const { userProfile } = useAuth();
  return usePillarTitles(userProfile?.sport ?? null);
};

/** Saved details for a tag: the pillar goes on both keys older screens read. */
export const tagDetails = (tag: string) => (tag.trim() ? { tag: tag.trim(), ages: tag.trim() } : {});
