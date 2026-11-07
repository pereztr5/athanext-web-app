import { defineConfig, devices } from "@playwright/test";

// Live smoke tests against a real Supabase project: sign up, sign in, booking and
// creating a session. Every test runs at phone width and desktop width.
// The full suite runs against a mocked backend instead (playwright.config.ts).
//
// Local run (starts the dev server):   npm run e2e:live
// Against a Vercel preview:            E2E_BASE_URL=https://<preview>.vercel.app npm run e2e:live
//
// Signed-in tests need test accounts in .env.e2e.local (see e2e/README.md) and are
// skipped without them. The tests only read and open forms; they never save, book or pay.
const baseURL = process.env.E2E_BASE_URL || "http://localhost:5180";

export default defineConfig({
  testDir: "./e2e/live",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    // Same browser locale and clock zone as CI, so a run here catches what CI catches.
    locale: "en-US",
    timezoneId: "UTC",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // The cookie banner is answered up front, so it never covers a button a test clicks.
    storageState: {
      cookies: [],
      origins: [{ origin: new URL(baseURL).origin, localStorage: [{ name: "athanext-cookie-consent", value: "essential" }] }],
    },
  },
  projects: [
    {
      name: "phone",
      use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 375, height: 812 } },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npx vite --mode dev --port 5180 --strictPort",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
