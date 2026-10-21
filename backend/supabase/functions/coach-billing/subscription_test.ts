import { assertEquals } from "jsr:@std/assert@1";
import { subscriptionIdFromInvoice } from "./subscription.ts";

Deno.test("reads the basil location", () => {
  assertEquals(subscriptionIdFromInvoice({ parent: { subscription_details: { subscription: "sub_1" } } }), "sub_1");
});

Deno.test("reads an expanded subscription object", () => {
  assertEquals(subscriptionIdFromInvoice({ parent: { subscription_details: { subscription: { id: "sub_2" } } } }), "sub_2");
});

Deno.test("falls back to the old top-level field", () => {
  assertEquals(subscriptionIdFromInvoice({ subscription: "sub_3" }), "sub_3");
  assertEquals(subscriptionIdFromInvoice({ subscription: { id: "sub_4" } }), "sub_4");
});

Deno.test("prefers parent over the old field", () => {
  assertEquals(
    subscriptionIdFromInvoice({ subscription: "sub_old", parent: { subscription_details: { subscription: "sub_new" } } }),
    "sub_new",
  );
});

Deno.test("returns null for one-off invoices", () => {
  assertEquals(subscriptionIdFromInvoice({ parent: null }), null);
  assertEquals(subscriptionIdFromInvoice({}), null);
  assertEquals(subscriptionIdFromInvoice(null), null);
  assertEquals(subscriptionIdFromInvoice({ subscription: "" }), null);
});
