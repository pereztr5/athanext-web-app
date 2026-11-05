# End-to-end tests

Two Playwright suites. Both run every test at phone width (375px) and desktop width (1280px).

| Suite | Folder | Backend | Command |
|---|---|---|---|
| Full suite | `e2e/mock` | A mocked Supabase inside the tests | `npm run e2e` |
| Live smoke | `e2e/live` | A real Supabase project and test accounts | `npm run e2e:live` |

## Full suite (`e2e/mock`)

The app runs on its own dev server (port 5199, mode `e2e`) with `VITE_SUPABASE_URL` pointing at a
fake project. Every request to it is answered in the test by `MockBackend` (`mock/backend.ts`):

- **Auth:** password sign-in, refresh, signup, verify, recover, user update, logout.
- **Tables:** a small in-memory PostgREST. GETs filter rows, inserts add them, and updates and deletes change them.
- **RPCs and edge functions:** `backend.rpc[name]` and `backend.functions[name]`, given a value or a handler. Return `new MockError(...)` to answer with an error.
- **Storage:** uploads are accepted, and images come back as a 1x1 PNG.
- **Realtime:** joins are acknowledged; no events are pushed.
- **Other hosts:** answered with blanks. A navigation to Stripe or Google lands on a blank page, so tests check the URL.

Nothing leaves the machine. It needs no accounts and no secrets, so CI runs it on every pull request.

Every write the page makes is recorded in `backend.writes`, so a test can check what a save sent:

```ts
import { test, expect } from "./test";

test("saving the note sends it", async ({ page, backend, as }) => {
  await as(page, "coach");               // signed in before the first page loads
  backend.rpc.get_coach_athlete = athleteFixture();
  await page.goto("/athletes/…");
  // … fill and save …
  expect(backend.writesTo("set_coach_athlete_note")[0].body).toMatchObject({ p_note: "Works hard" });
});
```

- `mock/personas.ts`: the coach, parent, athlete and unfinished accounts, with fixed ids.
- `mock/data/*.ts`: fixture builders for each area. Their shapes follow the SQL in `backend/supabase/migrations` and the mappers in `src/api`.
- `mock/test.ts`: the `test` to import. Any uncaught page error, or the "Something went wrong" screen, fails the test.
- `mock/routes.spec.ts`: every route in `src/routes.tsx`, opened signed out and as each persona. Each case checks where it lands, that it renders and that it fits the window. Its last test fails when a route is added to `ROUTES` without a row there.

| Spec | Area |
|---|---|
| `auth` | sign in and out, sign up for each persona, unfinished accounts, forgot and reset password, invites, security settings |
| `booking`, `camp-signup` | coach directory and profile, pricing, /book with every payment path, confirmations, group offers, camp pages, My coaches, family My sessions |
| `schedule`, `sessions` | My schedule, create session, plan next week, schedule settings, coach setup, camps, session pages for coach and family, feedback |
| `athletes`, `business`, `organization` | roster, invites, athlete page, My Business, payments and invoices, payouts, coach plan, family invoices, analytics, organizations |
| `home`, `profile`, `settings`, `chat`, `navigation` | both homes, profiles and photo upload, every settings tab, messages, sidebar, tab bar, notifications, account menu |
| `gear`, `public-pages` | gear and cart, help, contact, partnerships, become a coach, cookie banner, offline banner |

A known app bug is kept as `test.fixme` with a comment saying what is wrong. Once the bug is
fixed, remove the `fixme` so the test starts guarding it.

```bash
npm run e2e                                   # whole suite, starts its own server
npx playwright test e2e/mock/booking.spec.ts  # one file
npx playwright test --project=desktop -g "invite"
npm run e2e:report                            # last HTML report
npm run type-check:e2e                        # type-check the tests
```

## Live smoke (`e2e/live`)

These tests run against a real Supabase project. They only open pages and forms, and never save,
book or pay. They are skipped unless these are set in `frontend/.env.e2e.local` (git-ignored) or
in the environment, along with the `VITE_SUPABASE_*` variables:

```
E2E_FAMILY_EMAIL=
E2E_FAMILY_PASSWORD=
E2E_COACH_EMAIL=
E2E_COACH_PASSWORD=
```

Use dedicated test accounts: one family with at least one coach, and one coach with a schedule.
In CI, add the same names as repository secrets. Run them against a Vercel preview with
`E2E_BASE_URL=https://<preview>.vercel.app npm run e2e:live`.
