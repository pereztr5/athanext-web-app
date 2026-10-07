import { useQuery } from "@tanstack/react-query";
import { organizationsAPI } from "@/api/organizations";
import { useRole } from "@/hooks/useRole";

/** The org this coach owns, or null. Drives the My Organization nav entry. */
export const useMyOrganization = () => {
  const { isCoach } = useRole();
  return useQuery({
    queryKey: ["my-organization"],
    queryFn: () => organizationsAPI.mine(),
    enabled: isCoach,
    staleTime: 60_000,
  });
};

/** Org pages families can open, with which coaches belong to each. */
export const usePublicOrganizations = () =>
  useQuery({
    queryKey: ["organizations-public"],
    queryFn: () => organizationsAPI.listPublic(),
    staleTime: 5 * 60_000,
  });
