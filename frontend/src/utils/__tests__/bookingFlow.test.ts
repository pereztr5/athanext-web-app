import { describe, it, expect } from "vitest";
import type { SlotOccurrence } from "@/types/availabilityWithOccurrences";
import {
  groupOfferings,
  offeringDays,
  offeringKey,
  offeringTimes,
  upcomingOccurrences,
} from "@/utils/bookingFlow";
import { buildSlotStatusMap, isSlotOpenToBook, toBookSlotPayload } from "@/utils/slotBooking";

const occ = (overrides: Partial<SlotOccurrence>): SlotOccurrence => ({
  id: "occ",
  weekly_slot_id: "ws",
  availability_id: "av",
  coach_id: "coach",
  occurrence_date: "2026-10-06",
  session_name: "Finishing",
  price: 50,
  duration_minutes: 60,
  start_time: "16:00:00",
  end_time: "17:00:00",
  session_type: "individual",
  location: "online",
  pillar_slot: "Technical",
  is_enabled: true,
  max_bookings_per_slot: 1,
  created_at: "",
  updated_at: "",
  ...overrides,
});

describe("upcomingOccurrences", () => {
  it("keeps occurrences from today (Eastern) through the horizon across periods", () => {
    const periods = [
      { occurrences: [occ({ id: "past", occurrence_date: "2026-09-29" }), occ({ id: "today", occurrence_date: "2026-09-30" })] },
      { occurrences: [occ({ id: "soon", occurrence_date: "2026-10-10" }), occ({ id: "far", occurrence_date: "2027-01-01" })] },
    ] as never;
    // 02:00 UTC Oct 1 is still Sep 30 in New York.
    const ids = upcomingOccurrences(periods, new Date("2026-10-01T02:00:00Z"), 14).map((o) => o.id);
    expect(ids).toEqual(["today", "soon"]);
  });

  it("handles no data", () => {
    expect(upcomingOccurrences(null)).toEqual([]);
  });
});

describe("groupOfferings", () => {
  it("merges matching sessions into one offering and sorts by next start", () => {
    const offerings = groupOfferings([
      occ({ id: "a", occurrence_date: "2026-10-08" }),
      occ({ id: "b", occurrence_date: "2026-10-06", session_name: " finishing " }),
      occ({ id: "c", occurrence_date: "2026-10-07", session_type: "group", price: 30 }),
    ]);
    expect(offerings).toHaveLength(2);
    expect(offerings[0]).toMatchObject({
      sessionName: "Finishing",
      sessionType: "individual",
      location: "online",
      pillar: "Technical",
      durationMinutes: 60,
      price: 50,
      openCount: 2,
    });
    expect(offerings[0].nextStart.toISOString()).toBe("2026-10-06T20:00:00.000Z");
    expect(offerings[1]).toMatchObject({ sessionType: "group", price: 30, openCount: 1 });
  });

  it("splits offerings that differ in format, length or price", () => {
    const keys = new Set(
      [
        occ({}),
        occ({ location: "in-person" }),
        occ({ duration_minutes: 90, end_time: "17:30:00" }),
        occ({ price: 60 }),
        occ({ pillar_slot: null }),
      ].map(offeringKey)
    );
    expect(keys.size).toBe(5);
  });
});

describe("offeringDays", () => {
  const list = [
    occ({ id: "a", occurrence_date: "2026-10-06", start_time: "21:00:00", end_time: "22:00:00" }),
    occ({ id: "b", occurrence_date: "2026-10-06", start_time: "09:00:00", end_time: "10:00:00" }),
    occ({ id: "c", occurrence_date: "2026-10-05", start_time: "09:00:00", end_time: "10:00:00" }),
    occ({ id: "other", occurrence_date: "2026-10-04", session_name: "Speed" }),
  ];
  const key = offeringKey(list[0]);

  it("groups by the Eastern day for Eastern viewers", () => {
    expect(offeringDays(list, key, "America/New_York")).toEqual([
      { date: "2026-10-05", openCount: 1 },
      { date: "2026-10-06", openCount: 2 },
    ]);
  });

  it("uses the viewer's calendar day when the zone shifts it", () => {
    // 9 PM EDT Oct 6 is 10 AM Oct 7 in Tokyo.
    expect(offeringDays(list, key, "Asia/Tokyo")).toEqual([
      { date: "2026-10-05", openCount: 1 },
      { date: "2026-10-06", openCount: 1 },
      { date: "2026-10-07", openCount: 1 },
    ]);
  });
});

describe("offeringTimes", () => {
  const list = [
    occ({ id: "late", start_time: "18:00:00", end_time: "19:00:00", session_type: "group", max_bookings_per_slot: 8 }),
    occ({ id: "early", start_time: "08:00:00", end_time: "09:00:00", session_type: "group", max_bookings_per_slot: 8 }),
    occ({ id: "other-day", occurrence_date: "2026-10-07", session_type: "group", max_bookings_per_slot: 8 }),
  ];
  const key = offeringKey(list[0]);

  it("returns the day's times earliest first with group spots left", () => {
    const statusMap = buildSlotStatusMap(
      list,
      [
        { occurrence_id: "late", athlete_id: "x", status: "booked" },
        { occurrence_id: "late", athlete_id: "y", status: "requested" },
      ],
      50,
      "me"
    );
    const times = offeringTimes(list, key, "2026-10-06", "America/New_York", statusMap);
    expect(times.map((t) => t.occurrence.id)).toEqual(["early", "late"]);
    expect(times.map((t) => t.spotsLeft)).toEqual([8, 6]);
    expect(times[0].start.toISOString()).toBe("2026-10-06T12:00:00.000Z");
    expect(times[0].end.toISOString()).toBe("2026-10-06T13:00:00.000Z");
  });

  it("leaves spots empty for individual sessions", () => {
    const single = [occ({ id: "solo" })];
    expect(offeringTimes(single, offeringKey(single[0]), "2026-10-06", "America/New_York")[0].spotsLeft).toBeNull();
  });
});

describe("buildSlotStatusMap / isSlotOpenToBook", () => {
  const now = new Date("2026-10-06T12:00:00Z"); // 8 AM EDT
  const slots = [
    occ({ id: "free" }),
    occ({ id: "taken" }),
    occ({ id: "mine", session_type: "group", max_bookings_per_slot: 5 }),
    occ({ id: "requested", session_type: "group", max_bookings_per_slot: 5 }),
    occ({ id: "unpaid" }),
    occ({ id: "full", session_type: "group", max_bookings_per_slot: 2 }),
    occ({ id: "default-cap", session_type: "group", max_bookings_per_slot: 0 }),
  ];
  const statusMap = buildSlotStatusMap(
    slots,
    [
      { occurrence_id: "taken", athlete_id: "x", status: "booked" },
      { occurrence_id: "mine", athlete_id: "me", status: "booked" },
      { occurrence_id: "requested", athlete_id: "me", status: "requested" },
      { occurrence_id: "unpaid", athlete_id: "me", status: "pending_payment" },
      { occurrence_id: "full", athlete_id: "x", status: "booked" },
      { occurrence_id: "full", athlete_id: "y", status: "pending_payment" },
    ],
    3,
    "me"
  );
  const open = (id: string, extra: Partial<SlotOccurrence> = {}) =>
    isSlotOpenToBook({ ...slots.find((s) => s.id === id)!, ...extra }, statusMap[id], now);

  it("computes capacity and the viewer's own state", () => {
    expect(statusMap.full).toMatchObject({ isFull: true, hasPendingPayment: true, totalCount: 2, capacity: 2 });
    expect(statusMap["default-cap"].capacity).toBe(3);
    expect(statusMap.mine).toMatchObject({ bookedByMe: true, isFull: false });
    expect(statusMap.requested).toMatchObject({ myRequested: true, bookedByMe: false });
    expect(statusMap.unpaid).toMatchObject({ myPendingPayment: true, bookedByMe: false });
  });

  it("only offers slots the table would show a Book button for", () => {
    expect(open("free")).toBe(true);
    expect(open("default-cap")).toBe(true);
    expect(open("taken")).toBe(false);
    expect(open("mine")).toBe(false);
    expect(open("requested")).toBe(false);
    expect(open("unpaid")).toBe(false);
    expect(open("full")).toBe(false);
    expect(open("free", { is_enabled: false })).toBe(false);
    expect(isSlotOpenToBook(slots[0], undefined, now)).toBe(false);
  });

  it("keeps same-day slots open until 10 minutes after start (ATH-39)", () => {
    const slot = occ({ id: "free", start_time: "08:00:00" });
    expect(isSlotOpenToBook(slot, statusMap.free, new Date("2026-10-06T12:09:00Z"))).toBe(true);
    expect(isSlotOpenToBook(slot, statusMap.free, new Date("2026-10-06T12:11:00Z"))).toBe(false);
  });
});

describe("toBookSlotPayload", () => {
  it("builds the same prefill a table-row Book click sends", () => {
    const payload = toBookSlotPayload(occ({ id: "o1", availability_id: "p1", occurrence_date: "2026-10-08" }));
    expect(payload).toMatchObject({
      date: "2026-10-08",
      availabilityId: "p1",
      weekStart: "2026-10-05",
      occurrenceId: "o1",
    });
    expect(payload.slot).toMatchObject({ id: "o1", day_of_week: 4, occurrence_date: "2026-10-08", start_time: "16:00:00" });
  });
});
