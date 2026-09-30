import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDefaultGroupCapacity } from "@/api/configurations";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import useCoachAvailabilityWithOccurrences from "@/hooks/useCoachAvailabilityWithOccurrences";
import { PROFILE_TYPE } from "@/utils/db";
import { upcomingOccurrences } from "@/utils/bookingFlow";
import { ACTIVE_BOOKING_STATUSES, buildSlotStatusMap, isSlotOpenToBook, type SlotBookingRow } from "@/utils/slotBooking";

// Keeps each `in (...)` filter comfortably inside URL limits.
const ID_CHUNK = 100;

/**
 * Upcoming occurrences the viewer can book right now (ATH-28), with their booking status.
 * Uses the same availability query and status rules as the profile's slot table.
 */
export const useBookableOccurrences = (coachId: string | null) => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const athleteProfileId =
    profile?.type === PROFILE_TYPE.athlete && profile?.data ? ((profile.data as { id?: string }).id ?? null) : null;
  const viewerId = athleteProfileId || user?.id || null;

  const { data: availabilities, isLoading: availabilityLoading, error: availabilityError } =
    useCoachAvailabilityWithOccurrences(coachId);
  const upcoming = useMemo(() => upcomingOccurrences(availabilities), [availabilities]);
  const upcomingIds = useMemo(() => upcoming.map((occ) => occ.id), [upcoming]);

  const statusQuery = useQuery({
    queryKey: ["coach-slot-statuses", coachId, viewerId, upcomingIds],
    enabled: Boolean(coachId) && upcomingIds.length > 0,
    queryFn: async () => {
      const { data: configuredCapacity } = await getDefaultGroupCapacity();
      const defaultGroupCapacity = typeof configuredCapacity === "number" && configuredCapacity > 0 ? configuredCapacity : 50;
      const rows: SlotBookingRow[] = [];
      for (let i = 0; i < upcomingIds.length; i += ID_CHUNK) {
        const { data, error } = await supabase
          .from("coach_slot_bookings" as any)
          .select("occurrence_id, athlete_id, status")
          .in("occurrence_id", upcomingIds.slice(i, i + ID_CHUNK))
          .in("status", ACTIVE_BOOKING_STATUSES);
        if (error) throw error;
        rows.push(...((data as unknown as SlotBookingRow[]) || []));
      }
      return buildSlotStatusMap(upcoming, rows, defaultGroupCapacity, viewerId);
    },
  });

  const statusMap = statusQuery.data;
  const bookable = useMemo(() => {
    if (!statusMap) return [];
    const now = new Date();
    return upcoming.filter((occ) => isSlotOpenToBook(occ, statusMap[occ.id], now));
  }, [upcoming, statusMap]);

  return {
    bookable,
    statusMap: statusMap ?? {},
    isLoading: availabilityLoading || (upcomingIds.length > 0 && statusQuery.isLoading),
    isError: Boolean(availabilityError) || statusQuery.isError,
    refetch: statusQuery.refetch,
  };
};

export default useBookableOccurrences;
