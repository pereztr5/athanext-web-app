import { test, expect } from "./test";
import { IDS } from "./personas";
import { expectNoSidewaysScroll, settle } from "./helpers";
import { mockShopify, seedAthleteWithCoachBrand, seedCoachGearPicks } from "./data/gear";

// The Gear store (/gear and /gear/:handle) against a mocked Shopify Storefront API, the cart
// sheet, the athlete's "From my coaches" shelf, and the coach's gear picks editor.

const productCards = (page: import("@playwright/test").Page) => page.locator('a[href^="/gear/"]');

test.describe("gear catalog", () => {
  test("lists the store's products with prices and sold-out state", async ({ page }) => {
    await mockShopify(page);
    await page.goto("/gear");
    await expect(page.getByRole("heading", { name: "Gear", level: 1 })).toBeVisible();
    await expect(page.getByText("5 products")).toBeVisible();
    await expect(productCards(page)).toHaveCount(5);

    const ball = productCards(page).filter({ hasText: "Pro Match Ball" });
    await expect(ball).toContainText("Strikeforce");
    await expect(ball).toContainText("from $29.99");
    await expect(productCards(page).filter({ hasText: "Lightweight Shin Guards" })).toContainText("$19.50");
    await expect(productCards(page).filter({ hasText: "Carbon Sculling Oar" })).toContainText("Sold out");
    await settle(page);
    await expectNoSidewaysScroll(page, "/gear");
  });

  test("search, sport, category and price filters narrow the list and clear again", async ({ page }) => {
    await mockShopify(page);
    await page.goto("/gear");
    await expect(page.getByText("5 products")).toBeVisible();

    await page.getByPlaceholder("Search gear").fill("gloves");
    await expect(page.getByText("1 product", { exact: true })).toBeVisible();
    await expect(productCards(page)).toHaveText([/Rowing Grip Gloves/]);
    await page.getByPlaceholder("Search gear").fill("");

    await page.getByRole("group", { name: "Sport" }).getByRole("button", { name: "Rowing" }).click();
    await expect(page.getByText("2 products")).toBeVisible();
    await page.getByRole("group", { name: "Sport" }).getByRole("button", { name: "All", exact: true }).click();

    await page.getByRole("group", { name: "Category" }).getByRole("button", { name: "Balls" }).click();
    await expect(page.getByRole("group", { name: "Category" }).getByRole("button", { name: "Balls" })).toHaveAttribute("aria-pressed", "true");
    await expect(productCards(page)).toHaveText([/Pro Match Ball/]);
    await page.getByRole("group", { name: "Category" }).getByRole("button", { name: "All", exact: true }).click();

    await page.getByLabel("Price").selectOption({ label: "Under $25" });
    await expect(page.getByText("2 products")).toBeVisible();
    await expect(productCards(page).filter({ hasText: "Lightweight Shin Guards" })).toBeVisible();
    await expect(productCards(page).filter({ hasText: "Training Cones" })).toBeVisible();

    await page.getByPlaceholder("Search gear").fill("nothing like this");
    await expect(page.getByText("No gear matches your filters")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByText("5 products")).toBeVisible();
    await expect(page.getByLabel("Price")).toHaveValue("");
  });

  test("a product card opens its page", async ({ page }) => {
    await mockShopify(page);
    await page.goto("/gear");
    await productCards(page).filter({ hasText: "Lightweight Shin Guards" }).click();
    await expect(page).toHaveURL(/\/gear\/shin-guards$/);
    await expect(page.getByRole("heading", { name: "Lightweight Shin Guards" })).toBeVisible();
  });

  test("a store error shows Try again, which reloads", async ({ page }) => {
    const shop = await mockShopify(page, { fail: true });
    await page.goto("/gear");
    // react-query retries before giving up.
    await expect(page.getByText("We couldn't load the gear store")).toBeVisible({ timeout: 20_000 });
    const before = shop.calls.filter((c) => c.operation === "GearProducts").length;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect.poll(() => shop.calls.filter((c) => c.operation === "GearProducts").length).toBeGreaterThan(before);
  });

  test("an empty store says so", async ({ page }) => {
    await mockShopify(page, { products: [] });
    await page.goto("/gear");
    await expect(page.getByText("No gear yet")).toBeVisible();
  });
});

test.describe("gear product page", () => {
  test("/gear/pro-match-ball: options change the price, quantity and add to cart", async ({ page }) => {
    const shop = await mockShopify(page);
    await page.goto("/gear/pro-match-ball");
    await expect(page.getByRole("heading", { name: "Pro Match Ball" })).toBeVisible();
    await expect(page.getByText("Strikeforce", { exact: true })).toBeVisible();
    await expect(page.getByText("Balls", { exact: true })).toBeVisible();
    await expect(page.getByText("Thermally bonded panels.")).toBeVisible();
    expect(shop.calls.find((c) => c.operation === "GearProduct")?.variables).toMatchObject({ handle: "pro-match-ball", country: "US" });

    // The first variant (size 4) starts selected.
    const sizes = page.getByRole("radiogroup", { name: "Size" });
    await expect(sizes.getByRole("radio", { name: "4" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("$29.99")).toBeVisible();
    await sizes.getByRole("radio", { name: "5" }).click();
    await expect(sizes.getByRole("radio", { name: "5" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("$34.99")).toBeVisible();

    // Two images: thumbnails switch the main one.
    await page.getByRole("button", { name: "Show image 2" }).click();
    await expect(page.getByRole("button", { name: "Show image 2" })).toHaveAttribute("aria-pressed", "true");

    await expect(page.getByRole("button", { name: "Decrease quantity" })).toBeDisabled();
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await page.getByRole("button", { name: "Decrease quantity" }).click();

    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByText("Added to cart").first()).toBeVisible();
    await expect(page.getByText("2 × Pro Match Ball").first()).toBeVisible();
    const create = shop.calls.find((c) => c.operation === "GearCartCreate");
    expect(create?.variables.input).toMatchObject({
      lines: [{ merchandiseId: "gid://shopify/ProductVariant/pro-match-ball-2", quantity: 2 }],
      buyerIdentity: { countryCode: "US" },
    });
    await expect(page.getByRole("button", { name: "Cart, 2 items" })).toBeVisible();
    await settle(page);
    await expectNoSidewaysScroll(page, "/gear/pro-match-ball");
  });

  test("the cart sheet changes quantities, removes lines and hands off to Shopify checkout", async ({ page }) => {
    const shop = await mockShopify(page);
    await page.goto("/gear");
    await productCards(page).filter({ hasText: "Lightweight Shin Guards" }).click();
    // A single "Default Title" variant shows no option picker.
    await expect(page.getByRole("heading", { name: "Lightweight Shin Guards" })).toBeVisible();
    await expect(page.getByRole("radiogroup")).toHaveCount(0);
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByRole("button", { name: "Cart, 1 item" })).toBeVisible();

    // A second product goes into the same cart.
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/gear$/);
    await productCards(page).filter({ hasText: "Training Cones" }).click();
    await expect(page.getByRole("heading", { name: "Training Cones (Set of 20)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cart, 1 item" })).toBeVisible();
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByRole("button", { name: "Cart, 2 items" })).toBeVisible();
    const add = shop.calls.find((c) => c.operation === "GearCartLinesAdd");
    expect(add?.variables).toMatchObject({ cartId: "gid://shopify/Cart/e2e-cart", lines: [{ merchandiseId: "gid://shopify/ProductVariant/training-cones-1", quantity: 1 }] });

    await page.getByRole("button", { name: "Cart, 2 items" }).click();
    const sheet = page.getByRole("dialog", { name: "Your cart" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("Lightweight Shin Guards")).toBeVisible();
    await expect(sheet.getByText("$33.50")).toBeVisible();

    const guards = sheet.getByRole("listitem").filter({ hasText: "Lightweight Shin Guards" });
    await guards.getByRole("button", { name: "Increase quantity" }).click();
    await expect(guards.getByText("2", { exact: true })).toBeVisible();
    await expect(sheet.getByText("$53.00")).toBeVisible();
    expect(shop.calls.find((c) => c.operation === "GearCartLinesUpdate")?.variables).toMatchObject({ lines: [{ quantity: 2 }] });

    await sheet.getByRole("button", { name: "Remove Training Cones (Set of 20)" }).click();
    await expect(sheet.getByText("Training Cones (Set of 20)")).toHaveCount(0);
    await expect(sheet.getByText("$39.00").first()).toBeVisible();
    expect(shop.calls.some((c) => c.operation === "GearCartLinesRemove")).toBe(true);

    await sheet.getByRole("button", { name: "Buy on Shopify" }).click();
    await expect(page).toHaveURL("https://e2e-shop.myshopify.com/cart/c/e2e-checkout");
  });

  test("a signed-in athlete's cart is tagged with their athlete id", async ({ page, as }) => {
    await as(page, "athlete");
    const shop = await mockShopify(page);
    await page.goto("/gear/shin-guards");
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByRole("button", { name: "Cart, 1 item" })).toBeVisible();
    expect(shop.calls.find((c) => c.operation === "GearCartCreate")?.variables.input).toMatchObject({ attributes: [{ key: "athlete_id", value: IDS.athlete }] });

    await page.getByRole("button", { name: "Cart, 1 item" }).click();
    await page.getByRole("button", { name: "Buy on Shopify" }).click();
    await expect(page).toHaveURL(/e2e-checkout$/);
    expect(shop.calls.find((c) => c.operation === "GearCartAttributes")?.variables).toMatchObject({ attributes: [{ key: "athlete_id", value: IDS.athlete }] });
  });

  test("a sold-out product can't be added", async ({ page }) => {
    await mockShopify(page);
    await page.goto("/gear/carbon-oar");
    await expect(page.getByRole("heading", { name: "Carbon Sculling Oar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sold out" })).toBeDisabled();
  });

  test("an unknown handle shows Product not found with a way back", async ({ page }) => {
    await mockShopify(page);
    await page.goto("/gear/no-such-product");
    await expect(page.getByText("Product not found")).toBeVisible();
    await page.getByRole("link", { name: "Browse all gear" }).click();
    await expect(page).toHaveURL(/\/gear$/);
    await expect(page.getByText("5 products")).toBeVisible();
  });
});

test.describe("gear from the family's coaches", () => {
  test("an athlete sees their coach's shelf and can filter to their coaches' brands", async ({ page, as, backend }) => {
    await as(page, "athlete");
    seedAthleteWithCoachBrand(backend);
    await mockShopify(page);
    await page.goto("/gear");
    await expect(page.getByText("From Casey's store")).toBeVisible();
    await expect(page.getByText("Your coach · 2 products")).toBeVisible();

    await page.getByRole("button", { name: "From my coaches" }).click();
    await expect(page.getByRole("button", { name: "From my coaches" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("2 products", { exact: true })).toBeVisible();
    await expect(productCards(page)).toHaveText([/Pro Match Ball/, /Lightweight Shin Guards/]);
    // The shelf hides while the filter shows the same thing.
    await expect(page.getByText("From Casey's store")).toHaveCount(0);
  });
});

test.describe("coach gear picks", () => {
  test("a coach picks, orders and saves store products for their profile", async ({ page, as, backend }) => {
    await as(page, "coach");
    seedCoachGearPicks(backend, ["shin-guards"]);
    backend.rpc.resolve_coach_by_slug_or_id = IDS.coach;
    await mockShopify(page);
    await page.goto("/profile");
    await page.getByRole("button", { name: "Edit profile" }).click();
    await page.getByRole("button", { name: "Edit gear picks" }).click();

    const dialog = page.getByRole("dialog", { name: "Pick gear to recommend" });
    await expect(dialog.getByText("1 of 12")).toBeVisible();
    const store = dialog.getByRole("region", { name: "Store products" });
    await store.getByRole("button", { name: /Pro Match Ball/ }).click();
    await expect(dialog.getByText("2 of 12")).toBeVisible();
    await store.getByRole("button", { name: /Training Cones/ }).click();
    await dialog.getByRole("button", { name: "Move Training Cones (Set of 20) up" }).click();
    await dialog.getByRole("button", { name: "Remove Lightweight Shin Guards" }).click();
    await dialog.getByLabel("Search products").fill("glove");
    await expect(store.getByRole("button")).toHaveCount(1);

    await dialog.getByRole("button", { name: "Save picks" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Gear picks saved").first()).toBeVisible();
    expect(backend.writesTo("set_my_gear_picks").at(-1)?.body).toEqual({ p_handles: ["training-cones", "pro-match-ball"] });
    // The profile's gear box now shows the picks.
    await expect(page.getByText("2 of 12 picked.", { exact: false })).toBeVisible();
  });
});
