import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useRole } from "@/hooks/useRole";

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, ready } = useRole();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth?mode=signin" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};
