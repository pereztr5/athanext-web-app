# Smoke tests

Playwright checks that sign up, sign in, booking and creating a session still work, at
phone width (375px) and desktop width (1280px). Every page they open must also fit the
window with no sideways scroll.

The tests only open pages and forms. They never save, book or pay.

## Run

```bash
npm run e2e                                         # starts the dev server on :5180
E2E_BASE_URL=https://<preview>.vercel.app npm run e2e   # against a Vercel preview
npm run e2e:report                                  # open the last report
```

## Test accounts

The signed-in tests are skipped until these are set, either in `frontend/.env.e2e.local`
(git-ignored) or in the environment:

```
E2E_FAMILY_EMAIL=
E2E_FAMILY_PASSWORD=
E2E_COACH_EMAIL=
E2E_COACH_PASSWORD=
```

Use dedicated test accounts: one family with at least one coach, and one coach with a
schedule. In CI, add the same four names as repository secrets.
