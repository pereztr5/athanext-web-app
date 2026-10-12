import { useQuery } from "@tanstack/react-query";
import { getNumericConfiguration } from "@/api/configurations";

interface FeeConfig {
  platformFeePerc: number;
  stripeFeePerc: number;
  stripeFeeFixed: number;
  loading: boolean;
}

interface FeeConfigData {
  platformFeePerc: number;
  stripeFeePerc: number;
  stripeFeeFixed: number;
}

export const useFeeConfig = (): FeeConfig => {
  const query = useQuery<FeeConfigData>({
    queryKey: ["fee-config"],
    queryFn: async () => {
      try {
        const [platformResp, stripeResp, fixedResp] = await Promise.all([
          getNumericConfiguration("platform_fees"),
          getNumericConfiguration("stripe_fees"),
          getNumericConfiguration("stripe_fee_fixed"),
        ]);

        return {
          platformFeePerc: platformResp.data ?? 0,
          stripeFeePerc: stripeResp.data ?? 0,
          stripeFeeFixed: fixedResp.data ?? 0,
        };
      } catch {
        // ignore errors; defaults remain 0
        return { platformFeePerc: 0, stripeFeePerc: 0, stripeFeeFixed: 0 };
      }
    },
    staleTime: Infinity,
  });

  return {
    platformFeePerc: query.data?.platformFeePerc ?? 0,
    stripeFeePerc: query.data?.stripeFeePerc ?? 0,
    stripeFeeFixed: query.data?.stripeFeeFixed ?? 0,
    loading: query.isLoading,
  };
};
