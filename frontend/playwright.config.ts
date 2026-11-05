import { defineConfig, devices } from "@playwright/test";
import { MOCK_SUPABASE_URL } from "./e2e/mock/backend";

// The full end-to-end suite. The app runs against a mocked Supabase that lives inside the
// tests (e2e/mock), so every page can be opened signed out, as a coach, a parent and an
// athlete, with no accounts and no secrets. Every test runs at phone and desktop width.
//
//   npm run e2e           run it (starts its own dev server on :5199)
//   npm run e2e:report    open the last report
//   npm run e2e:live      the smoke tests against a real Supabase (playwright.live.config.ts)
const port = 5199;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e/mock",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    locale: "en-US",
    timezoneId: "UTC",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // The cookie banner is answered up front, so it never covers a button a test clicks.
    storageState: {
      cookies: [],
      origins: [{ origin: baseURL, localStorage: [{ name: "athanext-cookie-consent", value: "essential" }] }],
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
  webServer: {
    // Its own port and mode, so it never reuses a dev server that talks to a real project.
    command: `npx vite --mode e2e --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: MOCK_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: "e2e-anon-key",
      VITE_SUPABASE_PROJECT_ID: "e2emock",
      VITE_SHOPIFY_STORE_DOMAIN: "e2e-shop.myshopify.com",
      VITE_SHOPIFY_STOREFRONT_TOKEN: "e2e-storefront-token",
      VITE_POSTHOG_KEY: "",
      VITE_POSTHOG_HOST: "",
    },
  },
});
