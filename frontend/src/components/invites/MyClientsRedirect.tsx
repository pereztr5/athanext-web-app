import { Navigate, useLocation } from "react-router-dom";

/** /my-clients moved to /invites; keeps the query (Auth sends ?onboarding=1). */
export const MyClientsRedirect = () => {
  const { search } = useLocation();
  return <Navigate to={`/invites${search}`} replace />;
};
