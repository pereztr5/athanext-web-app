import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import {
  DEFAULT_SLOT,
  buildWeeksRange,
  slotsOverlap,
  dateRangesOverlap,
  applyTemplateToWeek,
  hasCrossPeriodOverlap,
  createEmptyWeekSlots,
} from "@/utils/availabilityModalHelpers";
import { toLocalISODate } from "@/utils/dateHelpers";
import type {
  SlotFormData,
  DayOfWeek,
  CoachAvailability,
  CoachAvailabilitySlot,
} from "@/types/availability";
import type { SlotOccurrence } from "@/types/availabilityWithOccurrences";

// Characterization tests: pin CURRENT behavior. Run under TZ=UTC.

const slot = (over: Partial<SlotFormData> = {}): SlotFormData => ({
  ...DEFAULT_SLOT,
  is_enabled: true,
  ...over,
});

const exSlot = (over: Partial<CoachAvailabilitySlot> = {}): CoachAvailabilitySlot => ({
  id: "s1",
  day_of_week: 1,
  session_name: "",
  price: 50,
  duration_minutes: 60,
  start_time: "10:00",
  end_time: "11:00",
  session_type: "individual",
  location: "in-person",
  is_enabled: true,
  ...over,
});

const period = (over: Partial<CoachAvailability> = {}): CoachAvailability => ({
  id: "p1",
  coach_id: "c1",
  start_date: "2026-07-20",
  end_date: "2026-08-02",
  slots: [exSlot()],
  created_at: "",
  updated_at: "",
  ...over,
});

describe("buildWeeksRange", () => {
  it("yields the Monday of each week touched by a two-week range", () => {
    const weeks = buildWeeksRange(new Date(2026, 6, 22), new Date(2026, 7, 2)); // Wed Jul 22 - Sun Aug 2
    expect(weeks.map(toLocalISODate)).toEqual(["2026-07-20", "2026-07-27"]);
  });

  it("includes the final week when the end date is exactly a Monday", () => {
    const weeks = buildWeeksRange(new Date(2026, 6, 20), new Date(2026, 7, 3)); // Mon Jul 20 - Mon Aug 3
    expect(weeks.map(toLocalISODate)).toEqual(["2026-07-20", "2026-07-27", "2026-08-03"]);
  });
});

describe("slotsOverlap", () => {
  it("returns true for partially overlapping times", () => {
    expect(slotsOverlap("10:00", "11:00", "10:30", "11:30")).toBe(true);
  });

  it("returns false for back-to-back slots", () => {
    expect(slotsOverlap("10:00", "11:00", "11:00", "12:00")).toBe(false);
  });

  it("normalizes HH:mm:ss times before comparing", () => {
    expect(slotsOverlap("10:00:00", "11:00:00", "10:30", "11:30")).toBe(true);
  });
});

describe("dateRangesOverlap", () => {
  it("returns true for overlapping ranges", () => {
    expect(dateRangesOverlap("2026-07-01", "2026-07-15", "2026-07-10", "2026-07-20")).toBe(true);
  });

  it("returns false for disjoint ranges", () => {
    expect(dateRangesOverlap("2026-07-01", "2026-07-10", "2026-07-11", "2026-07-20")).toBe(false);
  });

  it("returns true when ranges share a single boundary day", () => {
    expect(dateRangesOverlap("2026-07-01", "2026-07-10", "2026-07-10", "2026-07-20")).toBe(true);
  });
});

describe("applyTemplateToWeek", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 20, 12, 0, 0)); // Mon Jul 20 2026
  });
  afterAll(() => vi.useRealTimers());

  const template = (): Record<DayOfWeek, SlotFormData[]> => {
    const t = createEmptyWeekSlots();
    t[2] = [slot({ day_of_week: 2, session_name: "Tue drills", occurrence_id: "keep-me-not" })];
    return t;
  };

  it("remaps template days onto the target week and strips occurrence ids", () => {
    const result = applyTemplateToWeek(template(), "2026-07-27", undefined, false);
    expect(result[2]).toHaveLength(1);
    expect(result[2][0]).toMatchObject({
      day_of_week: 2,
      session_name: "Tue drills",
      occurrence_date: "2026-07-28", // Tuesday of target week
      occurrence_id: undefined,
    });
    expect(result[1]).toEqual([]);
  });

  it("ignores the existing week entirely when no preservation flag is set", () => {
    const existing = createEmptyWeekSlots();
    existing[3] = [slot({ day_of_week: 3, session_name: "Wed custom" })];
    const result = applyTemplateToWeek(template(), "2026-07-27", existing, false);
    expect(result[3]).toEqual([]);
  });

  it("with preservePast, keeps enabled existing slots on a target week different from the source", () => {
    const existing = createEmptyWeekSlots();
    existing[2] = [
      slot({ day_of_week: 2, session_name: "Keep me", occurrence_date: "2026-08-04" }),
    ];
    const result = applyTemplateToWeek(template(), "2026-08-03", existing, true, undefined, "2026-07-27");
    expect(result[2]).toHaveLength(1);
    expect(result[2][0].session_name).toBe("Keep me");
    expect(result[2][0].occurrence_date).toBe("2026-08-04");
  });

  it("with preservePast, overwrites disabled non-past existing slots with the template", () => {
    const existing = createEmptyWeekSlots();
    existing[2] = [
      slot({ day_of_week: 2, is_enabled: false, session_name: "Replace me", occurrence_date: "2026-08-04" }),
    ];
    const result = applyTemplateToWeek(template(), "2026-08-03", existing, true, undefined, "2026-07-27");
    expect(result[2][0].session_name).toBe("Tue drills");
  });

  it("with preservePast, keeps past-or-today existing slots even when disabled", () => {
    const existing = createEmptyWeekSlots();
    existing[1] = [
      slot({ day_of_week: 1, is_enabled: false, session_name: "Past slot", occurrence_date: "2026-07-20" }),
    ];
    const result = applyTemplateToWeek(template(), "2026-07-20", existing, true, undefined, "2026-07-20");
    expect(result[1][0].session_name).toBe("Past slot");
  });

  it("with preservePast, keeps locked (booked) existing slots regardless of enabled state", () => {
    const existing = createEmptyWeekSlots();
    existing[2] = [
      slot({ day_of_week: 2, is_enabled: false, session_name: "Booked", occurrence_date: "2026-08-04", occurrence_id: "occ-1" }),
    ];
    const result = applyTemplateToWeek(
      template(), "2026-08-03", existing, true, new Set(["occ-1"]), "2026-08-03",
    );
    expect(result[2][0].session_name).toBe("Booked");
  });
});

describe("hasCrossPeriodOverlap", () => {
  const formSlots = [slot({ day_of_week: 1, start_time: "10:00", end_time: "11:00" })];

  it("returns true for an overlapping period with same day and overlapping time (weekly pattern)", () => {
    const existing = [period({ slots: [exSlot({ day_of_week: 1, start_time: "10:30", end_time: "11:30" })] })];
    expect(hasCrossPeriodOverlap("2026-07-20", "2026-08-02", formSlots, existing)).toBe(true);
  });

  it("returns false for disjoint periods even with identical slots", () => {
    const existing = [period({ start_date: "2026-09-01", end_date: "2026-09-14" })];
    expect(hasCrossPeriodOverlap("2026-07-20", "2026-08-02", formSlots, existing)).toBe(false);
  });

  it("excludes the period matching currentId", () => {
    const existing = [period({ id: "me" })];
    expect(hasCrossPeriodOverlap("2026-07-20", "2026-08-02", formSlots, existing, "me")).toBe(false);
  });

  it("detects overlap by concrete occurrence date when occurrence data exists", () => {
    const occ: Partial<SlotOccurrence> = {
      id: "o1",
      occurrence_date: "2026-07-21",
      start_time: "10:30:00",
      end_time: "11:30:00",
      is_enabled: true,
    };
    const existing = [
      { ...period({ slots: [] }), occurrences: [occ] } as unknown as CoachAvailability,
    ];
    const dated = [slot({ day_of_week: 2, occurrence_date: "2026-07-21" })];
    expect(hasCrossPeriodOverlap("2026-07-20", "2026-08-02", dated, existing)).toBe(true);
  });

  it("still flags a weekly-pattern overlap when occurrence dates do not collide (fallback always runs)", () => {
    // Pinned surprise: the by-date check finding nothing does NOT short-circuit to false;
    // the weekly pattern fallback runs unconditionally afterward.
    const occ: Partial<SlotOccurrence> = {
      id: "o1",
      occurrence_date: "2026-07-22",
      start_time: "10:00:00",
      end_time: "11:00:00",
      is_enabled: true,
    };
    const existing = [
      {
        ...period({ slots: [exSlot({ day_of_week: 1, start_time: "10:00", end_time: "11:00" })] }),
        occurrences: [occ],
      } as unknown as CoachAvailability,
    ];
    const dated = [slot({ day_of_week: 1, occurrence_date: "2026-07-20", start_time: "10:00", end_time: "11:00" })];
    expect(hasCrossPeriodOverlap("2026-07-20", "2026-08-02", dated, existing)).toBe(true);
  });
});
