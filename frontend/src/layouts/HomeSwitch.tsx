import { Navigate } from "react-router-dom";
import { useRole } from "@/hooks/useRole";
import Index from "@/pages/Index";

// Signed-in users' home is the app, not the marketing site; until the
// dashboard page exists (PR 9) that means /my-sessions. While auth is
// still resolving, marketing home — today's behavior for visitors.
// Literal path instead of ROUTES.MY_SESSIONS: routes.tsx imports this
// file, so importing ROUTES back would create an import cycle.
export const HomeSwitch = () => {
  const { isAuthenticated, ready } = useRole();
  return ready && isAuthenticated ? <Navigate to="/my-sessions" replace /> : <Index />;
};
