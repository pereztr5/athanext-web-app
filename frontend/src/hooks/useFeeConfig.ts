import { useEffect, useState } from "react";
import { getNumericConfiguration } from "@/api/configurations";

interface FeeConfig {
  platformFeePerc: number;
  stripeFeePerc: number;
  loading: boolean;
}

export const useFeeConfig = (): FeeConfig => {
  const [platformFeePerc, setPlatformFeePerc] = useState<number>(0);
  const [stripeFeePerc, setStripeFeePerc] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const loadFees = async () => {
      try {
        const [platformResp, stripeResp] = await Promise.all([
          getNumericConfiguration("platform_fees"),
          getNumericConfiguration("stripe_fees"),
        ]);

        if (!isMounted) return;

        if (platformResp.data !== null) {
          setPlatformFeePerc(platformResp.data);
        }
        if (stripeResp.data !== null) {
          setStripeFeePerc(stripeResp.data);
        }
      } catch {
        // ignore errors; defaults remain 0
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadFees();
    return () => {
      isMounted = false;
    };
  }, []);

  return { platformFeePerc, stripeFeePerc, loading };
};

