import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useRole } from "@/hooks/useRole";

interface ProtectedRouteProps {
  children: ReactNode;
}

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, isProfileComplete, ready } = useRole();
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

  return <>{children}</>;
};
