import { useState, useEffect } from "react";
import { partnershipsAPI, type Partnership } from "@/api";

export const usePartnerships = () => {
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPartnerships();
  }, []);

  const fetchPartnerships = async () => {
    try {
      setIsLoading(true);
      const response = await partnershipsAPI.getPartnerships();

      if (response.error) {
        throw response.error;
      }

      setPartnerships((response.data || []) as Partnership[]);
    } catch (err) {
      console.error("Error fetching partnerships:", err);
      setError(err instanceof Error ? err.message : "Failed to load partnerships");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    partnerships,
    isLoading,
    error,
  };
};
