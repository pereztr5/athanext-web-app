import { assert, assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert@1";
import {
  type CampAdmin,
  coachAccountEmail,
  coachRegistrationsUrl,
  postgrestError,
  runCampFollowups,
  sendCampSignupEmails,
} from "./camp_settle.ts";

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

/**
 * A fake service client for one sign-up: answers selects per table, records updates, and
 * delivers send-email calls (stubbed fetch) into `sent`.
 */
const fakeCamp = (opts: { kind: "paid" | "held"; stamped?: boolean; profile?: unknown; authEmail?: string | null }) => {
  const updates: Array<{ table: string; values: Record<string, unknown> }> = [];
  const rows: Record<string, unknown> = {
    camp_signups: {
      id: "s1",
      camp_id: "camp-1",
      coach_id: "coach-1",
      parent_email: "ana@example.com",
      amount_total_cents: opts.kind === "paid" ? 26845 : null,
      receipt_sent_at: opts.stamped ? "2026-10-29T00:00:00Z" : null,
      coach_notified_at: opts.stamped ? "2026-10-29T00:00:00Z" : null,
    },
    camp_registrations: [{ id: "r1", parent_name: "Ana Diaz", athlete_last_name: "Diaz", price_cents: 25000 }],
    configurations: { value: "support@athanext.com" },
    user_profiles: opts.profile === undefined ? { id: "user-1", email: "coach.profile@example.com" } : opts.profile,
    coaches: { email: "coach.listing@example.com" },
  };
  const admin: CampAdmin = {
    rpc: () =>
      builder({
        data: {
          camp: { name: "Fall Camp", starts_on: "2026-11-24", ends_on: "2026-11-26", location: "Park", coach_name: "Brayan" },
          athletes: [{ id: "r1", first_name: "Leo", status: opts.kind === "paid" ? "paid" : "held", group_name: "U10" }],
          held_until: opts.kind === "held" ? "2026-11-04T15:00:00Z" : null,
          account_exists: true,
        },
        error: null,
      }),
    from: (table: string) => {
      const chain = builder({ data: rows[table] ?? null, error: null });
      chain.update = (values: Record<string, unknown>) => {
        updates.push({ table, values });
        return chain;
      };
      return chain;
    },
    auth: { admin: { getUserById: () => Promise.resolve({ data: { user: opts.authEmail ? { email: opts.authEmail } : null } }) } },
  };
  return { admin, updates };
};

const withSendEmail = async (fn: (sent: Array<Record<string, unknown>>) => Promise<void>) => {
  const sent: Array<Record<string, unknown>> = [];
  const originalFetch = globalThis.fetch;
  const env = { url: Deno.env.get("SUPABASE_URL"), key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") };
  Deno.env.set("SUPABASE_URL", "https://supabase.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  globalThis.fetch = (_url: string | URL | Request, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)));
    return Promise.resolve(new Response("{}", { status: 200 }));
  };
  try {
    await fn(sent);
  } finally {
    globalThis.fetch = originalFetch;
    env.url === undefined ? Deno.env.delete("SUPABASE_URL") : Deno.env.set("SUPABASE_URL", env.url);
    env.key === undefined ? Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY") : Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", env.key);
  }
};

Deno.test("coach registrations link opens Registrations on /camps", () => {
  assertEquals(coachRegistrationsUrl("https://app.athanext.com", "c 1"), "https://app.athanext.com/camps?camp=c%201&view=registrations");
});

Deno.test("coachAccountEmail prefers the sign-in email, then the profile, then the coach listing", async () => {
  assertEquals(await coachAccountEmail(fakeCamp({ kind: "paid", authEmail: "coach@example.com" }).admin, "coach-1"), "coach@example.com");
  assertEquals(await coachAccountEmail(fakeCamp({ kind: "paid", authEmail: null }).admin, "coach-1"), "coach.profile@example.com");
  assertEquals(await coachAccountEmail(fakeCamp({ kind: "paid", profile: null }).admin, "coach-1"), "coach.listing@example.com");
});

Deno.test("paid sign-up: one 'New sign-up' email to the coach's account, stamped", async () => {
  await withSendEmail(async (sent) => {
    const { admin, updates } = fakeCamp({ kind: "paid", authEmail: "coach@example.com" });
    assertEquals(await sendCampSignupEmails(admin, "s1", "paid", "https://app.athanext.com"), true);
    const coachMail = sent.filter((m) => m.to === "coach@example.com");
    assertEquals(coachMail.length, 1);
    assertEquals(coachMail[0].subject, "New sign-up: Fall Camp");
    assertStringIncludes(String(coachMail[0].html), "Leo Diaz");
    assertStringIncludes(String(coachMail[0].html), "$250.00");
    assertStringIncludes(String(coachMail[0].html), "https://app.athanext.com/camps?camp=camp-1&amp;view=registrations");
    assertEquals(sent.filter((m) => m.to === "ana@example.com").length, 1);
    assert(updates.some((u) => u.table === "camp_signups" && "coach_notified_at" in u.values));
  });
});

Deno.test("held sign-up: 'Spot requested' to the coach with the amount owed", async () => {
  await withSendEmail(async (sent) => {
    const { admin } = fakeCamp({ kind: "held", authEmail: "coach@example.com" });
    assertEquals(await sendCampSignupEmails(admin, "s1", "held", "https://app.athanext.com"), true);
    const coachMail = sent.filter((m) => m.to === "coach@example.com");
    assertEquals(coachMail.length, 1);
    assertEquals(coachMail[0].subject, "Spot requested: Fall Camp");
    assertStringIncludes(String(coachMail[0].html), "To be paid offline:</strong> $250.00");
    assertStringIncludes(String(coachMail[0].html), "confirm payment");
  });
});

Deno.test("an already-notified sign-up (webhook retry) sends nothing", async () => {
  await withSendEmail(async (sent) => {
    const { admin, updates } = fakeCamp({ kind: "paid", stamped: true, authEmail: "coach@example.com" });
    assertEquals(await sendCampSignupEmails(admin, "s1", "paid", "https://app.athanext.com"), true);
    assertEquals(sent.length, 0);
    assertEquals(updates.length, 0);
  });
});
