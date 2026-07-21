import { useQuery } from "@tanstack/react-query";
import { partnershipsAPI, type Partnership } from "@/api";

export const usePartnerships = () => {
  const query = useQuery<Partnership[]>({
    queryKey: ["partnerships"],
    queryFn: async () => {
      try {
        const response = await partnershipsAPI.getPartnerships();
        if (response.error) {
          throw response.error;
        }
        return (response.data || []) as Partnership[];
      } catch (err) {
        console.error("Error fetching partnerships:", err);
        throw err;
      }
    },
  });

  return {
    partnerships: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error
      ? (query.error instanceof Error ? query.error.message : "Failed to load partnerships")
      : null,
  };
};
