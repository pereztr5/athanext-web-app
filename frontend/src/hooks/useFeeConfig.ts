import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FEE_CONFIG_KEYS, parseFeeConfig, type FeeConfig } from "@/utils/fees";

export interface FeeConfigState {
  /** Null until the rates are loaded, and when they can't be: never show a price without them. */
  config: FeeConfig | null;
  loading: boolean;
  error: boolean;
}

/** The fee rates every shown price uses (the same rows the payment functions charge with). */
export const useFeeConfig = (): FeeConfigState => {
  const query = useQuery<FeeConfig>({
    queryKey: ["fee-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("configurations").select("key,value").in("key", FEE_CONFIG_KEYS);
      if (error) throw error;
      return parseFeeConfig(data);
    },
    staleTime: Infinity,
  });

  return { config: query.data ?? null, loading: query.isLoading, error: query.isError };
};
