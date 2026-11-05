import { test as base, expect, type Page } from "@playwright/test";
import { MockBackend } from "./backend";
import { seedPersonas, users, type Persona } from "./personas";
import { seedDefaults } from "./defaults";

// `test` for the mocked suite. Every test gets a fresh in-memory backend with the personas
// seeded, and the page talks to nothing else. Use `as(page, "coach")` before the first goto
// to start signed in.
type Fixtures = {
  backend: MockBackend;
  as: (page: Page, persona: Persona) => Promise<void>;
  errors: string[];
};

export const test = base.extend<Fixtures>({
  backend: async ({ page, baseURL }, use) => {
    const backend = new MockBackend();
    seedPersonas(backend);
    seedDefaults(backend);
    await backend.install(page, new URL(baseURL!).origin);
    await use(backend);
  },
  as: async ({ backend }, use) => {
    await use(async (page, persona) => {
      await backend.signIn(page, users[persona]);
    });
  },
  // Uncaught errors and error-boundary screens fail the test after it finishes.
  // Depends on `backend` so every test is mocked, even one that never asks for it.
  errors: [
    async ({ page, backend }, use) => {
      void backend;
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(`${error.message}\n${(error.stack ?? "").split("\n").slice(1, 4).join("\n")}`));
      await use(errors);
      const crashed = await page
        .getByRole("heading", { name: "Something went wrong" })
        .isVisible()
        .catch(() => false);
      if (crashed) errors.push("The error boundary is showing 'Something went wrong'");
      expect(errors, "uncaught errors in the page").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
