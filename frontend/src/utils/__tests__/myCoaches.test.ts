import { describe, expect, it } from "vitest";
import { isConfirmedBooking, removeCoachQuestion, showsAsMyCoach, withoutCoach, firstNameOf, type CoachLink } from "@/utils/myCoaches";

const none: CoachLink = { bookingStatuses: [], hasPackage: false, acceptedInvite: false, hidden: false };

describe("who shows in the Coaches card", () => {
  it("counts confirmed sessions only", () => {
    expect(isConfirmedBooking("booked")).toBe(true);
    expect(isConfirmedBooking("completed")).toBe(true);
    expect(isConfirmedBooking("no_show")).toBe(true);
    for (const status of ["requested", "pending_payment", "canceled", "refunded", null]) {
      expect(isConfirmedBooking(status)).toBe(false);
    }
  });

  it("shows a coach after a confirmed session, a package or an accepted invite", () => {
    expect(showsAsMyCoach({ ...none, bookingStatuses: ["canceled", "booked"] })).toBe(true);
    expect(showsAsMyCoach({ ...none, hasPackage: true })).toBe(true);
    expect(showsAsMyCoach({ ...none, acceptedInvite: true })).toBe(true);
  });

  it("doesn't show a coach for a pending request, a cancelled session or an intro call alone", () => {
    expect(showsAsMyCoach({ ...none, bookingStatuses: ["requested", "pending_payment"] })).toBe(false);
    expect(showsAsMyCoach({ ...none, bookingStatuses: ["canceled"] })).toBe(false);
    expect(showsAsMyCoach({ ...none, introCalls: 1 })).toBe(false);
  });

  it("hides a removed coach even with sessions", () => {
    expect(showsAsMyCoach({ ...none, bookingStatuses: ["completed"], hidden: true })).toBe(false);
  });

  it("drops a removed coach from the list and words the question", () => {
    expect(withoutCoach([{ id: "a" }, { id: "b" }], "a")).toEqual([{ id: "b" }]);
    expect(removeCoachQuestion("Michael Reed")).toBe("Remove Michael Reed from your coaches?");
    expect(firstNameOf("Michael Reed")).toBe("Michael");
  });
});
