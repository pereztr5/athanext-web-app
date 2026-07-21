import { useQuery, useMutation } from "@tanstack/react-query";
import { votesAPI } from "@/api";
import { supabase } from "@/integrations/supabase/client";

interface SportOption {
  id: string;
  name: string;
}

export const useSportsPoll = () => {
  const query = useQuery<SportOption[]>({
    queryKey: ["sports-poll"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("sports_options")
          .select("id, name, description, icon")
          .order("created_at", { ascending: true });

        if (error) {
          throw error;
        }

        return data || [];
      } catch (error) {
        console.error("Error fetching sports options:", error);
        return [];
      }
    },
    staleTime: Infinity,
  });

  const voteMutation = useMutation({
    mutationFn: async (sportOptionId: string) => {
      const response = await votesAPI.submitVote({ sportOptionId });
      if (response.error) {
        throw response.error;
      }
      return { error: null };
    },
    onError: (error) => {
      console.error("Error submitting vote:", error);
    },
  });

  const submitVote = (sportOptionId: string) => voteMutation.mutateAsync(sportOptionId);

  return {
    sportsOptions: query.data ?? [],
    submitVote,
    isLoading: voteMutation.isPending,
  };
};
