import { describe, expect, it } from "vitest";
import { dollarsFromCents, pdfSection } from "@/utils/dataExport";

describe("pdfSection", () => {
  it("turns records into a table and skips objects", () => {
    const section = pdfSection("Bookings", [
      { When: "2026-10-21", Status: "booked", Extra: { hidden: true } },
    ]);
    expect(section.columns).toEqual(["When", "Status", "Extra"]);
    expect(section.rows).toEqual([["2026-10-21", "booked", ""]]);
  });

  it("keeps an empty section empty", () => {
    expect(pdfSection("Packages", [])).toEqual({ title: "Packages", columns: [], rows: [] });
  });
});

describe("dollarsFromCents", () => {
  it("formats package prices", () => {
    expect(dollarsFromCents(30800)).toBe("$308.00");
    expect(dollarsFromCents(null)).toBe("");
  });
});
