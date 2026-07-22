import { useAuth } from "@/contexts/AuthContext";
import { resolveRole, type Role } from "@/utils/role";

export function useRole() {
  const { user, userProfile, loading, initialCheckComplete, profileReady } = useAuth();
  const role: Role | null = resolveRole(user, userProfile);
  return {
    role,
    isCoach: role === "coach",
    isAthleteLike: role === "athlete" || role === "parent",
    isAuthenticated: Boolean(user),
    isProfileComplete: userProfile?.is_profile_completed === true,
    ready: initialCheckComplete && profileReady && !loading,
  };
}
