import { Navigate, useLocation } from "react-router-dom";
import { ROUTES } from "@/routes";

/** `/invites` and `/my-clients` open the Invites tab on My athletes. Keeps onboarding query. */
export const MyClientsRedirect = () => {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set("tab", "invites");
  const q = params.toString();
  return <Navigate to={`${ROUTES.ATHLETES}?${q}`} replace />;
};
