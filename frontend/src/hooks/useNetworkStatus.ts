import { useEffect, useRef, useState } from "react";

type NetworkInfo = {
  isOnline: boolean;
  isSlowConnection: boolean;
  effectiveType?: string;
  rtt?: number;
};

const getConnection = () =>
  (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

const computeSlowConnection = (connection: any): boolean => {
  if (!connection) return false;
  const effectiveType = String(connection.effectiveType || "");
  return effectiveType === "slow-2g" || effectiveType === "2g";
};

export const useNetworkStatus = (): NetworkInfo => {
  const [state, setState] = useState<NetworkInfo>(() => {
    const connection = getConnection();
    return {
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      isSlowConnection: computeSlowConnection(connection),
      effectiveType: connection?.effectiveType,
      rtt: connection?.rtt,
    };
  });

  const slowStreakRef = useRef(0);
  const fastStreakRef = useRef(0);

  useEffect(() => {
    const update = () => {
      const connection = getConnection();
      const isSlowRaw = computeSlowConnection(connection);
      if (isSlowRaw) {
        slowStreakRef.current += 1;
        fastStreakRef.current = 0;
      } else {
        fastStreakRef.current += 1;
        slowStreakRef.current = 0;
      }
      const isSlowConnection =
        slowStreakRef.current >= 2 ? true : fastStreakRef.current >= 2 ? false : state.isSlowConnection;

      setState({
        isOnline: navigator.onLine,
        isSlowConnection,
        effectiveType: connection?.effectiveType,
        rtt: connection?.rtt,
      });
    };

    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    const connection = getConnection();
    if (connection?.addEventListener) {
      connection.addEventListener("change", update);
    }

    const intervalId = window.setInterval(update, 2000);
    update();

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      if (connection?.removeEventListener) {
        connection.removeEventListener("change", update);
      }
      window.clearInterval(intervalId);
    };
  }, [state.isSlowConnection]);

  return state;
};
