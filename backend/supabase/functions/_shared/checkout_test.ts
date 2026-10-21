import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { checkoutExpiry, idempotencyKey, idsFromMetadata, minuteBucket } from "./checkout.ts";

Deno.test("checkoutExpiry is at least 32 minutes out and stable within a minute", () => {
  const now = Date.UTC(2026, 9, 21, 12, 0, 5);
  const a = checkoutExpiry(now);
  const b = checkoutExpiry(now + 50_000);
  assertEquals(a, b);
  assert(a.unix * 1000 - now >= 32 * 60_000);
  assert(a.unix * 1000 - now <= 34 * 60_000);
  assertEquals(new Date(a.iso).getTime(), a.unix * 1000);
});

Deno.test("checkoutExpiry moves on in the next minute", () => {
  const now = Date.UTC(2026, 9, 21, 12, 0, 59);
  assertNotEquals(checkoutExpiry(now).unix, checkoutExpiry(now + 2_000).unix);
});

Deno.test("minuteBucket floors to the minute", () => {
  assertEquals(minuteBucket(119_999), 1);
  assertEquals(minuteBucket(120_000), 2);
});

Deno.test("idempotencyKey ignores order and duplicates", async () => {
  const a = await idempotencyKey("booking-checkout", ["b", "a", "a"], "new");
  const b = await idempotencyKey("booking-checkout", ["a", "b"], "new");
  assertEquals(a, b);
  assert(a.startsWith("booking-checkout:"));
  assert(a.endsWith(":new"));
});

Deno.test("idempotencyKey changes with the rows and the attempt", async () => {
  const base = await idempotencyKey("booking-checkout", ["a", "b"], "new");
  assertNotEquals(base, await idempotencyKey("booking-checkout", ["a", "c"], "new"));
  assertNotEquals(base, await idempotencyKey("booking-checkout", ["a", "b"], "cs_test_old"));
});

Deno.test("idempotencyKey stays under Stripe's 255 character limit", async () => {
  const ids = Array.from({ length: 40 }, (_, i) => crypto.randomUUID() + i);
  const key = await idempotencyKey("booking-checkout", ids, "cs_live_" + "x".repeat(300));
  assert(key.length <= 255);
});

Deno.test("idsFromMetadata splits, trims and drops blanks", () => {
  assertEquals(idsFromMetadata(" a, b,,a "), ["a", "b"]);
  assertEquals(idsFromMetadata(undefined), []);
  assertEquals(idsFromMetadata(""), []);
});
