import { describe, expect, it } from "vitest";
import type { CoachInviteRow } from "@/api/referrals";
import {
  INVITE_FILTERS,
  inviteCounts,
  inviteStatus,
  inviteSubline,
  isInviteWorkStatus,
  matchesFilter,
  relativeDay,
} from "../inviteStatus";

const row = (over: Partial<CoachInviteRow>): CoachInviteRow => ({
  id: "r1",
  coach_id: "c1",
  client_email: "maria@email.com",
  athlete_id: null,
  initiated_by: "coach",
  relationship_source: null,
  status: "invited",
  created_at: "2026-09-20T12:00:00Z",
  confirmed_at: null,
  client_name: "Maria Gomez",
  athlete_first_name: "Leo",
  invite_token: "t",
  expires_at: "2099-01-01T00:00:00Z",
  ...over,
});

describe("inviteStatus", () => {
  it("maps referral rows onto the Invites statuses", () => {
    expect(inviteStatus(row({}))).toBe("sent");
    expect(inviteStatus(row({ opened_at: "2026-09-21T00:00:00Z" }))).toBe("opened");
    expect(inviteStatus(row({ email_bounced_at: "2026-09-21T00:00:00Z" }))).toBe("bounced");
    expect(inviteStatus(row({ expires_at: "2020-01-01T00:00:00Z" }))).toBe("expired");
    expect(inviteStatus(row({ initiated_by: "athlete", status: "pending_confirmation" }))).toBe("approval");
    expect(inviteStatus(row({ status: "confirmed", athlete_id: "a1" }))).toBe("joined");
    expect(inviteStatus(row({ status: "declined", relationship_source: "platform" }))).toBe("marketplace");
    expect(inviteStatus(row({ status: "declined" }))).toBe("declined");
  });

  it("orders filters Needs approval, Waiting, Joined, All", () => {
    expect(INVITE_FILTERS.map(([k]) => k)).toEqual(["approval", "waiting", "joined", "all"]);
  });

  it("filters and counts like WC4 (marketplace stays off the work list)", () => {
    expect(isInviteWorkStatus("marketplace")).toBe(false);
    expect(isInviteWorkStatus("joined")).toBe(true);
    expect(matchesFilter("bounced", "waiting")).toBe(true);
    expect(matchesFilter("marketplace", "joined")).toBe(false);
    expect(matchesFilter("joined", "joined")).toBe(true);
    expect(matchesFilter("approval", "waiting")).toBe(false);
    expect(inviteCounts(["sent", "opened", "approval", "joined", "marketplace", "bounced"])).toEqual({
      total: 5, joined: 1, waiting: 2, approval: 1,
    });
  });

  it("shows the athlete and age, or the bounced email", () => {
    expect(inviteSubline(row({ athlete_age: 12 }), "sent")).toBe("Leo, 12");
    expect(inviteSubline(row({}), "bounced")).toBe("maria@email.com");
  });

  it("reads Today and Yesterday", () => {
    const now = new Date(2026, 8, 25, 15);
    expect(relativeDay(new Date(2026, 8, 25, 9).toISOString(), now)).toBe("Today");
    expect(relativeDay(new Date(2026, 8, 24, 9).toISOString(), now)).toBe("Yesterday");
    expect(relativeDay(new Date(2026, 8, 22, 9).toISOString(), now)).toBe("Tue, Sep 22");
  });
});
