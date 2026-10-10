/** "Save $X a session when you book a package" on Book a Session (Working Copy). */
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, PiggyBank } from "lucide-react";
import { packagesAPI } from "@/api/packages";
import type { BookingCoach } from "@/api/book";
import { money } from "@/utils/booking";

export const PackageSavings = ({ coach, onOpen }: { coach: BookingCoach; onOpen: () => void }) => {
  const rate = coach.oneOnOneFrom ?? coach.hourlyRate;
  const packages = useQuery({
    queryKey: ["coach-packages-public", coach.id],
    enabled: !coach.credits && Boolean(rate),
    queryFn: () => packagesAPI.getCoachPackages(coach.id).then((r) => r.data ?? []),
    staleTime: 5 * 60_000,
  });
  // Coach packages are fixed session counts; only org packages renew monthly.
  const save = Math.max(
    0,
    ...(packages.data ?? [])
      .filter((p) => p.is_active && p.session_count > 0)
      .map((p) => Math.round((rate ?? 0) - p.total_price / 100 / p.session_count))
  );
  if (coach.credits || save < 1) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="-mt-2 flex w-full items-center gap-2.5 rounded-[10px] bg-[#CBE7D1] px-3.5 py-3 text-left text-[13px] font-medium leading-[16px] text-[#1E7431]"
    >
      <PiggyBank className="size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
      <span className="grow">Save {money(save)} a session when you book a package</span>
      <span className="inline-flex items-center gap-0.5 whitespace-nowrap font-semibold">
        See packages
        <ChevronRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
      </span>
    </button>
  );
};
