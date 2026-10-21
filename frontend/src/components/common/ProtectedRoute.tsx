import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useRole } from "@/hooks/useRole";
import { useIsAdmin } from "@/hooks/useIsAdmin";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

export const ProtectedRoute = ({ children, requireAdmin }: ProtectedRouteProps) => {
  const { isAuthenticated, isProfileComplete, ready } = useRole();
  const { isAdmin, ready: adminReady } = useIsAdmin();
  const location = useLocation();

  if (!ready) {
    return <Spinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth?mode=signin" replace state={{ from: location }} />;
  }

  if (!isProfileComplete) {
    // Every unfinished account finishes in the sign-up flow (questions, then phone and terms).
    return <Navigate to="/auth?mode=signup" replace />;
  }

  if (requireAdmin) {
    if (!adminReady) return <Spinner />;
    if (!isAdmin) return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
