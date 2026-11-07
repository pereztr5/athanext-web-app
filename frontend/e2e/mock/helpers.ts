import { expect, type Page } from "@playwright/test";

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

// Waits for the page to settle. Pages that stream many photos never go fully quiet,
// so this gives up after a few seconds instead of failing the test.
export const settle = async (page: Page) => {
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
};

/** True on phone-width projects. */
export const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;
