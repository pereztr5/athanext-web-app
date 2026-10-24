import { describe, expect, it } from "vitest";
import type { CoachCamp } from "@/api/camps";
import { campSpots, comingUpCamps } from "@/utils/coachHomeCamps";

const camp = (over: Partial<CoachCamp> = {}): CoachCamp => ({
  id: "c1",
  coach_id: "coach",
  name: "Winter camp",
  description: null,
  price_cents: 15000,
  starts_on: "2026-11-09",
  ends_on: "2026-11-12",
  days: 4,
  location: null,
  capacity: null,
  taken: 1,
  slug: "winter",
  coach_slug: "coach",
  cover_url: null,
  included: [],
  tags: [],
  pay_direct: true,
  linked_coach: null,
  co_coach_ids: [],
  age_min: null,
  age_max: null,
  is_active: true,
  published: true,
  published_at: "2026-10-01T00:00:00Z",
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  groups: [
    { id: "g1", name: "A", description: null, start_time: "09:00", end_time: "12:00", spots: 12, taken: 1, sort_order: 0 },
    { id: "g2", name: "B", description: null, start_time: "13:00", end_time: "16:00", spots: 8, taken: 0, sort_order: 1 },
  ],
  paid_count: 0,
  waiting_count: 2,
  ...over,
});

// Oct 24, 2026, 10am Eastern.
const NOW = new Date("2026-10-24T14:00:00Z");

describe("comingUpCamps", () => {
  it("keeps published camps that haven't ended and drops ended, draft, inactive and undated ones", () => {
    const list = comingUpCamps(
      [
        camp({ id: "upcoming" }),
        camp({ id: "running", starts_on: "2026-10-22", ends_on: "2026-10-25" }),
        camp({ id: "ends-today", starts_on: "2026-10-20", ends_on: "2026-10-24" }),
        camp({ id: "ended", starts_on: "2026-10-20", ends_on: "2026-10-23" }),
        camp({ id: "draft", published: false }),
        camp({ id: "inactive", is_active: false }),
        camp({ id: "undated", starts_on: null, ends_on: null }),
      ],
      NOW
    );
    expect(list.map((c) => c.camp.id)).toEqual(["ends-today", "running", "upcoming"]);
  });

  it("treats a one-day camp without an end date as ending on its start day", () => {
    expect(comingUpCamps([camp({ starts_on: "2026-10-24", ends_on: null })], NOW)).toHaveLength(1);
    expect(comingUpCamps([camp({ starts_on: "2026-10-23", ends_on: null })], NOW)).toHaveLength(0);
  });

  it("sorts by start date, soonest first", () => {
    const list = comingUpCamps(
      [camp({ id: "dec", starts_on: "2026-12-01", ends_on: "2026-12-02" }), camp({ id: "nov" }), camp({ id: "oct", starts_on: "2026-10-30", ends_on: "2026-10-30" })],
      NOW
    );
    expect(list.map((c) => c.camp.id)).toEqual(["oct", "nov", "dec"]);
  });

  it("uses the Eastern day for today, not UTC", () => {
    // 11:30pm Eastern on Oct 23 is already Oct 24 in UTC.
    const late = new Date("2026-10-24T03:30:00Z");
    const list = comingUpCamps([camp({ starts_on: "2026-10-20", ends_on: "2026-10-23" })], late);
    expect(list).toHaveLength(1);
    expect(list[0].nextDay).toBe("2026-10-23");
  });

  it("links the schedule to the first day still ahead", () => {
    const [upcoming, running] = [
      comingUpCamps([camp()], NOW)[0],
      comingUpCamps([camp({ starts_on: "2026-10-22", ends_on: "2026-10-26" })], NOW)[0],
    ];
    expect(upcoming.nextDay).toBe("2026-11-09");
    expect(running.nextDay).toBe("2026-10-24");
  });

  it("writes the sign-up line from taken and group spots", () => {
    const [c] = comingUpCamps([camp()], NOW);
    expect(c.signUps).toBe("1 of 20 signed up");
    expect(comingUpCamps([camp({ groups: [], capacity: 15, taken: 3 })], NOW)[0].signUps).toBe("3 of 15 signed up");
    expect(comingUpCamps([camp({ groups: [], capacity: null, taken: 2 })], NOW)[0].signUps).toBe("2 signed up");
  });

  it("counts held spots not marked paid at the camp price", () => {
    const [c] = comingUpCamps([camp({ waiting_count: 2, price_cents: 15000 })], NOW);
    expect(c.toCollectCents).toBe(30000);
    expect(c.toCollect).toBe("$300 to collect");
    expect(comingUpCamps([camp({ waiting_count: 1, price_cents: 6550 })], NOW)[0].toCollect).toBe("$65.50 to collect");
    expect(comingUpCamps([camp({ waiting_count: 0 })], NOW)[0].toCollect).toBeNull();
    expect(comingUpCamps([camp({ waiting_count: undefined })], NOW)[0].toCollect).toBeNull();
  });

  it("returns nothing for no data", () => {
    expect(comingUpCamps(undefined, NOW)).toEqual([]);
    expect(comingUpCamps([], NOW)).toEqual([]);
  });
});

describe("campSpots", () => {
  it("sums group spots and falls back to capacity", () => {
    expect(campSpots({ groups: camp().groups, capacity: 5 })).toBe(20);
    expect(campSpots({ groups: [], capacity: 5 })).toBe(5);
  });
});
