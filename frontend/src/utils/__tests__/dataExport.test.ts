import { describe, expect, it } from "vitest";
import { bookingExportRows, dollarsFromCents, exportDate, exportTime, paymentStatusLabel, pdfSection } from "@/utils/dataExport";

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

describe("booking rows", () => {
  it("shows the session date and time, who it is with, status and payment", () => {
    const rows = bookingExportRows(
      [
        {
          status: "booked",
          payment_status: "credit",
          occurrence: { occurrence_date: "2026-11-24", start_time: "16:00:00", session_name: "1-on-1" },
          coach: { name: "Sam Lee" },
        },
        {
          status: "canceled",
          payment_status: "refunded",
          occurrence: { occurrence_date: "2026-11-02", start_time: "09:30:00", session_name: "Group" },
          coach: { name: "Ana Ruiz" },
        },
      ],
      "coach"
    );
    expect(rows).toEqual([
      { Date: "Mon, Nov 2, 2026", Time: "9:30 AM ET", Session: "Group", Coach: "Ana Ruiz", Status: "Cancelled", Payment: "Refunded" },
      { Date: "Tue, Nov 24, 2026", Time: "4:00 PM ET", Session: "1-on-1", Coach: "Sam Lee", Status: "Booked", Payment: "Session credit" },
    ]);
  });

  it("names the athlete for coaches", () => {
    const [row] = bookingExportRows([{ status: "booked", payment_status: "paid", occurrence: null, athlete: { full_name: "Dana Patel" } }], "athlete");
    expect(row.Athlete).toBe("Dana Patel");
    expect(row.Payment).toBe("Paid by card");
  });

  it("formats noon and midnight", () => {
    expect(exportTime("12:00:00")).toBe("12:00 PM ET");
    expect(exportTime("00:15:00")).toBe("12:15 AM ET");
    expect(exportDate("2026-11-24")).toBe("Tue, Nov 24, 2026");
    expect(paymentStatusLabel("something_new")).toBe("Something new");
  });
});
