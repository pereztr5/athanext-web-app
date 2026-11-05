import type { MockBackend } from "../backend";
import { IDS } from "../personas";

// Account settings fixtures: the parent's athlete (Ava) so the second-guardian card has an
// athlete to hang guardians on, and two guardians, one invited and one whose email failed.

export const SETTINGS = {
  parentAthlete: "0000fa00-0000-4000-8000-0000000000a2",
  invitedGuardian: "0000fa00-0000-4000-8000-0000000000d1",
  unsentGuardian: "0000fa00-0000-4000-8000-0000000000d2",
} as const;

/** Pat's athlete profile (parents use the athlete data path). */
export const seedParentAthlete = (backend: MockBackend) => {
  backend.seed("athlete_profiles", [
    {
      id: SETTINGS.parentAthlete,
      user_id: IDS.parentUser,
      full_name: "Ava Patel",
      date_of_birth: "2013-03-14",
      sport: "soccer",
      position: "Goalkeeper",
      phone_number: null,
      location: "New York",
      tags: [],
      pathway_tags: [],
      profile_image_url: null,
      cover_image_urls: [],
      bio: null,
      profile_completed: true,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      instagram_handle: null,
      graduation_year: 2031,
      current_year: null,
      high_school: null,
      gpa: null,
      height: null,
      weight: null,
      dominant_hand: null,
    },
  ]);
};

export const seedGuardians = (backend: MockBackend) => {
  backend.seed("athlete_guardians", [
    { id: SETTINGS.invitedGuardian, athlete_id: SETTINGS.parentAthlete, name: "Jamie Patel", email: "jamie@e2e.test", relationship: "Parent", emailed_at: "2026-10-01T12:00:00Z", invited_at: "2026-10-01T12:00:00Z" },
    { id: SETTINGS.unsentGuardian, athlete_id: SETTINGS.parentAthlete, name: "Robin Patel", email: "robin@e2e.test", relationship: "Guardian", emailed_at: null, invited_at: "2026-09-01T12:00:00Z" },
  ]);
};

/** guardian-invite: reports the email as sent and stamps emailed_at like the real function. */
export const handleGuardianInvite = (backend: MockBackend, emailed = true) => {
  backend.functions["guardian-invite"] = (body) => {
    const id = (body as { guardian_id?: string } | null)?.guardian_id;
    const row = backend.table("athlete_guardians").find((g) => g.id === id);
    if (emailed && row) row.emailed_at = new Date().toISOString();
    return { emailed };
  };
};

export const profileRow = (backend: MockBackend, id: string) => backend.table("user_profiles").find((row) => row.id === id)!;

/** resolve_coach_by_slug_or_id isn't in the shared defaults; useCoachDetails needs it to load the coach. */
export const handleResolveCoach = (backend: MockBackend) => {
  backend.rpc.resolve_coach_by_slug_or_id = (args, { backend: b }) =>
    (b.table("coaches").find((c) => c.id === args.p_key || c.slug === args.p_key)?.id as string | undefined) ?? null;
};
