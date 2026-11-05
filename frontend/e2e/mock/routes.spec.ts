import fs from "node:fs";
import path from "node:path";
import { test, expect } from "./test";
import { IDS, type Persona } from "./personas";
import type { MockBackend } from "./backend";
import { seedOwnCoachProfile } from "./data/profile";
import { expectNoSidewaysScroll, settle } from "./helpers";

// Every route in src/routes.tsx, opened as every kind of visitor: where it lands, that it
// renders, that it fits the window and that nothing crashes. Pages that need data to show
// anything (a session, an athlete, a coach) are opened with that data in the spec named by
// `coveredBy`. The last test fails when a route is added to ROUTES without a row here.

type Who = Persona | "signedOut";
type Expect = { url: RegExp; text: RegExp };
// `seed` adds the data a page needs to render past its loading state.
type RouteCase = { pattern: string; open?: string; expect?: Partial<Record<Who, Expect>>; coveredBy?: string; seed?: (backend: MockBackend) => void };

const at = (url: RegExp, text: RegExp): Expect => ({ url, text });
const SIGN_IN = at(/\/auth\?mode=signin$/, /welcome back/i);
const SIGN_UP = at(/\/auth\?mode=signup$/, /welcome to athanext/i);
const ATHLETE_HOME = at(/\/dashboard$/, /set up your athlete profile/i);
const COACH_HOME = at(/\/dashboard$/, /good (morning|afternoon|evening), casey/i);
const BOOK = at(/\/book$/, /book a session/i);

/** A page that looks the same to everyone. */
const everyone = (url: RegExp, text: RegExp): Partial<Record<Who, Expect>> => ({ signedOut: at(url, text), coach: at(url, text), parent: at(url, text), athlete: at(url, text) });

/** A signed-in page: sign-in for visitors, sign-up for unfinished accounts. */
const protectedPage = (signedIn: Partial<Record<Persona, Expect>>): Partial<Record<Who, Expect>> => ({ signedOut: SIGN_IN, incomplete: SIGN_UP, ...signedIn });

/** A coach-only page: athletes and parents go home. */
const coachOnly = (coach: Expect) => protectedPage({ coach, parent: ATHLETE_HOME, athlete: ATHLETE_HOME });

const ROUTE_CASES: RouteCase[] = [
  // Home and the auth flow
  { pattern: "/", expect: { signedOut: at(/\/$/, /welcome back/i), coach: COACH_HOME, parent: ATHLETE_HOME, athlete: ATHLETE_HOME, incomplete: SIGN_UP } },
  { pattern: "/dashboard", expect: protectedPage({ coach: COACH_HOME, parent: ATHLETE_HOME, athlete: ATHLETE_HOME }) },
  { pattern: "/auth", expect: { signedOut: at(/\/auth$/, /welcome back/i), coach: COACH_HOME, parent: ATHLETE_HOME } },
  { pattern: "/forgot-password", expect: { signedOut: at(/\/forgot-password$/, /forgot password\?/i) } },
  { pattern: "/reset-password", expect: { signedOut: at(/\/reset-password$/, /reset link is invalid/i) } },
  { pattern: "/signupconfirmation", expect: { signedOut: at(/\/signupconfirmation$/, /check your email/i) } },

  // Marketing and legal
  { pattern: "/why-athalink", expect: everyone(/\/why-athalink$/, /why athanext/i) },
  { pattern: "/become-a-coach", expect: everyone(/\/become-a-coach$/, /become an athanext coach/i) },
  { pattern: "/partnerships", expect: everyone(/\/partnerships$/, /resource marketplace/i) },
  { pattern: "/partnership-success", expect: { signedOut: at(/\/partnership-success$/, /verification issue/i) } },
  { pattern: "/soccer", expect: everyone(/\/soccer$/, /holistic soccer development/i) },
  { pattern: "/rowing", expect: everyone(/\/rowing$/, /holistic rowing development/i) },
  { pattern: "/about", expect: everyone(/\/about$/, /our mission & vision/i) },
  { pattern: "/privacy-policy", expect: everyone(/\/privacy-policy$/, /privacy policy/i) },
  { pattern: "/terms-and-conditions", expect: everyone(/\/terms-and-conditions$/, /terms & conditions/i) },
  // With no published coach terms the page opens Terms and conditions instead.
  { pattern: "/coach-terms", expect: everyone(/\/terms-and-conditions$/, /terms & conditions/i) },
  { pattern: "/contact", expect: everyone(/\/contact$/, /send us a message/i) },
  { pattern: "/gear", expect: everyone(/\/gear$/, /gear/i) },
  { pattern: "/gear/:handle", coveredBy: "gear.spec.ts" },

  // Directory and public profiles
  { pattern: "/coaches", expect: everyone(/\/coaches$/, /view all coaches/i) },
  { pattern: "/coach/:id", coveredBy: "booking.spec.ts" },
  { pattern: "/coach/:id/pricing", coveredBy: "booking.spec.ts" },
  { pattern: "/offers/:id", open: `/offers/${IDS.offer}`, expect: { signedOut: at(/\/offers\//, /isn't available anymore/i) } },
  { pattern: "/organizations/:slug", open: "/organizations/no-such-org", expect: { signedOut: at(/\/organizations\/no-such-org$/, /organization not found/i) } },
  { pattern: "/invite/:token", open: "/invite/no-such-token", expect: { signedOut: at(/\/invite\/no-such-token$/, /invite link can't be used/i), parent: at(/\/invite\/no-such-token$/, /invite link can't be used/i) } },
  { pattern: "/:coachSlug/:campSlug", open: `/${IDS.coachSlug}/no-such-camp`, expect: everyone(/\/casey-coach\/no-such-camp$/, /this camp isn't open/i) },
  { pattern: "/camps/:coachSlug/:campSlug", open: `/camps/${IDS.coachSlug}/no-such-camp?src=link`, expect: { signedOut: at(/\/casey-coach\/no-such-camp\?src=link$/, /this camp isn't open/i) } },

  // Signed in: both roles
  { pattern: "/my-sessions", expect: protectedPage({ coach: at(/\/my-sessions$/, /upcoming sessions/i), parent: at(/\/my-sessions$/, /my sessions/i), athlete: at(/\/my-sessions$/, /my sessions/i) }) },
  { pattern: "/my-coaches", expect: protectedPage({ coach: at(/\/my-coaches$/, /my coaches/i), parent: at(/\/my-coaches$/, /my coaches/i), athlete: at(/\/my-coaches$/, /my coaches/i) }) },
  { pattern: "/chat", expect: protectedPage({ coach: at(/\/chat$/, /messages/i), parent: at(/\/chat$/, /messages/i), athlete: at(/\/chat$/, /messages/i) }) },
  { pattern: "/settings", expect: protectedPage({ coach: at(/\/settings$/, /account settings/i), parent: at(/\/settings$/, /parent or guardian/i), athlete: at(/\/settings$/, /account settings/i) }) },
  { pattern: "/settings/password", expect: protectedPage({ coach: at(/\/settings\?tab=security$/, /password/i), parent: at(/\/settings\?tab=security$/, /password/i) }) },
  { pattern: "/help", expect: protectedPage({ coach: at(/\/help$/, /common questions/i), parent: at(/\/help$/, /common questions/i), athlete: at(/\/help$/, /common questions/i) }) },
  { pattern: "/profile", seed: seedOwnCoachProfile, expect: protectedPage({ coach: at(/\/profile$/, /this is what families see/i), parent: at(/\/profile$/, /no athlete profile yet/i), athlete: at(/\/profile$/, /alex athlete/i) }) },
  { pattern: "/athlete-profile/create", expect: protectedPage({ parent: at(/\/athlete-profile\/create$/, /create your profile/i), athlete: at(/\/athlete-profile\/create$/, /create your profile/i) }) },
  { pattern: "/booking-confirmation", expect: protectedPage({ parent: at(/\/booking-confirmation$/, /receipt not found/i) }) },
  { pattern: "/package-confirmation", expect: protectedPage({ parent: at(/\/package-confirmation$/, /couldn.t confirm your package/i) }) },
  { pattern: "/invoices/:id", open: `/invoices/${IDS.invoice}`, expect: protectedPage({ parent: at(/\/invoices\//, /invoice not found/i), coach: at(/\/invoices\//, /invoice not found/i) }) },
  { pattern: "/org-invite/:token", open: "/org-invite/no-such-token", expect: protectedPage({ coach: at(/\/org-invite\/no-such-token$/, /invite not found/i) }) },
  { pattern: "/sessions/:id", coveredBy: "sessions.spec.ts" },

  // Signed in: coach pages, and where they send athletes and parents
  { pattern: "/book", expect: protectedPage({ coach: at(/\/schedule$/, /my schedule/i), parent: BOOK, athlete: BOOK }) },
  { pattern: "/schedule", expect: coachOnly(at(/\/schedule$/, /my schedule/i)) },
  { pattern: "/schedule/create", expect: coachOnly(at(/\/schedule\/create$/, /create session/i)) },
  { pattern: "/schedule/plan", expect: coachOnly(at(/\/schedule\/plan$/, /plan next week/i)) },
  { pattern: "/schedule/settings", expect: coachOnly(at(/\/schedule\/settings$/, /weekly hours/i)) },
  { pattern: "/availability", expect: coachOnly(at(/\/schedule\/settings$/, /weekly hours/i)) },
  { pattern: "/calendar", expect: coachOnly(at(/\/schedule$/, /my schedule/i)) },
  { pattern: "/setup", expect: coachOnly(at(/\/setup$/, /set up your coaching profile/i)) },
  { pattern: "/analytics", expect: coachOnly(at(/\/analytics$/, /revenue and sessions/i)) },
  { pattern: "/camps", expect: coachOnly(at(/\/camps$/, /camps/i)) },
  { pattern: "/organization", expect: coachOnly(at(/\/organization$/, /no organization yet/i)) },
  { pattern: "/payments", expect: coachOnly(at(/\/payments$/, /money in/i)) },
  { pattern: "/business", expect: coachOnly(at(/\/business$/, /my business/i)) },
  { pattern: "/account", expect: protectedPage({ coach: at(/\/business$/, /my business/i), parent: at(/\/account$/, /account/i), athlete: at(/\/account$/, /account/i) }) },
  { pattern: "/coach-session-feedback", expect: coachOnly(at(/\/my-sessions$/, /my sessions/i)) },
  { pattern: "/athletes", expect: protectedPage({ coach: at(/\/athletes$/, /my athletes/i), parent: BOOK, athlete: BOOK }) },
  { pattern: "/athletes/:id", coveredBy: "athletes.spec.ts" },
  { pattern: "/invites", expect: protectedPage({ coach: at(/\/athletes\?tab=invites$/, /my athletes/i), parent: BOOK }) },
  { pattern: "/my-clients", expect: { signedOut: SIGN_IN, coach: at(/\/athletes\?tab=invites$/, /my athletes/i), parent: BOOK } },

  { pattern: "*", open: "/no/such/page", expect: everyone(/\/no\/such\/page$/, /page not found/i) },
];

const WHO: Who[] = ["signedOut", "coach", "parent", "athlete", "incomplete"];

for (const who of WHO) {
  test.describe(`routes as ${who}`, () => {
    for (const route of ROUTE_CASES) {
      const expected = route.expect?.[who];
      if (!expected) continue;
      const open = route.open ?? route.pattern;
      test(`${open}`, async ({ page, as, backend }) => {
        route.seed?.(backend);
        if (who !== "signedOut") await as(page, who);
        await page.goto(open);
        await expect(page).toHaveURL(expected.url);
        await expect(page.getByText(expected.text).first()).toBeVisible();
        await settle(page);
        await expectNoSidewaysScroll(page, `${open} as ${who}`);
      });
    }
  });
}

test("every route in src/routes.tsx has a row here", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "checked once");
  const source = fs.readFileSync(path.resolve(testInfo.project.testDir, "../../src/routes.tsx"), "utf8");
  const block = source.slice(source.indexOf("export const ROUTES"), source.indexOf("} as const"));
  const patterns = [...block.matchAll(/^\s+[A-Z_]+:\s*"([^"]+)"/gm)].map((m) => m[1]).filter((p) => p !== "/__ds");
  expect(patterns.length).toBeGreaterThan(40);
  const known = new Set(ROUTE_CASES.map((r) => r.pattern));
  expect(patterns.filter((p) => !known.has(p)), "routes with no row in ROUTE_CASES").toEqual([]);

  // A route marked coveredBy must be opened in that spec.
  for (const route of ROUTE_CASES.filter((r) => r.coveredBy)) {
    const spec = path.resolve(testInfo.project.testDir, route.coveredBy!);
    expect(fs.existsSync(spec), `${route.pattern} is covered by ${route.coveredBy}, which doesn't exist`).toBe(true);
    const prefix = route.pattern.split("/:")[0];
    expect(fs.readFileSync(spec, "utf8"), `${route.coveredBy} should open ${route.pattern}`).toContain(prefix + "/");
  }
});
