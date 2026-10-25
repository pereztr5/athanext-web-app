import { assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert@1";
import { type CampAdmin, postgrestError, runCampFollowups } from "./camp_settle.ts";

// PostgREST answers a query on a column its schema cache doesn't know with an error object, not
// an Error. That is what the camp follow-ups hit after a migration applied without a reload.
const staleSchema = {
  message: "column camp_signups.followup_claimed_at does not exist",
  code: "42703",
  details: null,
  hint: null,
};

/** A query builder whose every call chains and whose result is `result`. */
const builder = (result: unknown) => {
  const chain: Record<string, unknown> = {};
  for (const name of ["update", "select", "eq", "not", "is", "or", "limit", "maybeSingle"]) {
    chain[name] = () => chain;
  }
  chain.then = (resolve: (value: unknown) => unknown) => resolve(result);
  return chain;
};

Deno.test("postgrestError labels a PostgREST error with its message, code and hint", () => {
  assertEquals(
    postgrestError("Camp follow-up claim failed for sign-up s1", staleSchema).message,
    "Camp follow-up claim failed for sign-up s1: column camp_signups.followup_claimed_at does not exist (42703)",
  );
  assertEquals(
    postgrestError("Step", { message: "permission denied", code: "42501", details: "row 1", hint: "grant it" }).message,
    "Step: permission denied (42501) details: row 1 hint: grant it",
  );
  assertEquals(postgrestError("Step", new Error("boom")).message, "Step: boom");
  assertEquals(postgrestError("Step", null).message, "Step: unknown error");
});

Deno.test("runCampFollowups throws and logs a labelled error when the claim query fails", async () => {
  const admin: CampAdmin = {
    rpc: () => builder({ data: null, error: null }),
    from: () => builder({ data: null, error: staleSchema }),
  };
  const logged: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => void logged.push(args);
  try {
    const err = await assertRejects(() => runCampFollowups(admin, "signup-1", "https://example.test"), Error);
    assertStringIncludes(err.message, "Camp follow-up claim failed for sign-up signup-1");
    assertStringIncludes(err.message, "followup_claimed_at does not exist (42703)");
  } finally {
    console.error = original;
  }
  assertEquals(logged.length, 1);
  assertStringIncludes(String(logged[0][0]), "followup_claimed_at does not exist");
});
