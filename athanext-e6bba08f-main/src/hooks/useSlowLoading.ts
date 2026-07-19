import { useEffect, useState } from "react";

export const useSlowLoading = (isLoading: boolean, thresholdMs = 8000) => {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setIsSlow(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setIsSlow(true);
    }, thresholdMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isLoading, thresholdMs]);

  return isSlow;
};
