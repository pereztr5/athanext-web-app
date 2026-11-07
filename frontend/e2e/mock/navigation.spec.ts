import type { Page } from "@playwright/test";
import { test, expect } from "./test";
import { IDS, users } from "./personas";
import { NAV, coachNotifications, seedNotifications, seedUnreadConversations } from "./data/navigation";
import { isPhone } from "./helpers";
import { MOCK_STORAGE_KEY } from "./backend";

// The app shell: the desktop sidebar, the phone tab bar, the top bar (main action, Messages,
// the notifications bell) and the account menu, for a coach and a parent.

type Link = { name: string; url: RegExp };

const COACH_SIDEBAR: Link[] = [
  { name: "My sessions", url: /\/my-sessions$/ },
  { name: "My athletes", url: /\/athletes$/ },
  { name: "My schedule", url: /\/schedule$/ },
  { name: "Camps", url: /\/camps$/ },
  { name: "My Business", url: /\/payments$/ },
  { name: "My profile", url: /\/profile$/ },
  { name: "Home", url: /\/dashboard$/ },
];
const COACH_TABS: Link[] = [
  { name: "Sessions", url: /\/my-sessions$/ },
  { name: "Athletes", url: /\/athletes$/ },
  { name: "Schedule", url: /\/schedule$/ },
  { name: "My Business", url: /\/business$/ },
  { name: "Home", url: /\/dashboard$/ },
];
const FAMILY_SIDEBAR: Link[] = [
  { name: "Book a session", url: /\/book$/ },
  { name: "My sessions", url: /\/my-sessions$/ },
  { name: "View All Coaches", url: /\/coaches$/ },
  { name: "Gear", url: /\/gear$/ },
  { name: "Home", url: /\/dashboard$/ },
];
const FAMILY_TABS: Link[] = [
  { name: "Book", url: /\/book$/ },
  { name: "Sessions", url: /\/my-sessions$/ },
  { name: "Coaches", url: /\/coaches$/ },
  { name: "Gear", url: /\/gear$/ },
  { name: "Home", url: /\/dashboard$/ },
];

/** The phone tab bar, or the desktop sidebar's list of links. */
const navArea = (page: Page) => (isPhone(page) ? page.getByRole("navigation", { name: "Main" }) : page.locator("[data-sidebar=sidebar]"));

const walk = async (page: Page, links: Link[]) => {
  for (const link of links) {
    const item = navArea(page).getByRole("link", { name: new RegExp(`^${link.name}`) });
    await item.click();
    await expect(page).toHaveURL(link.url);
    await expect(item).toHaveAttribute("aria-current", "page");
  }
};

/** The account menu in the top bar (the sidebar has a second one on desktop). */
const accountMenu = (page: Page) => page.getByRole("main").getByRole("button", { name: "Account menu" }).first();

test.describe("main navigation", () => {
  test("a coach's links go to each coach page and mark it current", async ({ page, as, backend }) => {
    backend.rpc.get_coach_earnings = { days: [], owed: 90, overdue_count: 1 };
    await as(page, "coach");
    await page.goto("/dashboard");
    if (isPhone(page)) {
      await expect(page.locator("[data-sidebar=sidebar]")).toBeHidden();
      // Five tabs; Camps is reached from Home and My Business.
      await expect(navArea(page).getByRole("link")).toHaveCount(5);
      await walk(page, COACH_TABS);
    } else {
      await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
      await expect(navArea(page).getByRole("link", { name: "My Business 1 overdue" })).toBeVisible();
      await walk(page, COACH_SIDEBAR);
    }
  });

  test("a parent's links go to booking, sessions, coaches and gear", async ({ page, as }) => {
    await as(page, "parent");
    await page.goto("/dashboard");
    if (isPhone(page)) {
      await expect(navArea(page).getByRole("link")).toHaveCount(5);
      await walk(page, FAMILY_TABS);
    } else {
      await expect(navArea(page).getByRole("link", { name: "My profile" })).toHaveCount(0);
      await expect(navArea(page).getByText(/pat/i).first()).toBeVisible();
      await walk(page, FAMILY_SIDEBAR);
    }
  });

  test("the Coaches tab stays current on a coach's page", async ({ page, as }) => {
    await as(page, "parent");
    await page.goto("/my-coaches");
    const coaches = navArea(page).getByRole("link", { name: isPhone(page) ? /^Coaches/ : /^View All Coaches/ });
    await expect(coaches).toHaveAttribute("aria-current", "page");
  });

  test("the logo goes home", async ({ page, as }) => {
    await as(page, "parent");
    await page.goto("/gear");
    await page.getByRole("link", { name: "AthaNext home" }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe("top bar", () => {
  test("the main action is Book for a parent and Create session for a coach", async ({ page, as }) => {
    test.skip(isPhone(page), "the top bar action is desktop only; phones use the tab bar");
    await as(page, "coach");
    await page.goto("/camps");
    await page.getByRole("main").getByRole("button", { name: "Create session" }).first().click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Create session" })).toBeVisible();
    await page.keyboard.press("Escape");
    // Home has its own Create session, so the top bar leaves it out.
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: "Create session" })).toHaveCount(1);
  });

  test("a parent's Book button opens Book a session", async ({ page, as }) => {
    test.skip(isPhone(page), "the top bar action is desktop only; phones use the tab bar");
    await as(page, "parent");
    await page.goto("/dashboard");
    await page.getByRole("main").getByRole("link", { name: "Book", exact: true }).click();
    await expect(page).toHaveURL(/\/book$/);
    // Book a session is the action itself, so the button goes away there.
    await expect(page.getByRole("main").getByRole("link", { name: "Book", exact: true })).toHaveCount(0);
  });

  test("Messages counts unread conversations and opens the inbox", async ({ page, as, backend }) => {
    seedUnreadConversations(backend, IDS.parentUser);
    await as(page, "parent");
    await page.goto("/dashboard");
    const messages = page.getByRole("link", { name: "Messages, 2 unread" });
    await expect(messages).toBeVisible();
    await expect(messages).toHaveAttribute("href", "/chat");
  });

  test("Messages with nothing unread opens the inbox", async ({ page, as }) => {
    await as(page, "coach");
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Messages", exact: true }).click();
    await expect(page).toHaveURL(/\/chat$/);
  });
});

test.describe("notifications", () => {
  test("the bell lists what's new, marks it all read and opens an item", async ({ page, as, backend }) => {
    seedNotifications(backend, coachNotifications());
    await as(page, "coach");
    await page.goto("/dashboard");
    const bell = page.getByRole("button", { name: "Notifications, new items" });
    await bell.click();
    const panel = page.getByRole("dialog");
    await expect(panel.getByText("Notifications", { exact: true })).toBeVisible();
    await expect(panel.getByRole("button", { name: /pat parent can we move thursday to 5pm\?/i })).toBeVisible();
    await expect(panel.getByRole("button", { name: /blake asked for thu, nov 5/i })).toBeVisible();
    await expect(panel.getByRole("button", { name: /new review 5 stars/i })).toBeVisible();

    await panel.getByRole("button", { name: "Mark all read" }).click();
    await expect(panel.getByRole("button", { name: "Mark all read" })).toBeHidden();
    expect(backend.writesTo("mark_notifications_seen")).toHaveLength(1);
    await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();

    await panel.getByRole("button", { name: /blake asked for/i }).click();
    await expect(panel).toBeHidden();
    await expect(page).toHaveURL(/\/schedule$|\/schedule\?requests=1$/);
  });

  test("a message notification opens that conversation", async ({ page, as, backend }) => {
    seedNotifications(backend, coachNotifications());
    await as(page, "coach");
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Notifications, new items" }).click();
    const toChat = page.waitForURL(new RegExp(`/chat\\?conversationId=${NAV.conversationA}$`));
    await page.getByRole("dialog").getByRole("button", { name: /pat parent/i }).click();
    await toChat;
  });

  test("with nothing new the bell says so", async ({ page, as, backend }) => {
    backend.rpc.get_my_notifications = [];
    await as(page, "parent");
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Notifications", exact: true }).click();
    await expect(page.getByRole("dialog").getByText("You're all caught up.")).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Mark all read" })).toHaveCount(0);
  });
});

test.describe("account menu", () => {
  test("a coach's menu shows who is signed in and opens settings and help", async ({ page, as }) => {
    await as(page, "coach");
    await page.goto("/dashboard");
    await accountMenu(page).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByText("Casey Coach")).toBeVisible();
    await expect(menu.getByText(users.coach.email)).toBeVisible();
    // Coaches get My profile here on phones only; the desktop sidebar has it.
    await expect(menu.getByRole("menuitem", { name: "My profile" })).toHaveCount(isPhone(page) ? 1 : 0);
    await expect(menu.getByRole("menuitem", { name: "Account", exact: true })).toHaveCount(0);
    await menu.getByRole("menuitem", { name: "Account settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);

    await accountMenu(page).click();
    await page.getByRole("menu").getByRole("menuitem", { name: "Help" }).click();
    await expect(page).toHaveURL(/\/help$/);
  });

  test("on a phone a coach reaches My profile from the menu", async ({ page, as }) => {
    test.skip(!isPhone(page), "the sidebar has My profile on desktop");
    await as(page, "coach");
    await page.goto("/dashboard");
    await accountMenu(page).click();
    await page.getByRole("menuitem", { name: "My profile" }).click();
    await expect(page).toHaveURL(/\/profile$/);
  });

  test("a parent's menu has Account", async ({ page, as }) => {
    await as(page, "parent");
    await page.goto("/dashboard");
    await accountMenu(page).click();
    await expect(page.getByRole("menu").getByText(users.parent.email)).toBeVisible();
    await page.getByRole("menuitem", { name: "Account", exact: true }).click();
    await expect(page).toHaveURL(/\/account$/);
  });

  test("Sign out ends the session and opens sign in", async ({ page, as, backend }) => {
    await as(page, "parent");
    await page.goto("/dashboard");
    await accountMenu(page).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/auth\?mode=signin$/);
    await expect(page.getByText(/welcome back/i).first()).toBeVisible();
    // Sign out is local (signOut({ scope: "local" })): the stored session is gone, nothing is sent.
    expect(await page.evaluate((key) => localStorage.getItem(key), MOCK_STORAGE_KEY)).toBeNull();
    expect(backend.writesTo("logout")).toHaveLength(0);
    // Signed out for real: a signed-in page now asks to sign in.
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/auth\?mode=signin$/);
  });
});
