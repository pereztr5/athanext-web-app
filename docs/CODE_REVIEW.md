# AthaNext — Code Review Findings
**Prepared for Hazen Tech · April 18, 2026**

---

A full automated code review was conducted on the AthaNext/AthaLink repository — a React + TypeScript sports coaching marketplace built on Supabase. 21 issues were identified across security, type safety, architecture, dead code, and inconsistency. The most urgent items require immediate action before the next deployment.

---

## 🚨 Immediate Action Required — Security

### `CRITICAL` — .env and .env.qa are actively tracked by git
Both environment files containing Supabase credentials have been committed to the repository and are present in git history. The `.gitignore` only covers `.env.local`, `.env.*.local`, `.env.production`, and `.env.staging` — not the plain `.env` or `.env.qa` files. Because these files exist in commit history, removing them from tracking alone is insufficient. **All exposed Supabase keys must be rotated immediately**, both files must be added to `.gitignore`, and the files must be untracked from git without being deleted locally.

### `CRITICAL` — Client-side rate limiting provides no real protection
Rate limiting in `src/utils/securityAudit.ts` and `src/utils/contactValidation.ts` is implemented using `localStorage`. Any user can clear browser storage in devtools and bypass it instantly. This needs to be moved server-side, ideally into a Supabase Edge Function.

### `HIGH` — Security logging is silently broken
`src/utils/securityAudit.ts` references `process.env.NODE_ENV`, which is undefined at runtime in a Vite application. The correct syntax is `import.meta.env.MODE`. As a result, security audit logging is not firing in any environment.

### `HIGH` — CSP contains unsafe-inline and unsafe-eval in production config
The Content Security Policy in `src/config/security.ts` includes both `unsafe-inline` and `unsafe-eval` directives, with a comment noting they should be removed in production. They have not been removed. Both directives negate XSS protection entirely.

---

## Type Safety

### `HIGH` — Widespread "as any" casting on Supabase calls
Multiple hooks and API files cast the Supabase client as `any` in order to call RPC functions — including `useFAQItems.ts`, `faqs.ts`, `useAvailabilityOccurrences.ts`, `useCoachAvailability.ts`, and `ManageAvailabilityModal.tsx`. TypeScript provides no type safety on these database calls.

### `HIGH` — Untyped error and payload shapes in core contexts
`AuthContext.tsx` uses `Promise<{ error: any }>` and `ProfileContext.tsx` uses `any` for both the payload and return type of `saveAthleteProfile`. Callers have no way to know what error shapes to handle.

---

## Architecture

### `MEDIUM` — Several components are far too large to maintain or test
`ManageAvailabilityModal.tsx` is 2,080 lines handling form validation, date picking, slot management, overlap detection, and database mutations in a single file. `Auth.tsx` is 1,617 lines with 100+ local state variables, covering sign-in, sign-up, profile completion, persona selection, geolocation, and password validation. `MySessions.tsx` is 1,490 lines. All three should be decomposed into focused sub-components.

### `MEDIUM` — Duplicate and overlapping data-access code
There are two nearly identical FAQ hooks (`useFAQs.ts` and `useFAQItems.ts`) with different implementations and inconsistent error handling. There are also three overlapping user profile API files (`profiles.ts`, `userProfiles.ts`, `athleteProfiles.ts`) querying the same table with no clear boundary between them. `src/api/index.ts` also exports `UserProfile` twice from different import paths.

---

## Dead Code & Quick Wins

### `QUICK WIN` — Accidental files committed to the repository
`src/types/helpingCode.js` is a `.js` file in the types folder containing raw JSX/HTML markup — clearly a scratch file committed by mistake. `src/utils/addRowingCoaches.ts` is a one-off data seeding script with hardcoded coach entries that belongs in a Supabase migration or should be deleted. Both should be removed.

### `QUICK WIN` — 260+ console.log statements firing in production
Debug logging is present throughout the codebase with no environment gating, including markers like `console.log('=== getCoachesForSpecialty DEBUG ===')`. All fire in production. These should be stripped or replaced with a logger that gates output by environment.

### `LOW` — Inconsistent error handling and mixed env var patterns
Some hooks silently swallow errors (setting `error: null` in catch blocks) while others correctly surface them. Env var access is also inconsistent — some files use `import.meta.env` correctly, others use the broken `process.env` pattern. A consistent standard should be applied across all ~40 hooks.

---

## Recommended Priority Order

| # | Action | Impact |
|---|--------|--------|
| 1 | Rotate exposed Supabase keys and fix `.gitignore` immediately | Critical |
| 2 | Fix broken security logging (`process.env` → `import.meta.env.MODE`) | High |
| 3 | Remove CSP `unsafe-inline` and `unsafe-eval` directives | High |
| 4 | Delete accidental committed files (`helpingCode.js`, `addRowingCoaches.ts`) | Quick win |
| 5 | Strip 260+ debug `console.log` calls | Quick win |
| 6 | Address `as any` type safety issues in Supabase calls | Medium |
| 7 | Consolidate duplicate FAQ hooks and overlapping profile API files | Medium |
| 8 | Decompose `ManageAvailabilityModal`, `Auth`, and `MySessions` components | Large effort |
| 9 | Move rate limiting server-side via Edge Functions | Security |
