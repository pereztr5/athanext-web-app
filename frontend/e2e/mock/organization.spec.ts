import { test, expect } from "./test";
import { IDS } from "./personas";
import { isPhone } from "./helpers";
import { ORG, seedOrgInvite, seedOrganization } from "./data/organization";

// Organizations for Casey Coach, who owns E2E Rowing Club: the page editor (/organization) with
// coaches shown and academy packages, the org coaches and sessions tabs on My Business
// (/payments?tab=coaches), inviting a coach, the public page (/organizations/:slug), and
// accepting an invite to another organization (/org-invite/:token).

test.describe("organization page editor", () => {
  test.beforeEach(async ({ page, backend, as }) => {
    seedOrganization(backend);
    await as(page, "coach");
  });

  test("shows the basics, the coaches on the page and academy packages", async ({ page }) => {
    await page.goto("/organization");
    await expect(page.getByRole("heading", { name: "Organization page" })).toBeVisible();
    await expect(page.getByText(`${ORG.name} · what families see`)).toBeVisible();
    await expect(page.getByRole("link", { name: "View page" })).toHaveAttribute("href", `/organizations/${IDS.organizationSlug}`);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(ORG.name);
    await expect(page.getByLabel("One line under the name")).toHaveValue("Juniors rowing on the Hudson");
    await expect(page.getByText(`${"We coach juniors from first strokes to racing.".length} of 280`)).toBeVisible();
    await expect(page.getByText("2 shown")).toBeVisible();
    await expect(page.getByRole("switch", { name: "Show Jordan Lee on the page" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("Spring 10-pack")).toBeVisible();
    await expect(page.getByText(/10 sessions · \$65 each · valid 90 days · Casey, Jordan/)).toBeVisible();
    // Nothing changed yet: Save and Cancel are off.
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  });

  test("hides a coach, reorders and saves the page", async ({ page, backend }) => {
    await page.goto("/organization");
    await page.getByLabel("One line under the name").fill("Juniors and masters on the Hudson");
    await page.getByRole("switch", { name: "Show Jordan Lee on the page" }).click();
    await expect(page.getByText("1 shown")).toBeVisible();
    await page.getByRole("button", { name: "Move Jordan Lee up" }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Org page saved. Families see it now").first()).toBeVisible();
    expect(backend.writesTo("save_organization_page")[0].body).toEqual({
      p_name: ORG.name,
      p_line: "Juniors and masters on the Hudson",
      p_about: "We coach juniors from first strokes to racing.",
      p_logo_url: "",
      p_pricing: [],
      p_coaches: [
        { coach_id: ORG.jordan, shown: false },
        { coach_id: IDS.coach, shown: true },
      ],
    });
  });

  test("Cancel puts the saved page back", async ({ page, backend }) => {
    await page.goto("/organization");
    await page.getByLabel("Name", { exact: true }).fill("Someone else's club");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(ORG.name);
    expect(backend.writesTo("save_organization_page")).toHaveLength(0);
  });

  test("an empty name is not saved", async ({ page, backend }) => {
    await page.goto("/organization");
    await page.getByLabel("Name", { exact: true }).fill("   ");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Add a name for the organization").first()).toBeVisible();
    expect(backend.writesTo("save_organization_page")).toHaveLength(0);
  });

  test("creates an academy package for one coach", async ({ page, backend }) => {
    await page.goto("/organization");
    await page.getByRole("button", { name: "New package" }).click();
    const dialog = page.getByRole("dialog", { name: "New academy package" });
    const save = dialog.getByRole("button", { name: "Save package" });
    // No name yet.
    await expect(save).toBeDisabled();
    await dialog.getByLabel("Name", { exact: true }).fill("Jordan 5-pack");
    await dialog.getByLabel("Sessions", { exact: true }).fill("5");
    await dialog.getByLabel(/^Price/).fill("300");
    // Both coaches start picked; drop Casey.
    await dialog.getByRole("button", { name: /^Casey · \$80 single/ }).click();
    await expect(dialog.getByRole("button", { name: /^Jordan · \$70 single/ })).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByText("$60 a session.")).toBeVisible();
    await save.click();
    await expect(page.getByText(/^Jordan 5-pack saved/).first()).toBeVisible();
    expect(backend.writesTo("save_org_package")[0].body).toEqual({
      p_id: null,
      p_name: "Jordan 5-pack",
      p_kind: "individual",
      p_session_count: 5,
      p_price: 300,
      p_validity_days: 90,
      p_coach_ids: [ORG.jordan],
    });
    await expect(page.getByText("Jordan 5-pack", { exact: true })).toBeVisible();
  });

  test("a package that costs more than single sessions can't be saved", async ({ page }) => {
    await page.goto("/organization");
    await page.getByRole("button", { name: "New package" }).click();
    const dialog = page.getByRole("dialog", { name: "New academy package" });
    await dialog.getByLabel("Name", { exact: true }).fill("Pricey pack");
    await dialog.getByLabel("Sessions", { exact: true }).fill("2");
    await dialog.getByLabel(/^Price/).fill("500");
    await expect(dialog.getByText(/cost less as single sessions/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Save package" })).toBeDisabled();
  });

  test("removes a package and brings it back with Undo", async ({ page, backend }) => {
    backend.rpc.remove_org_package = null;
    backend.rpc.restore_org_package = null;
    await page.goto("/organization");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Edit academy package" });
    await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue("Spring 10-pack");
    await dialog.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("Spring 10-pack removed").first()).toBeVisible();
    expect(backend.writesTo("remove_org_package")[0].body).toEqual({ p_id: ORG.package });
    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => backend.writesTo("restore_org_package").length).toBe(1);
    expect(backend.writesTo("restore_org_package")[0].body).toEqual({ p_id: ORG.package });
  });
});

test.describe("org coaches and sessions", () => {
  test.beforeEach(async ({ page, backend, as }) => {
    seedOrganization(backend);
    await as(page, "coach");
  });

  test("shows this month's numbers per coach and the invite waiting", async ({ page }) => {
    await page.goto("/payments?tab=coaches");
    await expect(page.getByRole("tab", { name: "Org coaches" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText(`${ORG.name} · 2 coaches`)).toBeVisible();
    await expect(page.getByText("Sessions this month").locator("..")).toContainText("3");
    await expect(page.getByText("Brought in", { exact: true }).first().locator("..")).toContainText("$300");
    await expect(page.getByText("Org share", { exact: true }).locator("..")).toContainText("$28");
    await expect(page.getByText("From coaches · $112 paid to them")).toBeVisible();
    if (isPhone(page)) {
      await expect(page.getByRole("button", { name: /Jordan Lee/ })).toContainText("2 sessions · $140 · 20% to the org");
      await expect(page.getByRole("button", { name: /Casey Coach/ })).toContainText("all yours");
    } else {
      const jordan = page.getByRole("row", { name: /Jordan Lee/ });
      await expect(jordan).toContainText("$140");
      await expect(jordan).toContainText("20%");
      await expect(jordan).toContainText("25% waiting");
      await expect(page.getByRole("row", { name: /Casey Coach/ })).toContainText("All yours");
      await expect(page.getByRole("row", { name: /^Total/ })).toContainText("$188");
    }
    await expect(page.getByText("riley@e2e.test")).toBeVisible();
    await expect(page.getByText(/15% to the org · sent /)).toBeVisible();
  });

  test("invites a coach: validates the email and rate, then sends it", async ({ page, backend }) => {
    await page.goto("/payments?tab=coaches");
    await page.getByRole("button", { name: "Invite a coach" }).click();
    const dialog = page.getByRole("dialog", { name: "Invite a coach" });
    await dialog.getByLabel("Org share of each paid session (%)").fill("120");
    await dialog.getByRole("button", { name: "Send invite" }).click();
    await expect(dialog.getByText("Add an email address")).toBeVisible();
    await expect(dialog.getByText("Between 0 and 100")).toBeVisible();
    expect(backend.writesTo("organization-email")).toHaveLength(0);

    await dialog.getByLabel("Coach's email").fill("  Sky.Rivers@E2E.test ");
    await dialog.getByLabel("Org share of each paid session (%)").fill("30");
    await expect(dialog.getByText(`every paid session splits 30% to ${ORG.name}, 70% to the coach`)).toBeVisible();
    await dialog.getByRole("button", { name: "Send invite" }).click();
    await expect(page.getByText("Invite sent to Sky.Rivers@E2E.test").first()).toBeVisible();
    await expect(dialog).toBeHidden();
    expect(backend.writesTo("organization-email")[0].body).toEqual({ action: "invite", email: "sky.rivers@e2e.test", rate: 30 });
  });

  test("resends and cancels the waiting invite", async ({ page, backend }) => {
    await page.goto("/payments?tab=coaches");
    await page.getByRole("button", { name: "Resend" }).click();
    await expect(page.getByText("Invite resent to riley@e2e.test").first()).toBeVisible();
    expect(backend.writesTo("organization-email")[0].body).toEqual({ action: "resend", invite_id: ORG.invite });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByText("Invite to riley@e2e.test cancelled").first()).toBeVisible();
    expect(backend.writesTo("cancel_organization_invite")[0].body).toEqual({ p_invite_id: ORG.invite });
  });

  test("org sessions lists this week's sessions and filters by coach", async ({ page }) => {
    await page.goto("/payments");
    await page.getByRole("tab", { name: "Org sessions" }).click();
    await expect(page).toHaveURL(/\/payments\?tab=sessions$/);
    await expect(page.getByText("3 sessions", { exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: "Coach" }).selectOption({ label: "Jordan Lee" });
    await expect(page.getByText("2 sessions", { exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: "Coach" }).selectOption({ label: "All coaches" });
    await page.getByRole("combobox", { name: "Type" }).selectOption("group");
    await expect(page.getByText("1 session", { exact: true })).toBeVisible();
    await expect(page.getByText("Erg intervals").filter({ visible: true }).first()).toBeVisible();
    if (!isPhone(page)) await expect(page.getByRole("row", { name: /Erg intervals/ })).toContainText("4 of 6");
  });
});

test.describe("public organization page", () => {
  test("lists shown coaches, academy packages and group sessions for a visitor", async ({ page, backend }) => {
    seedOrganization(backend);
    await page.goto(`/organizations/${IDS.organizationSlug}`);
    await expect(page.getByRole("heading", { name: ORG.name, level: 1 })).toBeVisible();
    await expect(page.getByText("Juniors rowing on the Hudson")).toBeVisible();
    await expect(page.getByText("We coach juniors from first strokes to racing.")).toBeVisible();
    await expect(page.getByText("Jordan Lee").first()).toBeVisible();
    await expect(page.getByText(/Sculling coach · .*Video call/)).toBeVisible();
    await expect(page.getByRole("link", { name: "View" }).first()).toHaveAttribute("href", /\/coach\/casey-coach$/);
    await expect(page.getByText("Spring 10-pack")).toBeVisible();
    await expect(page.getByText("Saturday sculling")).toBeVisible();
    await expect(page.getByText("1 spot left")).toBeVisible();
  });

  test("a signed-in parent buys an academy package on Stripe", async ({ page, backend, as }) => {
    seedOrganization(backend);
    backend.seed("configurations", [
      { id: "fee1", key: "platform_fees", value: "10" },
      { id: "fee2", key: "stripe_fees", value: "2.9" },
      { id: "fee3", key: "stripe_fee_fixed", value: "0.30" },
    ]);
    await as(page, "parent");
    await page.goto(`/organizations/${IDS.organizationSlug}`);
    await page.getByRole("button", { name: /^Buy/ }).click();
    await page.waitForURL(/checkout\.stripe\.com\/c\/pay\/cs_test_e2e_academy/);
    expect(backend.writesTo("create-package-payment")[0].body).toEqual({ org_package_id: ORG.package });
  });

  test("the owner sees a preview and hidden coaches stay off the page", async ({ page, backend, as }) => {
    const state = seedOrganization(backend);
    state.coaches = state.coaches.map((c) => (c.coach_id === ORG.jordan ? { ...c, shown: false } : c));
    await as(page, "coach");
    await page.goto(`/organizations/${IDS.organizationSlug}`);
    await expect(page.getByText("This is what families see.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Organization page" }).first()).toHaveAttribute("href", "/organization");
    await expect(page.getByText("Casey Coach").first()).toBeVisible();
    await expect(page.getByText("Sculling coach")).toHaveCount(0);
    await page.getByRole("button", { name: /^Buy/ }).click();
    await expect(page.getByText("This is a preview. Families can buy it from the academy page").first()).toBeVisible();
    expect(backend.writesTo("create-package-payment")).toHaveLength(0);
  });
});

test.describe("org invite", () => {
  test.beforeEach(async ({ page, as }) => {
    await as(page, "coach");
  });

  test("accepts an invite to join and goes home", async ({ page, backend }) => {
    seedOrgInvite(backend);
    await page.goto(`/org-invite/${ORG.token}`);
    await expect(page.getByText("Join Hudson Rowing Academy", { exact: true })).toBeVisible();
    await expect(page.getByText("Morgan Hale invited you to join Hudson Rowing Academy. You keep your own profile, athletes and payouts.")).toBeVisible();
    await page.getByRole("button", { name: "Accept and join" }).click();
    await expect(page.getByText("You joined Hudson Rowing Academy").first()).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
    expect(backend.writesTo("respond_organization_invite")[0].body).toEqual({ p_token: ORG.token, p_accept: true });
  });

  test("accepts a new rate", async ({ page, backend }) => {
    seedOrgInvite(backend, { kind: "rate", rate: 25, current_rate: 20 });
    await page.goto(`/org-invite/${ORG.token}`);
    await expect(page.getByText("New rate from Hudson Rowing Academy")).toBeVisible();
    await expect(page.getByText(/share of each paid session from 20% to 25%/)).toBeVisible();
    await page.getByRole("button", { name: "Accept 25%" }).click();
    await expect(page.getByText("New rate accepted: 25%").first()).toBeVisible();
    expect(backend.writesTo("respond_organization_invite")[0].body).toEqual({ p_token: ORG.token, p_accept: true });
  });

  test("declines and the invite is no longer open", async ({ page, backend }) => {
    seedOrgInvite(backend);
    await page.goto(`/org-invite/${ORG.token}`);
    await page.getByRole("button", { name: "Decline" }).click();
    await expect(page.getByText("Declined", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("This invite is no longer open")).toBeVisible();
    await expect(page.getByText("It was declined. Ask Morgan Hale to send a new one if you need it.")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/org-invite/${ORG.token}$`));
    expect(backend.writesTo("respond_organization_invite")[0].body).toEqual({ p_token: ORG.token, p_accept: false });
  });

  test("a coach already in another organization can't join", async ({ page, backend }) => {
    seedOrgInvite(backend, { in_other_org: true });
    await page.goto(`/org-invite/${ORG.token}`);
    await expect(page.getByText("You are already in another organization. Leave it before joining this one.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept and join" })).toBeDisabled();
  });
});
