import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { resolveTimeZone } from "@/utils/viewerTime";

/** IANA zone used to display session times: the saved preference, else the browser zone. */
export const useViewerTimeZone = (): string => {
  const { userProfile } = useAuth();
  const preferred = userProfile?.timezone ?? null;
  return useMemo(() => resolveTimeZone(preferred), [preferred]);
};
