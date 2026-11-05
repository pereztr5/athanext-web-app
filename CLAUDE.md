# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

AthaLink (codename AthaNext, still used in the UI, domains and package names): a marketplace connecting athletes and families with coaches. It covers booking, scheduling, packages, camps, chat, payments and organizations. The repo has two parts: `frontend/` is a Vite + React SPA, and `backend/` is Supabase (Postgres migrations and Deno edge functions).

## Commands

Frontend commands run from `frontend/`:

```bash
npm run dev          # Vite dev server on http://localhost:8080 (mode "dev")
npm run lint         # ESLint (includes design-system rules, see below)
npm run type-check   # tsc against tsconfig.app.json
npm run test         # Vitest, run with TZ=UTC
npx vitest run src/utils/__tests__/fees.test.ts   # single test file (prefix TZ=UTC to match CI)
npx vitest run -t "name of test"                  # single test by name
npm run build        # production build (--mode prod)
npm run e2e          # Playwright smoke tests; starts its own dev server on :5180
E2E_BASE_URL=https://<preview>.vercel.app npm run e2e   # smoke tests against a deployed preview
```

CI (`.github/workflows/ci.yml`) runs lint, type-check, test and build, plus the Playwright smoke job when the Supabase secrets are set. Vitest only picks up `src/**/__tests__/**/*.test.ts` and runs in a `node` environment, so tests cover pure logic, not components.

Signed-in e2e tests need `E2E_FAMILY_EMAIL/PASSWORD` and `E2E_COACH_EMAIL/PASSWORD` in `frontend/.env.e2e.local`; without them those tests are skipped. The e2e tests only open pages and forms. They never save, book or pay, and every page they open must fit a 375px-wide window with no sideways scroll.

Edge function tests are Deno tests next to the code in `backend/supabase/functions/_shared/*_test.ts` and `<function>/*_test.ts`:

```bash
deno test backend/supabase/functions/_shared/fees_test.ts
```

### Deploy and database scripts (repo root `scripts/`)

- `scripts/deploy-app.sh preview|prod`: runs every check, then `vercel deploy`. `prod` deploys only from a clean `main` that matches `origin/main`. Set `SKIP_E2E=1` to skip the smoke tests.
- `scripts/deploy-functions.sh <folder>... | --all | --list`: deploys edge functions. Its table maps each folder to its deployed name and JWT setting, and it is the source of truth for both. Some names differ from their folders (for example `create-booking-payment` deploys as `create-booking-payment-v0`). Functions that receive Stripe, Shopify or Google callbacks use `jwt off` and check the caller themselves. When you add a function, add a row to this table.
- `scripts/apply-migration.sh <migration.sql>`: applies one migration to the live project in a single transaction, records it in `supabase_migrations.schema_migrations`, reloads the PostgREST schema cache (`notify pgrst, 'reload schema'`), and checks that the API sees the new functions and columns. `--check` runs only the API check. Migration files must be named `<14-digit version>_<name>.sql` and must not contain their own `begin`/`commit`. Skipping the schema reload has caused production bugs, where the API kept serving the old schema.

## Architecture

### Frontend (`frontend/src`)

- **Routing**: `routes.tsx` defines `ROUTES` and four route groups, which `App.tsx` mounts under different layouts:
  - `PUBLIC_ROUTES` and `AUTH_FLOW_ROUTES` use `MarketingLayout`.
  - `DUAL_CHROME_ROUTES` use `ChromeSwitch`, which shows marketing or app chrome depending on whether the user is signed in.
  - `APP_ROUTES` use `AppLayout`, and each element is wrapped in `ProtectedRoute`.
- **Auth and roles**: `ProtectedRoute` sends signed-out users to `/auth?mode=signin` and remembers the return path (it survives Google OAuth and sign-up via `utils/returnPath`). It sends users with unfinished profiles to `/auth?mode=signup`. Roles (`coach`, `athlete`, `parent`) come from `useRole()` → `utils/role.resolveRole`, which works from `AuthContext` (Supabase session plus the `user_profiles` row). `ProfileContext` holds athlete profile state.
- **Data access**: every Supabase call lives in `src/api/`, one flat file per domain, re-exported from `api/index.ts`. Components never import the Supabase client directly. Database logic is mostly Postgres RPCs (`supabase.rpc(...)`); payments, email and third-party integrations go through `supabase.functions.invoke("<deployed name>")`.
- **Data fetching**: React Query (`useQuery`/`useMutation`), with hooks in `src/hooks/`. New code should not use hand-rolled `useState` + `useEffect` + module caches. The global `staleTime` is 5 minutes and refetch on window focus is off.
- **Types**: shared types go in `src/types/`. Generated database types are in `src/integrations/supabase/types.ts`. Regenerate them from the live project after a migration; don't hand-edit them.
- **Env**: use `import.meta.env.*` only, because `process.env` is undefined at runtime in Vite. Modes `dev`/`qa`/`prod` load `.env.<mode>`. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are needed locally; copy them from `.env.example`.
- **Logging**: ESLint rejects `console.log`; `console.warn`/`console.error` are allowed. The production build also strips all `console.*` calls.
- **Analytics**: PostHog (`src/analytics/`). The cookie consent key is `athanext-cookie-consent` in localStorage.
- **Dev-only route**: `/__ds` is a design-system gallery.

### Design system (enforced by ESLint)

`eslint.config.js` blocks the following in product UI:
- raw hex colours in class strings (`-[#...]`)
- off-scale font sizes (`text-[Npx]`); use the `t-*` / `text-body-m` / `text-label-*` styles
- `shadow-sm/md/lg/...`; only floating layers get `shadow-overlay`
- pure white (`bg-white`, `text-white`); use `light-50` / `light-300` / `text-light`
- `disabled:opacity-*`
- importing from `lucide-react`; icons come from `@/components/icons` (Hugeicons)

Exempt: `components/ui/**` (shadcn primitives), `components/icons/**`, `components/sections/**`, `config/colors.ts`, and the marketing pages listed in the config.

### Backend (`backend/supabase`)

- `migrations/` holds the real schema history. `schema.sql` is an old snapshot that hasn't been updated since the repo split; don't treat it as current.
- `functions/<name>/index.ts` contains the Deno edge functions. Shared logic (fees, checkout, email templates and sending, camp signup and settlement, session times) lives in `functions/_shared/`.
- `templates/` holds Supabase auth email templates that `config.toml` refers to.
- `seeds/` holds demo data. `backend/scripts/backup.py` / `restore.py` run from the daily-backup workflow, which writes to Backblaze B2.
- The project ref is `znrdabzydvulagmlepxr` (hard-coded in the scripts).

### Code mirrored between frontend and backend

`frontend/src/utils/fees.ts` must be a **byte-identical copy** of `backend/supabase/functions/_shared/fees.ts`; `utils/__tests__/fees.test.ts` checks this. Edit the backend file, then copy it over. Other frontend tests (for example `accountEmails`) import from `_shared` directly, to check that frontend and backend logic match. Several frontend `api/` and `utils/` files refer to the migration or edge function whose shape they mirror; keep both sides in sync.

### Hosting

- The SPA deploys to Vercel at app.athanext.com; Vercel's root directory is `frontend/`.
- `frontend/vercel.json` redirects `/admin/*` to the separate admin app at admin.athanext.com, which is not in this repo.
- It also sends link-preview bots on `/<coach>/<camp>` URLs to the Vercel edge function `frontend/api/camp-preview.ts`, which fills in Open Graph tags for camps.
- `frontend/Dockerfile` + `nginx.conf` are an alternative image, built and pushed to GHCR by `docker.yml`. On merges to `main`, that workflow also bumps a semver tag based on Conventional Commit prefixes.

## Repo notes

- `docs/planning/` is local-only and gitignored.
- `.claude/settings.local.json` (gitignored) may hold `SUPABASE_DB_PASSWORD` for `apply-migration.sh`.
- `docs/CODE_REVIEW.md` lists known tech debt: oversized components (`ManageAvailabilityModal`, `Auth`, `MySessions`), overlapping profile API files, `as any` casts on RPC calls, and client-side-only rate limiting.
