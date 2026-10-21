import { defineConfig, devices } from "@playwright/test";

// Smoke tests for the flows that must never break: sign up, sign in, booking and
// creating a session. Every test runs at phone width and desktop width.
//
// Local run (starts the dev server):   npm run e2e
// Against a Vercel preview:            E2E_BASE_URL=https://<preview>.vercel.app npm run e2e
//
// Signed-in tests need test accounts in .env.e2e.local (see e2e/README.md) and are
// skipped without them. The tests only read and open forms; they never save, book or pay.
const baseURL = process.env.E2E_BASE_URL || "http://localhost:5180";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
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
