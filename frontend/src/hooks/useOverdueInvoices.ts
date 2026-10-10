import { useQuery } from "@tanstack/react-query";
import { homeAPI } from "@/api/home";
import { useCoachPayMode } from "@/hooks/useCoachPayMode";
import { useRole } from "@/hooks/useRole";

/** Overdue invoices for the Business badge. Booking only coaches get no badge (Working Copy). */
export const useOverdueInvoices = () => {
  const { isCoach } = useRole();
  const payMode = useCoachPayMode();
  const query = useQuery({
    queryKey: ["coach-overdue-invoices"],
    queryFn: () => homeAPI.earnings(1).then((e) => e.overdueCount),
    enabled: isCoach && payMode.data === "app",
    staleTime: 60_000,
  });
  return payMode.data === "app" ? query.data ?? 0 : 0;
};
