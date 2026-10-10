import { describe, it, expect } from "vitest";
import {
  normalizeTimeFormat,
  isValidTimeFormat,
  validateSlot,
  validateAvailabilityForm,
  checkSlotOverlaps,
  formatTime,
  calculateEndTime,
  generateErrorMessage,
  hasValidationErrors,
} from "@/utils/availabilityValidation";
import type { SlotFormData, AvailabilityFormData, DayOfWeek } from "@/types/availability";

const makeSlot = (overrides: Record<string, unknown> = {}): SlotFormData =>
  ({
    day_of_week: 1,
    is_enabled: true,
    session_name: "Morning Training",
    price: 50,
    duration_minutes: 60,
    start_time: "09:00",
    end_time: "10:00",
    session_type: "individual",
    location: "online",
    pillar_slot: "technical",
    ...overrides,
  } as unknown as SlotFormData);

const emptySlots = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as unknown as Record<
  DayOfWeek,
  SlotFormData[]
>;

describe("normalizeTimeFormat", () => {
  it("strips seconds", () => expect(normalizeTimeFormat("09:30:00")).toBe("09:30"));
  it("passes single-digit hours through UNCHANGED (no zero-pad)", () => {
    expect(normalizeTimeFormat("9:30")).toBe("9:30"); // regex requires 2 digits; no match -> input returned
  });
  it("returns empty for empty", () => expect(normalizeTimeFormat("")).toBe(""));
});

describe("isValidTimeFormat", () => {
  it("accepts HH:mm", () => expect(isValidTimeFormat("09:30")).toBe(true));
  it("rejects 24:00", () => expect(isValidTimeFormat("24:00")).toBe(false));
  it("rejects single-digit hour", () => expect(isValidTimeFormat("9:30")).toBe(false));
});

describe("validateSlot", () => {
  it("returns no errors for a valid slot", () => {
    expect(validateSlot(makeSlot())).toEqual({});
  });
  it("skips validation entirely for disabled slots", () => {
    expect(validateSlot(makeSlot({ is_enabled: false, price: -5, session_name: "" }))).toEqual({});
  });
  it("requires session name and pillar", () => {
    const errors = validateSlot(makeSlot({ session_name: "  ", pillar_slot: "" }));
    expect(errors.session_name).toBeTruthy();
    expect(errors.pillar_slot).toBe("Pillar is required");
  });
  it("rejects price <= 0 and > 9999.99", () => {
    expect(validateSlot(makeSlot({ price: 0 })).price).toBeTruthy();
    expect(validateSlot(makeSlot({ price: 10000 })).price).toBeTruthy();
  });
  it("rejects durations outside the allowed set", () => {
    expect(validateSlot(makeSlot({ duration_minutes: 15 })).duration_minutes).toBeTruthy();
  });
  it("rejects end before start (reported as duration mismatch — see Surprises)", () => {
    const errors = validateSlot(makeSlot({ start_time: "10:00", end_time: "09:00", duration_minutes: 60 }));
    // The end<=start message is set first, then unconditionally overwritten by
    // the duration-mismatch check (range = -60min !== 60min).
    expect(errors.time_range).toContain("doesn't match time range");
  });
  it("rejects duration/time-range mismatch", () => {
    const errors = validateSlot(makeSlot({ start_time: "09:00", end_time: "10:00", duration_minutes: 30 }));
    expect(errors.time_range).toContain("doesn't match time range");
  });
});

describe("checkSlotOverlaps", () => {
  it("detects overlap within a day", () => {
    const slots = {
      ...emptySlots,
      1: [makeSlot({ start_time: "09:00", end_time: "10:00" }), makeSlot({ start_time: "09:30", end_time: "10:30" })],
    };
    expect(checkSlotOverlaps(slots)).toEqual(["Monday"]);
  });
  it("allows back-to-back slots", () => {
    const slots = {
      ...emptySlots,
      1: [makeSlot({ start_time: "09:00", end_time: "10:00" }), makeSlot({ start_time: "10:00", end_time: "11:00" })],
    };
    expect(checkSlotOverlaps(slots)).toEqual([]);
  });
  it("ignores disabled slots", () => {
    const slots = {
      ...emptySlots,
      1: [makeSlot({ start_time: "09:00", end_time: "10:00" }), makeSlot({ start_time: "09:30", end_time: "10:30", is_enabled: false })],
    };
    expect(checkSlotOverlaps(slots)).toEqual([]);
  });
});

describe("validateAvailabilityForm", () => {
  it("flags end date before start date", () => {
    const form: AvailabilityFormData = {
      start_date: new Date(2026, 6, 26),
      end_date: new Date(2026, 6, 20),
      slots: { ...emptySlots, 1: [makeSlot()] },
    };
    expect(validateAvailabilityForm(form).dateRange).toBe("End date must be after start date");
  });
  it("requires at least one enabled slot", () => {
    const form: AvailabilityFormData = {
      start_date: new Date(2026, 6, 20),
      end_date: new Date(2026, 6, 26),
      slots: emptySlots,
    };
    expect(validateAvailabilityForm(form).general).toBe("At least one day must be enabled");
  });
});

describe("formatTime", () => {
  it("formats PM times", () => expect(formatTime("13:05")).toBe("1:05 pm"));
  it("formats midnight as 12 AM", () => expect(formatTime("00:30")).toBe("12:30 am"));
  it("returns empty for invalid input", () => expect(formatTime("9:30")).toBe(""));
});

describe("calculateEndTime", () => {
  it("adds duration", () => expect(calculateEndTime("09:00", 90)).toBe("10:30"));
  it("wraps past midnight", () => expect(calculateEndTime("23:30", 60)).toBe("00:30"));
  it("returns empty for invalid start", () => expect(calculateEndTime("9:00", 60)).toBe(""));
});

describe("generateErrorMessage", () => {
  it("prefixes date-range errors with the calendar emoji", () => {
    expect(generateErrorMessage({ dateRange: "End date must be after start date" })).toBe(
      "📅 End date must be after start date"
    );
  });
});

describe("hasValidationErrors", () => {
  it("is false for empty errors", () => expect(hasValidationErrors({})).toBe(false));
  it("is true for overlap/dateRange", () => {
    expect(hasValidationErrors({ overlap: "x" })).toBe(true);
    expect(hasValidationErrors({ dateRange: "x" })).toBe(true);
  });
  it("IGNORES the general error (current behavior — see Surprises)", () => {
    expect(hasValidationErrors({ general: "At least one day must be enabled" })).toBe(false);
  });
});
