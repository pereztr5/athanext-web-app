import { useState, useEffect } from "react";
import { votesAPI } from "@/api";
import { supabase } from "@/integrations/supabase/client";

interface SportOption {
  id: string;
  name: string;
}

export const useSportsPoll = () => {
  const [sportsOptions, setSportsOptions] = useState<SportOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchSportsOptions();
  }, []);

  const fetchSportsOptions = async () => {
    try {
      const { data, error } = await supabase
        .from("sports_options")
        .select("id, name, description, icon")
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      setSportsOptions(data || []);
    } catch (error) {
      console.error("Error fetching sports options:", error);
    }
  };

  const submitVote = async (sportOptionId: string) => {
    setIsLoading(true);

    try {
      const response = await votesAPI.submitVote({
        sportOptionId,
      });

      if (response.error) {
        throw response.error;
      }

      return { error: null };
    } catch (error) {
      console.error("Error submitting vote:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    sportsOptions,
    submitVote,
    isLoading,
  };
};
