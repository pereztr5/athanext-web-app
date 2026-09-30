/**
 * Athlete-side slot booking helpers shared by the availability table and the
 * "Book a session" flow (ATH-28): occurrence -> slot mapping, booking status and
 * whether a slot can be booked right now.
 */
import type { CoachAvailabilitySlot, DayOfWeek, SlotBookingStatus } from "@/types/availability";
import type { SlotOccurrence } from "@/types/availabilityWithOccurrences";
import { getWeekStart, isBookingWindowClosed, parseISODateLocal, toLocalISODate } from "@/utils/dateHelpers";

/** Booking rows that hold a seat (held requests included, ATH-49). */
export const ACTIVE_BOOKING_STATUSES = ["requested", "pending_payment", "booked", "completed"];

export interface SlotBookingRow {
  occurrence_id: string;
  athlete_id: string;
  status: string;
}

/** What a Book click hands to CoachSchedulingModal as `prefillSlot`. */
export interface BookSlotPayload {
  slot: CoachAvailabilitySlot;
  date: string;
  availabilityId: string;
  weekStart: string;
  occurrenceId: string;
}

/**
 * Map a dated occurrence to the slot shape the table and modal use (slot.id is the occurrence id).
 * availability_id / coach_id ride along for SlotEditModal's fallback lookup.
 */
export const occurrenceToSlot = (
  occ: SlotOccurrence
): CoachAvailabilitySlot & Pick<SlotOccurrence, "availability_id" | "coach_id"> => {
  const dateObj = parseISODateLocal(occ.occurrence_date);
  const isoDay = (((dateObj.getDay() + 6) % 7) + 1) as DayOfWeek; // Sunday=0 -> 7
  return {
    id: occ.id,
    weekly_slot_id: occ.weekly_slot_id,
    day_of_week: isoDay,
    session_name: occ.session_name,
    price: occ.price,
    duration_minutes: occ.duration_minutes as CoachAvailabilitySlot["duration_minutes"],
    start_time: occ.start_time,
    end_time: occ.end_time,
    session_type: occ.session_type,
    location: occ.location,
    pillar_slot: occ.pillar_slot || null,
    is_enabled: occ.is_enabled,
    max_bookings_per_slot: occ.max_bookings_per_slot,
    availability_id: occ.availability_id,
    coach_id: occ.coach_id,
    occurrence_date: occ.occurrence_date,
  };
};

export const toBookSlotPayload = (occ: SlotOccurrence): BookSlotPayload => ({
  slot: occurrenceToSlot(occ),
  date: occ.occurrence_date,
  availabilityId: occ.availability_id,
  weekStart: toLocalISODate(getWeekStart(parseISODateLocal(occ.occurrence_date))),
  occurrenceId: occ.id,
});

/** Per-slot capacity and the viewer's own booking state, from active booking rows. */
export const buildSlotStatusMap = (
  slots: Array<Pick<CoachAvailabilitySlot, "id" | "session_type" | "max_bookings_per_slot">>,
  rows: SlotBookingRow[],
  defaultGroupCapacity: number,
  viewerId: string | null | undefined
): Record<string, SlotBookingStatus> => {
  const statusMap: Record<string, SlotBookingStatus> = {};
  slots.forEach((slot) => {
    const rowsForSlot = rows.filter((row) => row.occurrence_id === slot.id);
    const capacityFromSlot = slot.max_bookings_per_slot;
    const capacity = capacityFromSlot && capacityFromSlot > 0
      ? capacityFromSlot
      : slot.session_type === "group" ? defaultGroupCapacity : 1;

    const bookingCount = rowsForSlot.length;
    const pendingCount = rowsForSlot.filter((row) => row.status === "pending_payment").length;
    const myBooking = viewerId ? rowsForSlot.find((row) => row.athlete_id === viewerId) : undefined;
    const myPendingPayment = myBooking?.status === "pending_payment";
    // Held requests count toward capacity but aren't a booking yet (ATH-49).
    const myRequested = myBooking?.status === "requested";
    const bookedByMe = Boolean(myBooking) && !myPendingPayment && !myRequested;
    const isFull = slot.session_type === "group"
      ? bookingCount >= capacity
      : bookingCount > 0; // any booking occupies an individual slot

    statusMap[slot.id] = {
      isFull,
      bookedByMe,
      hasPendingPayment: pendingCount > 0,
      myPendingPayment,
      myRequested,
      totalCount: bookingCount,
      capacity,
    };
  });
  return statusMap;
};

/**
 * True when the table row would show a plain "Book" button: enabled, inside the
 * booking window (ATH-39), not full and not already booked, requested or awaiting payment by the viewer.
 */
export const isSlotOpenToBook = (
  slot: Pick<CoachAvailabilitySlot, "is_enabled" | "occurrence_date" | "start_time">,
  status: SlotBookingStatus | undefined,
  now = new Date()
): boolean => {
  if (!status || !slot.is_enabled) return false;
  if (isBookingWindowClosed(slot.occurrence_date, slot.start_time, now)) return false;
  return !status.isFull && !status.bookedByMe && !status.myPendingPayment && !status.myRequested;
};
