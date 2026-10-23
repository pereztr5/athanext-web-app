import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { familyPaymentLine, parseResendRequest, receiptEmail } from "./receipt_email.ts";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

Deno.test("family payment line matches the booking email", () => {
  assertEquals(familyPaymentLine("credit", 50, "Riley"), "Paid with a session credit.");
  assertEquals(familyPaymentLine("outside", 0, "Riley"), "This session is free.");
  assertEquals(familyPaymentLine("direct", 40, "Riley <b>"), "Pay Riley &lt;b&gt; directly: $40.");
  assertEquals(
    familyPaymentLine("paid", 52.5, "Riley"),
    "Paid: $52.50. Cancel with enough notice and it comes back as a session credit.",
  );
  assertEquals(familyPaymentLine("paid", 52.5, "Riley", false), "Paid: $52.50.");
});

Deno.test("resend request takes a checkout id or booking ids, never an address", () => {
  assertEquals(parseResendRequest({ stripe_session_id: " cs_test_1 ", to: "x@evil.com" }), {
    stripeSessionId: "cs_test_1",
    bookingIds: [],
  });
  assertEquals(parseResendRequest({ booking_ids: [ID_A, ID_B, ID_A] }), { stripeSessionId: null, bookingIds: [ID_A, ID_B] });
  assertEquals(parseResendRequest({ booking_ids: ["not-a-uuid"] }), null);
  assertEquals(parseResendRequest({ booking_ids: Array.from({ length: 21 }, (_, i) => ID_A.slice(0, -2) + String(i).padStart(2, "0")) }), null);
  assertEquals(parseResendRequest({}), null);
  assertEquals(parseResendRequest(null), null);
});

const booking = (over: Record<string, unknown>) => ({
  id: ID_A,
  status: "booked",
  payment_status: "paid",
  coach: { name: "Riley Chen" },
  session_type: "individual",
  pillar: "Finishing",
  occurrence_date: "2026-11-24",
  start_time: "16:00:00",
  location: "in_person",
  place: "Central Park",
  price: 50,
  charged: 54.2,
  ...over,
});

Deno.test("receipt lists every session and the total paid in the app", () => {
  const email = receiptEmail(
    {
      receipt_number: "AN-1234ABCD",
      bookings: [
        booking({}),
        booking({ id: ID_B, payment_status: "direct", coach: { name: "Sam Lee" }, charged: null, price: 40, location: "online" }),
      ],
    },
    "America/New_York",
  );
  assert(email.isReceipt);
  assertEquals(email.subject, "Your AthaNext receipt #AN-1234ABCD");
  assertStringIncludes(email.html, "Finishing session with Riley Chen");
  assertStringIncludes(email.html, "Tue, Nov 24 at 4:00 PM ET · Central Park");
  assertStringIncludes(email.html, "Paid: $54.20.");
  assertStringIncludes(email.html, "Pay Sam Lee directly: $40.");
  assertStringIncludes(email.html, "Video call");
  assertStringIncludes(email.html, "Total paid in the app: $54.20");
});

Deno.test("nothing paid in the app is a confirmation", () => {
  const email = receiptEmail({ receipt_number: "AN-1", bookings: [booking({ payment_status: "direct", charged: null })] });
  assert(!email.isReceipt);
  assertEquals(email.subject, "Your AthaNext confirmation #AN-1");
  assertEquals(email.html.includes("Total paid"), false);
});

Deno.test("requests say nothing is charged", () => {
  const email = receiptEmail({ bookings: [booking({ status: "requested", payment_status: "unpaid", charged: null })] });
  assertStringIncludes(email.html, "Nothing is charged until the coach accepts.");
  assertEquals(email.subject, "Your AthaNext confirmation");
});
