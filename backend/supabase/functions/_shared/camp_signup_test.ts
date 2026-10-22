import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  birthYearRange,
  campCheckoutFees,
  campDirectAllowed,
  campErrorStatus,
  campMetadata,
  campPath,
  campPlatformWaived,
  campSource,
  clientIp,
  finishAccountUrl,
  hashIp,
  parseCampMetadata,
  rateWindowStart,
  resolveAppOrigin,
  retryAfterSeconds,
  validateCampSignup,
} from "./camp_signup.ts";
import { checkoutFees } from "./fees.ts";

const NOW = new Date(Date.UTC(2026, 9, 22, 12));
const CAMP = "11111111-1111-4111-8111-111111111111";
const GROUP = "22222222-2222-4222-8222-222222222222";
const config = { platformPercent: 10, processingPercent: 2.9, processingFixedCents: 30 };

const form = (over: Record<string, unknown> = {}) => ({
  camp_id: CAMP,
  src: "link",
  pay_method: "card",
  parent: { name: " Ana Diaz ", email: "Ana@Example.com ", phone: "" },
  waiver: true,
  athletes: [{ first_name: "Leo", last_name: "Diaz", birth_year: 2014, group_id: GROUP }],
  ...over,
});

Deno.test("validateCampSignup cleans a good form", () => {
  const r = validateCampSignup(form(), NOW);
  assert(r.ok);
  if (!r.ok) return;
  assertEquals(r.value.parent, { name: "Ana Diaz", email: "ana@example.com", phone: null });
  assertEquals(r.value.source, "link");
  assertEquals(r.value.athletes[0].birth_year, 2014);
  assertEquals(r.value.photo_consent, false);
});

Deno.test("validateCampSignup uses the form's copy for each missing field", () => {
  const r = validateCampSignup(
    form({
      parent: { name: "", email: "nope" },
      waiver: false,
      athletes: [{ first_name: "", last_name: "", birth_year: "13", group_id: "" }],
    }),
    NOW,
  );
  assert(!r.ok);
  if (r.ok) return;
  assertEquals(r.errors["parent.name"], "Add your name");
  assertEquals(r.errors["parent.email"], "Add an email we can send the receipt to");
  assertEquals(r.errors["athletes.0.first_name"], "Add a first name");
  assertEquals(r.errors["athletes.0.last_name"], "Add a last name");
  assertEquals(r.errors["athletes.0.birth_year"], "Add a birth year, like 2013");
  assertEquals(r.errors["athletes.0.group_id"], "Pick a group");
  assertEquals(r.errors.waiver, "Agree to the waiver to continue");
});

Deno.test("validateCampSignup checks lengths, birth year range, siblings and the athlete limit", () => {
  const { min, max } = birthYearRange(NOW);
  assertEquals([min, max], [1946, 2024]);
  const long = "x".repeat(61);
  const r = validateCampSignup(
    form({
      note: "n".repeat(501),
      athletes: [
        { first_name: long, last_name: "Diaz", birth_year: 2025, group_id: GROUP },
        { first_name: "Mia", last_name: "Diaz", birth_year: 1900, group_id: GROUP },
        { first_name: "mia", last_name: "diaz", birth_year: 2015, group_id: GROUP },
      ],
    }),
    NOW,
  );
  assert(!r.ok);
  if (r.ok) return;
  assertEquals(r.errors.note, "Keep the note under 500 characters");
  assertEquals(r.errors["athletes.0.first_name"], "Add a first name");
  assertEquals(r.errors["athletes.0.birth_year"], "Add a birth year, like 2013");
  assertEquals(r.errors["athletes.1.birth_year"], "Add a birth year, like 2013");
  assertEquals(r.errors["athletes.2.first_name"], "mia is on the form twice");

  const seven = Array.from({ length: 7 }, (_, i) => ({ first_name: `K${i}`, last_name: "D", birth_year: 2014, group_id: GROUP }));
  const tooMany = validateCampSignup(form({ athletes: seven }), NOW);
  assert(!tooMany.ok);
  if (!tooMany.ok) assertEquals(tooMany.errors.athletes, "Add up to 6 athletes");
});

Deno.test("siblings with different names on one form are fine", () => {
  const r = validateCampSignup(
    form({
      athletes: [
        { first_name: "Leo", last_name: "Diaz", birth_year: 2014, group_id: GROUP },
        { first_name: "Mia", last_name: "Diaz", birth_year: "2016", group_id: GROUP },
      ],
    }),
    NOW,
  );
  assert(r.ok);
});

Deno.test("source: only src=link is the coach's own link", () => {
  assertEquals(campSource("link"), "link");
  assertEquals(campSource(" LINK "), "link");
  assertEquals(campSource(undefined), "marketplace");
  assertEquals(campSource("marketplace"), "marketplace");
  assertEquals(campSource("anything"), "marketplace");
});

Deno.test("fee by source: link or client pays card processing only, marketplace pays the platform fee", () => {
  assertEquals(campPlatformWaived("link", false), true);
  assertEquals(campPlatformWaived("marketplace", true), true);
  assertEquals(campPlatformWaived("marketplace", false), false);

  const own = campCheckoutFees(26000, 2, true, config);
  assertEquals(own.platformCents, 0);
  assert(own.processingCents > 0);
  assertEquals(own.lines.length, 2);
  assertEquals(own.lines.reduce((n, l) => n + l.totalCents, 0), own.totalCents);

  const market = campCheckoutFees(26000, 2, false, config);
  assertEquals(market.platformCents, 2 * 2600);
  // Same numbers as a package of the same price: one fee module.
  const pkg = checkoutFees([{ listCents: 26000, kind: "package" }, { listCents: 26000, kind: "package" }], config);
  assertEquals(market.totalCents, pkg.totalCents);
});

Deno.test("direct pay only when the camp allows it and the family is the coach's own", () => {
  assertEquals(campDirectAllowed(true, "link", false), true);
  assertEquals(campDirectAllowed(true, "marketplace", true), true);
  assertEquals(campDirectAllowed(true, "marketplace", false), false);
  assertEquals(campDirectAllowed(false, "link", true), false);
});

Deno.test("camp metadata round-trips and ignores other Checkouts", () => {
  const ids = ["33333333-3333-4333-8333-333333333333", "44444444-4444-4444-8444-444444444444"];
  const meta = campMetadata({
    signupId: "55555555-5555-4555-8555-555555555555",
    campId: CAMP,
    coachId: "66666666-6666-4666-8666-666666666666",
    registrationIds: ids,
    source: "link",
    platformWaived: true,
    listCents: 26000,
    athletes: 2,
  });
  for (const value of Object.values(meta)) assert(value.length <= 500);
  const parsed = parseCampMetadata(meta);
  assertEquals(parsed?.registrationIds, ids);
  assertEquals(parsed?.signupId, "55555555-5555-4555-8555-555555555555");
  assertEquals(parsed?.platformWaived, true);
  assertEquals(parsed?.listCents, 26000);
  assertEquals(parsed?.athletes, 2);

  assertEquals(parseCampMetadata({ type: "package_purchase" }), null);
  assertEquals(parseCampMetadata({ kind: "invoice", invoice_id: "x" }), null);
  assertEquals(parseCampMetadata({ kind: "camp", signup_id: "not-a-uuid" }), null);
  assertEquals(parseCampMetadata(null), null);
  // Junk in the id list is dropped.
  assertEquals(parseCampMetadata({ ...meta, registration_ids: `${ids[0]},bad,${ids[0]}` })?.registrationIds, [ids[0]]);
});

Deno.test("error hints map to status codes", () => {
  assertEquals(campErrorStatus("rate_ip"), 429);
  assertEquals(campErrorStatus("rate_direct"), 429);
  assertEquals(campErrorStatus("group_full"), 409);
  assertEquals(campErrorStatus("duplicate"), 409);
  assertEquals(campErrorStatus("closed"), 404);
  assertEquals(campErrorStatus("invalid"), 400);
  assertEquals(campErrorStatus(null), 400);
});

Deno.test("rate-limit window helpers", () => {
  const now = Date.UTC(2026, 9, 22, 12, 0, 0);
  assertEquals(rateWindowStart(now), "2026-10-22T11:00:00.000Z");
  assertEquals(retryAfterSeconds("2026-10-22T11:30:00.000Z", now), 1800);
  assertEquals(retryAfterSeconds("2026-10-22T10:00:00.000Z", now), 0);
  assertEquals(retryAfterSeconds(null, now), 0);
});

Deno.test("app origin allowlist for redirects and email links", () => {
  const fallback = "https://athanext.com";
  assertEquals(resolveAppOrigin("http://localhost:5173", fallback), "http://localhost:5173");
  assertEquals(resolveAppOrigin("https://athanext-staging.vercel.app", fallback), "https://athanext-staging.vercel.app");
  assertEquals(resolveAppOrigin("https://www.athanext.com", fallback), "https://www.athanext.com");
  assertEquals(resolveAppOrigin("https://evil.vercel.app", fallback), fallback);
  assertEquals(resolveAppOrigin("http://athanext.com", fallback), fallback);
  assertEquals(resolveAppOrigin("https://athanext.com.evil.io", fallback), fallback);
  assertEquals(resolveAppOrigin(null, fallback), fallback);
});

Deno.test("paths and links encode slugs and emails", () => {
  assertEquals(campPath("josé", "fall-camp"), "/camps/jos%C3%A9/fall-camp");
  assertEquals(
    finishAccountUrl("https://athanext.com", "a+b@x.com", "s1"),
    "https://athanext.com/auth?mode=signup&email=a%2Bb%40x.com&camp_signup=s1",
  );
});

Deno.test("client ip and hash: first forwarded address, never stored raw", async () => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" });
  assertEquals(clientIp(headers), "203.0.113.5");
  const a = await hashIp("203.0.113.5", "salt");
  const b = await hashIp("203.0.113.5", "salt");
  assertEquals(a, b);
  assert(a && a.length === 64 && !a.includes("203"));
  assertEquals(await hashIp("", "salt"), null);
});
