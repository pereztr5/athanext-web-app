import type { Brand } from "@/utils/brands";

/** Staging demo coach (Riley Example). */
export const RILEY_COACH_ID = "a1111111-1111-4111-8111-111111111111";

/** Demo organization logos when the DB has none linked yet (local showcase). */
const RILEY_DEMO_ORGS: Pick<Brand, "id" | "name" | "logo_url">[] = [
  { id: "demo-org-set-gk", name: "SET GK", logo_url: "/org-logos/set-gk.svg" },
  { id: "demo-org-riverside", name: "Riverside FC", logo_url: "/org-logos/riverside-fc.svg" },
  { id: "demo-org-keeper-union", name: "Keeper Union", logo_url: "/org-logos/keeper-union.svg" },
];

/** Prefer DB brands; fall back to Riley demo logos so the Organizations card is visible. */
export function organizationsForProfile(
  coachId: string | undefined,
  brands: Pick<Brand, "id" | "name" | "logo_url">[]
): Pick<Brand, "id" | "name" | "logo_url">[] {
  if (brands.length) return brands;
  if (coachId === RILEY_COACH_ID) return RILEY_DEMO_ORGS;
  return [];
}
