# AthaLink

Modern athlete-ops platform that connects athletes with elite coaches, simplifies scheduling, and centralizes post-session communication. (The UI still references the AthaNext codename while assets are being rebranded to AthaLink.)

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Quality Gates](#quality-gates)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Overview
AthaLink is a Vite + React application that gives athletes, coaches, and program partners a single workspace to:

- browse multi-sport coaching talent in a polished marketing site experience,
- onboard new coaches through guided flows and policy checkpoints,
- schedule sessions, track attendance, and deliver structured feedback,
- chat with athletes and parents, and
- collect insights that inform the broader AthaLink ecosystem of partnerships and sport expansions.

The codebase uses Supabase for data persistence, Shadcn UI + Tailwind for design consistency, and a modular string/configuration system so content updates never require code changes.

## Features
- **Coach discovery & marketing site** – Responsive landing, “Why AthaLink,” and partnership pages backed by centralized content (`src/config/strings.ts`, `src/utils/db.js`).
- **Coach onboarding** – Dedicated flows for Become-a-Coach, background checks, certifications, and success-state confirmations.
- **Session management** – Attendance tracking, rate calculations, athlete-specific notes, and structured feedback via `CoachSessionFeedback`.
- **Athlete communication** – In-app chat (`src/pages/ChatPage.tsx`) powered by typed API helpers (`src/api/endpoints/chat.ts`).
- **Supabase integration** – Single client (`src/integrations/supabase/client.ts`) powering profile data, contact forms, and session mutations.
- **Design system** – Shadcn UI primitives, Radix components, Tailwind utilities, and reusable sections/components for fast iteration.

## Tech Stack
- **Framework:** Vite 5, React 18, TypeScript
- **Styling:** Tailwind CSS, Shadcn UI, Radix UI primitives
- **State/Data:** React Query, React Hook Form, Zod
- **Backend & Auth:** Supabase (REST + RPC)
- **Tooling:** ESLint, TypeScript, PostCSS, Azure Pipelines + Vercel-ready build

## Project Structure
```
AthaLink/
├── public/                     # Static assets served by Vite
├── src/
│   ├── api/                    # Typed API clients (chat, contact, etc.)
│   ├── components/             # UI building blocks and composite modules
│   ├── hooks/                  # Data + UI hooks (session feedback, forms…)
│   ├── pages/                  # Route-level views (auth, chat, partnerships)
│   ├── config/                 # Branding, strings, color tokens, security
│   ├── integrations/           # Supabase client and shared adapters
│   ├── utils/                  # Formatting helpers, seeded content, FAQ data
│   └── assets/                 # Logos, icons, and imagery
├── supabase/                   # Local Supabase configuration
├── azure-pipelines.yml         # CI/CD definition for Azure DevOps
└── vite.config.ts              # Vite + React SWC configuration
```

## Getting Started
Prerequisites:
- Node.js 18+ (LTS recommended)
- npm 8+ (bundled with Node) or bun if you prefer

```bash
git clone <repo-url>
cd AthaLink
npm install
cp .env.dev .env.local       # or duplicate the env file that matches your target mode
npm run dev                  # start the local development server
```

The development server runs on `http://localhost:5173` by default. Use `npm run qa` or `npm run prod` to boot the app against alternate Vite modes that load environment-specific configs.

## Environment Variables
Create `.env`, `.env.local`, or `.env.<mode>` files with the following keys:

| Variable | Required | Description |
| --- | :---: | --- |
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL used by the browser client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ | Supabase anon/publishable key |
| `VITE_SUPABASE_PROJECT_ID` | ⚙️ | Used in CI scripts and analytics |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | ⚙️ | Server-only operations (never expose in client builds) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | ⚙️ | Enables Stripe checkout if payments are turned on |
| `VITE_STRIPE_SECRET_KEY` | ⚠️ | Keep server-side; referenced by automation scripts |
| `VITE_EMAIL_SERVICE_API_KEY` | ⚙️ | Transactional messaging integrations |
| `VITE_EMAIL_FROM_ADDRESS` | ⚙️ | Default sender identity |
| `VITE_APP_URL` | ⚙️ | Canonical site URL for emails and sharing |
| `VITE_API_BASE_URL` | ⚙️ | External API gateway if not using Supabase directly |
| `VITE_GOOGLE_ANALYTICS_ID` | ⚙️ | Optional GA measurement ID |
| `VITE_SENTRY_DSN` | ⚙️ | Optional Sentry endpoint for error reporting |

Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are needed to run the UI locally. Keep the sensitive keys (service role, Stripe secret) outside the browser environment—set them as CI/CD secrets or backend env vars.

## Available Scripts
```bash
npm run dev        # Vite dev server (default mode)
npm run qa         # Dev server with qa mode
npm run prod       # Dev server with prod mode settings
npm run build      # Production build (defaults to dev mode unless overridden)
npm run build:qa   # Build with qa mode
npm run build:prod # Build with prod mode
npm run preview    # Preview the dist build locally
```

## Quality Gates
```bash
npm run lint        # ESLint against the entire repo
npm run type-check  # TypeScript project-wide type checking
```

Run these before opening a PR to keep the pipeline green. Tailwind and PostCSS compile automatically during `build`.

## Deployment
- **Static hosting:** `npm run build:prod` generates a production-ready bundle under `dist/` for Vercel, Netlify, or any static host.
- **Azure Pipelines:** `azure-pipelines.yml` installs dependencies with caching, runs tests/linting, and injects the environment variables listed above before publishing artifacts.
- **Environment modes:** Use Vite’s built-in mode handling (`--mode qa` / `--mode prod`) to load the matching `.env.<mode>` file. This is how the hosted pipelines target different Supabase projects or Stripe accounts.

## Troubleshooting
- Delete `.vite` or `node_modules/.vite` if you encounter stale module errors after switching branches.
- If Supabase requests fail locally, ensure both `VITE_SUPABASE_*` values are set and restart `npm run dev` so Vite picks up the new env vars.
- For Shadcn UI styling issues, confirm `tailwind.config.ts` is loaded and that your IDE is not stripping class names.

---
Have questions or ideas? Open an issue or start a discussion and tag it with the relevant scope (UI/UX, Supabase, Partnerships, etc.).
