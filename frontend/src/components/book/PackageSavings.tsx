/** "Save $X a session when you book a package" on Book a Session (Working Copy). */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Ticket } from "lucide-react";
import { packagesAPI } from "@/api/packages";
import type { BookingCoach } from "@/api/book";
import { money } from "@/utils/booking";
import { coachPricingPath } from "@/utils/coachSlug";

export const PackageSavings = ({ coach }: { coach: BookingCoach }) => {
  const packages = useQuery({
    queryKey: ["coach-packages-public", coach.id],
    enabled: !coach.credits && Boolean(coach.hourlyRate),
    queryFn: () => packagesAPI.getCoachPackages(coach.id).then((r) => r.data ?? []),
    staleTime: 5 * 60_000,
  });
  const save = Math.max(
    0,
    ...(packages.data ?? []).map((p) => (coach.hourlyRate ?? 0) - p.total_price / 100 / Math.max(1, p.session_count))
  );
  if (coach.credits || save < 1) return null;
  return (
    <div className="flex items-center gap-2 rounded-[8px] bg-[#CBE7D1]/60 px-3 py-2.5 text-[14px] text-[#1E5A2C]">
      <Ticket className="size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
      <span className="grow">Save {money(Math.floor(save))} a session when you book a package</span>
      <Link to={coachPricingPath(coach.slug || coach.id)} className="inline-flex items-center gap-1 font-medium hover:underline">
        See packages
        <ChevronRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
      </Link>
    </div>
  );
};
