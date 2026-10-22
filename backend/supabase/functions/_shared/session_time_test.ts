import { assertEquals } from "jsr:@std/assert@1";
import { easternInstant, formatSessionWhen } from "./session_time.ts";

Deno.test("Eastern wall time becomes the right instant, across DST", () => {
  assertEquals(easternInstant("2026-11-24", "16:00:00")?.toISOString(), "2026-11-24T21:00:00.000Z");
  assertEquals(easternInstant("2026-07-04", "09:30:00")?.toISOString(), "2026-07-04T13:30:00.000Z");
  assertEquals(easternInstant("2026-11-01", "12:00")?.toISOString(), "2026-11-01T17:00:00.000Z");
  assertEquals(easternInstant("nope", "16:00"), null);
});

Deno.test("formats in the coach's zone with a short label", () => {
  assertEquals(formatSessionWhen("2026-11-24", "16:00:00"), "Tue, Nov 24 at 4:00 PM ET");
  assertEquals(formatSessionWhen("2026-11-24", "16:00:00", "America/New_York"), "Tue, Nov 24 at 4:00 PM ET");
  assertEquals(formatSessionWhen("2026-11-24", "16:00:00", "America/Los_Angeles"), "Tue, Nov 24 at 1:00 PM PT");
  assertEquals(formatSessionWhen("2026-07-04", "09:30:00", "America/Chicago"), "Sat, Jul 4 at 8:30 AM CT");
  assertEquals(formatSessionWhen("2026-11-24", "16:00:00", "Not/AZone"), "Tue, Nov 24 at 4:00 PM ET");
});

Deno.test("an evening session can be the next day elsewhere", () => {
  assertEquals(formatSessionWhen("2026-11-24", "21:00:00", "Europe/London"), "Wed, Nov 25 at 2:00 AM GMT");
});
