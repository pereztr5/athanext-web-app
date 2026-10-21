import fs from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

// Test accounts come from the environment or from .env.e2e.local (never committed).
const localEnv = path.resolve(process.cwd(), ".env.e2e.local");
if (fs.existsSync(localEnv)) {
  for (const line of fs.readFileSync(localEnv, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

export type Account = { email: string; password: string };

export const account = (role: "FAMILY" | "COACH"): Account | null => {
  const email = process.env[`E2E_${role}_EMAIL`];
  const password = process.env[`E2E_${role}_PASSWORD`];
  return email && password ? { email, password } : null;
};

// Collects uncaught page errors so a test can fail on a crash the user would not see.
export const watchErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
};

// Fails when the page scrolls sideways, and names the widest elements that cause it.
export const expectNoSidewaysScroll = async (page: Page, label: string) => {
  const result = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const scroll = document.documentElement.scrollWidth;
    const offenders: string[] = [];
    if (scroll > viewport + 1) {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
        const rect = el.getBoundingClientRect();
        if (rect.right > viewport + 1 && rect.width > 0) {
          const name = el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : "");
          offenders.push(`${name} (right edge ${Math.round(rect.right)}px)`);
          if (offenders.length >= 5) break;
        }
      }
    }
    return { viewport, scroll, offenders };
  });
  expect(result.scroll, `${label}: page is ${result.scroll}px wide in a ${result.viewport}px window. Widest: ${result.offenders.join(", ")}`).toBeLessThanOrEqual(result.viewport + 1);
};

export const signIn = async (page: Page, who: Account) => {
  await page.goto("/auth?mode=signin");
  await page.locator("#signin-email").fill(who.email);
  await page.locator("#signin-password").fill(who.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  // The sign-in freeze shows up as never leaving /auth.
  await expect(page, "sign-in should leave the auth page").not.toHaveURL(/\/auth/, { timeout: 20_000 });
};

// Opens a signed-in page and checks it renders, responds and fits the window.
export const visit = async (page: Page, route: string) => {
  await page.goto(route);
  await expect(page.locator("main").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(page, `${route} should not bounce back to sign-in`).not.toHaveURL(/\/auth/);
  await expectNoSidewaysScroll(page, route);
};
