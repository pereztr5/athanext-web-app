export type Role = "coach" | "athlete" | "parent";

type MetadataCarrier = { user_metadata?: Record<string, unknown> } | null | undefined;
type ProfileCarrier = { persona_type?: string | null } | null | undefined;

// Canonical role resolution: DB profile wins, auth metadata is the
// pre-profile-load fallback. All consumers must go through this (via useRole).
export function resolveRole(user: MetadataCarrier, userProfile: ProfileCarrier): Role | null {
  const raw = userProfile?.persona_type ?? user?.user_metadata?.persona_type ?? null;
  const normalized = typeof raw === "string" ? raw.trim().toLowerCase() : null;
  return normalized === "coach" || normalized === "athlete" || normalized === "parent"
    ? normalized
    : null;
}
