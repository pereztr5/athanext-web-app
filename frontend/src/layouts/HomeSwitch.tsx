import { Navigate } from "react-router-dom";
import { useRole } from "@/hooks/useRole";
import Auth from "@/pages/Auth";

// The app has no landing page: visitors see sign-in and sign-up at "/",
// signed-in users go to /dashboard.
// Literal path instead of ROUTES.DASHBOARD: routes.tsx imports this
// file, so importing ROUTES back would create an import cycle.
export const HomeSwitch = () => {
  const { isAuthenticated, ready } = useRole();
  return ready && isAuthenticated ? <Navigate to="/dashboard" replace /> : <Auth />;
};
