import { test, expect } from "./test";
import { IDS } from "./personas";
import { photoFile, seedAthleteStats, seedOwnCoachProfile, withoutAthleteProfile } from "./data/profile";
import { expectNoSidewaysScroll } from "./helpers";
import type { MockBackend } from "./backend";

// My profile (/profile) for coaches and athletes, and Create your profile (/athlete-profile/create).

type Row = Record<string, unknown>;
const bodies = (backend: MockBackend, name: string, method?: string) => backend.writesTo(name, method).map((w) => w.body as Row);
const toast = (page: import("@playwright/test").Page, text: string) => page.getByText(text, { exact: true }).first();

test.describe("coach profile", () => {
  test.beforeEach(async ({ page, as, backend }) => {
    seedOwnCoachProfile(backend);
    await as(page, "coach");
  });

  test("shows what families see, with a link to the public page", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByText("This is what families see")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Casey Coach" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Preview as a family" })).toHaveAttribute("href", `/coach/${IDS.coachSlug}`);
    await expect(page.getByRole("region", { name: "About" }).getByText("Ten years coaching youth soccer.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Sessions and pricing" }).getByText("$80")).toBeVisible();
    await expectNoSidewaysScroll(page, "coach profile");
  });

  test("Edit profile saves the title, ZIP, Instagram, pillars, levels and bio", async ({ page, backend }) => {
    await page.goto("/profile");
    await page.getByRole("region", { name: "Coach" }).getByRole("button", { name: "Edit profile" }).click();
    await expect(page).toHaveURL(/\/profile\?mode=edit$/);
    const form = page.getByRole("region", { name: "Your profile" });
    await expect(form.getByRole("button", { name: "Technique" })).toHaveCount(0);

    await form.getByRole("combobox", { name: /^title/i }).selectOption("Field player coach");
    await form.getByRole("textbox", { name: /zip code/i }).fill("10002");
    await form.getByRole("textbox", { name: /instagram/i }).fill("https://instagram.com/casey.coach");
    await form.getByRole("textbox", { name: /instagram/i }).blur();
    await expect(form.getByRole("textbox", { name: /instagram/i })).toHaveValue("casey.coach");
    await form.getByRole("button", { name: "Video analysis" }).click();
    await expect(form.getByRole("button", { name: "Video analysis" })).toHaveAttribute("aria-pressed", "true");
    await form.getByRole("button", { name: "Elite pathway" }).click();
    const bio = "Former college midfielder. I coach players aged 8 to 18.";
    await form.getByRole("textbox", { name: /about you/i }).fill(bio);
    await expect(form.getByText(`${bio.length} of 1000 characters`)).toBeVisible();

    await page.getByRole("button", { name: "Done" }).click();
    await expect(toast(page, "Profile updated")).toBeVisible();
    await expect(page).toHaveURL(/\/profile$/);

    const coach = bodies(backend, "coaches", "PATCH");
    expect(coach).toHaveLength(1);
    expect(backend.writesTo("coaches", "PATCH")[0].url).toContain(`id=eq.${IDS.coach}`);
    expect(coach[0]).toMatchObject({
      title: "Field player coach",
      name: "Casey Coach",
      bio,
      specialties: ["Technique", "Video analysis"],
      pathway_tags: ["Youth Development", "Elite Pathway"],
      instagram_handle: "casey.coach",
      hourly_rate: 80,
    });
    // The ZIP lives on the account, and the coach's map point follows it.
    expect(bodies(backend, "user_profiles").at(-1)).toMatchObject({ id: IDS.coachUser, zip_code: "10002" });
    await expect.poll(() => bodies(backend, "set_my_coach_coordinates")).toEqual([expect.objectContaining({ p_zip: "10002" })]);
  });

  test("a bad Instagram handle stops Done, and the last pillar can't be turned off", async ({ page, backend }) => {
    const coach = backend.table("coaches").find((c) => c.id === IDS.coach)!;
    coach.specialties = ["Mentorship"];
    await page.goto("/profile?mode=edit");
    const form = page.getByRole("region", { name: "Your profile" });
    await form.getByRole("button", { name: "Mentorship" }).click();
    await expect(toast(page, "Keep at least one pillar")).toBeVisible();
    await expect(form.getByRole("button", { name: "Mentorship" })).toHaveAttribute("aria-pressed", "true");

    await form.getByRole("textbox", { name: /instagram/i }).fill("not a handle!!");
    await page.getByRole("button", { name: "Done" }).click();
    await expect(form.getByText("Use an Instagram handle or a profile link")).toBeVisible();
    expect(backend.writesTo("coaches")).toHaveLength(0);
    await expect(page).toHaveURL(/mode=edit/);
  });

  test("a new photo is cropped, uploaded and saved on the coach and the account", async ({ page, backend }) => {
    await page.goto("/profile?mode=edit");
    const form = page.getByRole("region", { name: "Your profile" });
    await form.locator('input[type="file"]').setInputFiles(photoFile());
    const crop = page.getByRole("dialog", { name: "Crop your photo" });
    await expect(crop).toBeVisible();
    await crop.getByRole("button", { name: "Save photo" }).click();
    await expect(crop).toBeHidden();
    await expect(form.getByText("Change photo")).toBeVisible();

    await page.getByRole("button", { name: "Done" }).click();
    await expect(toast(page, "Profile updated")).toBeVisible();
    const upload = backend.writes.find((w) => w.kind === "storage");
    expect(upload?.name).toMatch(new RegExp(`^object/athalink-images/coach-profiles/${IDS.coach}-\\d+\\.png$`));
    const imageUrl = bodies(backend, "coaches", "PATCH")[0].image_url as string;
    expect(imageUrl).toContain("/storage/v1/object/public/athalink-images/coach-profiles/");
    expect(bodies(backend, "user_profiles").at(-1)).toMatchObject({ image_url: imageUrl });
  });

  test("certifications are added in their own dialog", async ({ page, backend }) => {
    await page.goto("/profile?mode=edit");
    await page.getByRole("region", { name: "Certifications and credentials" }).getByRole("button", { name: "Add credential" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit certifications" });
    await expect(dialog.getByText("Add your first certification to show your credentials.")).toBeVisible();
    await dialog.getByRole("button", { name: "Add certification" }).click();
    await dialog.getByLabel("Certification name").fill("  USSF C License ");
    await dialog.getByLabel("Issuing organization").fill("U.S. Soccer");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(toast(page, "Certifications updated")).toBeVisible();
    await expect(dialog).toBeHidden();

    const saved = backend.writesTo("coach_certifications", "POST");
    expect(saved).toHaveLength(1);
    expect(saved[0].url).toContain("on_conflict=id");
    expect(saved[0].body).toEqual([expect.objectContaining({ coach_id: IDS.coach, certification_name: "USSF C License", issuing_organization: "U.S. Soccer" })]);
    await expect(page.getByRole("region", { name: "Certifications and credentials" }).getByText("USSF C License")).toBeVisible();
  });
});

test.describe("athlete profile", () => {
  test("shows the athlete's details and training stats", async ({ page, as, backend }) => {
    seedAthleteStats(backend);
    await as(page, "athlete");
    await page.goto("/profile");
    await expect(page.getByRole("heading", { level: 1, name: "Alex Athlete" })).toBeVisible();
    await expect(page.getByText("Forward")).toBeVisible();
    await expect(page.getByText("Class of 2028")).toBeVisible();
    const stats = page.getByRole("region", { name: "Training stats" });
    await expect(stats).toContainText("12");
    await expect(stats).toContainText("Sessions completed");
    await expect(stats).toContainText("14");
    await expect(stats).toContainText("Hours trained");
    await expect(stats).toContainText("Coaches worked with");
    // Asked for by the account's athlete id.
    expect(bodies(backend, "get_athlete_profile_stats")[0]).toEqual({ p_athlete_id: IDS.athlete });
    await expectNoSidewaysScroll(page, "athlete profile");
  });

  test("Edit profile saves the athlete row and the account", async ({ page, as, backend }) => {
    await as(page, "athlete");
    await page.goto("/profile");
    await page.getByRole("button", { name: "Edit profile" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Edit profile" });
    await dialog.getByLabel("Full name").fill("Alex Morgan");
    // Required here, though Create your profile calls it optional (see the fixme below).
    await dialog.getByRole("textbox", { name: "Phone number" }).fill("2125550100");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(toast(page, "Profile updated")).toBeVisible();
    await expect(dialog).toBeHidden();

    const saved = backend.writesTo("athlete_profiles", "POST");
    expect(saved).toHaveLength(1);
    expect(saved[0].url).toContain("on_conflict=user_id");
    expect(saved[0].body).toMatchObject({ user_id: IDS.athleteUser, full_name: "Alex Morgan", date_of_birth: "2010-05-01", position: "Forward", phone_number: "+12125550100" });
    expect(bodies(backend, "user_profiles").at(-1)).toMatchObject({ id: IDS.athleteUser, name: "Alex Morgan", persona_type: "athlete", athlete_id: IDS.athleteProfile });
    await expect(page.getByRole("heading", { level: 1, name: "Alex Morgan" })).toBeVisible();
  });

  test("Edit profile won't save without a name", async ({ page, as, backend }) => {
    await as(page, "athlete");
    await page.goto("/profile");
    await page.getByRole("button", { name: "Edit profile" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Edit profile" });
    await dialog.getByLabel("Full name").fill("");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog.getByLabel("Full name")).toHaveAttribute("aria-invalid", "true");
    await expect(dialog).toBeVisible();
    expect(backend.writesTo("athlete_profiles")).toHaveLength(0);
  });

  // Bug: Edit profile requires a phone number (src/utils/validations.ts profileSchema, phoneNumber
  // min(1)), but Create your profile labels it optional and saves without one. An athlete who
  // skipped it can't save any change until they add a phone, and the field isn't marked required.
  test.fixme("Edit profile saves without a phone number, as Create your profile allows", async ({ page, as, backend }) => {
    await as(page, "athlete");
    await page.goto("/profile");
    await page.getByRole("button", { name: "Edit profile" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Edit profile" });
    await dialog.getByLabel("Full name").fill("Alex Morgan");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(toast(page, "Profile updated")).toBeVisible();
    expect(backend.writesTo("athlete_profiles", "POST")).toHaveLength(1);
  });

  // Bug: Home's Edit profile saves the sport lowercase ("soccer", AthleteHome.tsx sport select),
  // but My profile's Edit profile only offers "Soccer" / "Rowing" (ATHLETE_SPORTS_OPTIONS in
  // src/utils/db.ts), so after an edit on Home the Sport box on My profile shows empty.
  test.fixme("My profile shows the sport saved from Home", async ({ page, as }) => {
    await as(page, "athlete");
    await page.goto("/profile");
    await page.getByRole("button", { name: "Edit profile" }).first().click();
    await expect(page.getByRole("dialog", { name: "Edit profile" }).getByRole("combobox", { name: "Sport" })).toHaveText("Soccer");
  });

  test("a parent with no athlete yet is sent to Create profile", async ({ page, as }) => {
    await as(page, "parent");
    await page.goto("/profile");
    await expect(page.getByText("No athlete profile yet")).toBeVisible();
    await page.getByRole("button", { name: "Create profile" }).click();
    await expect(page).toHaveURL(/\/athlete-profile\/create$/);
  });
});

test.describe("create your profile", () => {
  const pickSport = async (page: import("@playwright/test").Page, sport: string) => {
    await page.getByRole("combobox", { name: "Sport" }).click();
    await page.getByRole("option", { name: sport }).click();
  };

  test("asks for name, sport and birth date, then saves and opens the profile", async ({ page, as, backend }) => {
    withoutAthleteProfile(backend);
    await as(page, "athlete");
    await page.goto("/athlete-profile/create");
    await expect(page.getByRole("heading", { name: "Create your profile" })).toBeVisible();
    // The account's name and ZIP are filled in already.
    await expect(page.getByLabel("Full name")).toHaveValue("Alex Athlete");
    await expect(page.getByLabel(/location or zip/i)).toHaveValue("10001");

    await page.getByRole("button", { name: "Create profile" }).click();
    await expect(toast(page, "Missing details")).toBeVisible();
    expect(backend.writesTo("athlete_profiles")).toHaveLength(0);

    await page.getByLabel("Date of birth").fill("2011-03-14");
    await pickSport(page, "Soccer");
    await page.getByRole("combobox", { name: /primary position/i }).click();
    await page.getByRole("option", { name: "Midfielder" }).click();
    await page.getByLabel(/interests and focus areas/i).fill("passing, vision ,  ");
    await page.getByRole("button", { name: "Create profile" }).click();

    await expect(toast(page, "Profile created")).toBeVisible();
    await expect(page).toHaveURL(/\/profile$/);
    const saved = backend.writesTo("athlete_profiles", "POST");
    expect(saved).toHaveLength(1);
    expect(saved[0].url).toContain("on_conflict=user_id");
    expect(saved[0].body).toMatchObject({ user_id: IDS.athleteUser, full_name: "Alex Athlete", sport: "Soccer", position: "Midfielder", date_of_birth: "2011-03-14", tags: ["passing", "vision"] });
    const athleteId = (backend.table("athlete_profiles").find((r) => r.user_id === IDS.athleteUser) as Row).id;
    expect(bodies(backend, "user_profiles").at(-1)).toMatchObject({ id: IDS.athleteUser, persona_type: "athlete", athlete_id: athleteId, sport: "Soccer", position: "Midfielder", date_of_birth: "2011-03-14" });
    await expect(page.getByRole("heading", { level: 1, name: "Alex Athlete" })).toBeVisible();
  });

  test("a phone number must be valid for its country", async ({ page, as, backend }) => {
    withoutAthleteProfile(backend);
    await as(page, "athlete");
    await page.goto("/athlete-profile/create");
    await page.getByLabel("Date of birth").fill("2011-03-14");
    await pickSport(page, "Soccer");
    await page.getByRole("textbox", { name: /phone/i }).fill("12");
    await page.getByRole("button", { name: "Create profile" }).click();
    await expect(toast(page, "Check your phone number")).toBeVisible();
    expect(backend.writesTo("athlete_profiles")).toHaveLength(0);
  });

  test("Cancel goes back to My profile without saving", async ({ page, as, backend }) => {
    await as(page, "parent");
    await page.goto("/athlete-profile/create");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page).toHaveURL(/\/profile$/);
    expect(backend.writesTo("athlete_profiles")).toHaveLength(0);
  });

  test("a parent creates their athlete's profile", async ({ page, as, backend }) => {
    await as(page, "parent");
    await page.goto("/athlete-profile/create");
    await page.getByLabel("Full name").fill("Ava Parent");
    await page.getByLabel("Date of birth").fill("2013-09-02");
    await pickSport(page, "Soccer");
    await page.getByRole("button", { name: "Create profile" }).click();
    await expect(toast(page, "Profile created")).toBeVisible();
    await expect(page).toHaveURL(/\/profile$/);
    const saved = backend.writesTo("athlete_profiles", "POST");
    expect(saved[0].body).toMatchObject({ user_id: IDS.parentUser, full_name: "Ava Parent", sport: "Soccer", date_of_birth: "2013-09-02" });
  });

  // Bug: Create your profile always writes the account as the athlete (CreateAthleteProfile.tsx,
  // handleSubmit: updateProfile({ persona_type: "athlete", name: form.fullName, ... })). A parent
  // who creates their child's profile from Home becomes an athlete account named after the child,
  // and loses the parent views (guardian settings, "Parent of ..." in coach chats).
  // AthleteProfile.tsx handleProfileSave does the same when a parent edits from My profile.
  test.fixme("a parent stays a parent, with their own name, after creating their athlete", async ({ page, as, backend }) => {
    await as(page, "parent");
    await page.goto("/athlete-profile/create");
    await page.getByLabel("Full name").fill("Ava Parent");
    await page.getByLabel("Date of birth").fill("2013-09-02");
    await pickSport(page, "Soccer");
    await page.getByRole("button", { name: "Create profile" }).click();
    await expect(toast(page, "Profile created")).toBeVisible();
    const account = bodies(backend, "user_profiles").at(-1);
    expect(account?.persona_type).toBe("parent");
    expect(account?.name).toBe("Pat Parent");
  });
});
