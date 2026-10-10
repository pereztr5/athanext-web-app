import { describe, it, expect } from "vitest";
import { buildIcs, icsDate, icsEscape } from "@/utils/ics";
import { zonedWallTimeToUtc } from "@/utils/dateHelpers";

const now = new Date(Date.UTC(2026, 9, 10, 12, 0, 0));

describe("ics", () => {
  it("formats UTC instants", () => {
    expect(icsDate(new Date(Date.UTC(2026, 0, 5, 9, 3, 7)))).toBe("20260105T090307Z");
  });

  it("escapes text values", () => {
    expect(icsEscape("Field 2, Riverside; North\\Gate\nBring water")).toBe("Field 2\\, Riverside\\; North\\\\Gate\\nBring water");
  });

  it("writes one event per session, Eastern wall times converted to UTC", () => {
    const start = zonedWallTimeToUtc("2026-10-14", "16:00:00")!;
    const end = zonedWallTimeToUtc("2026-10-14", "17:00:00")!;
    const ics = buildIcs(
      [
        { uid: "b1@athanext", title: "Finishing session with Riley Chen", start, end, location: "Riverside Park" },
        { uid: "b2@athanext", title: "Group session with Sam Ortiz", start, end },
      ],
      now
    );
    const lines = ics.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(2);
    // 4:00 pm EDT is 20:00 UTC.
    expect(lines).toContain("DTSTART:20261014T200000Z");
    expect(lines).toContain("DTEND:20261014T210000Z");
    expect(lines).toContain("DTSTAMP:20261010T120000Z");
    expect(lines).toContain("SUMMARY:Finishing session with Riley Chen");
    expect(lines).toContain("LOCATION:Riverside Park");
    expect(lines.filter((l) => l.startsWith("LOCATION:"))).toHaveLength(1);
  });

  it("uses standard time in winter", () => {
    const start = zonedWallTimeToUtc("2026-12-02", "16:00:00")!;
    const ics = buildIcs([{ uid: "w", title: "x", start, end: start }], now);
    expect(ics).toContain("DTSTART:20261202T210000Z");
  });

  it("folds long lines and skips invalid dates", () => {
    const start = new Date(Date.UTC(2026, 9, 14, 20));
    const ics = buildIcs(
      [
        { uid: "long", title: "A".repeat(120), start, end: start },
        { uid: "bad", title: "Bad", start: new Date(NaN), end: start },
      ],
      now
    );
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
    expect(ics).toContain("\r\n A");
    expect(ics).not.toContain("UID:bad");
  });
});
