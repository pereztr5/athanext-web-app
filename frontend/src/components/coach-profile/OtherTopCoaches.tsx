import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useCoaches } from "@/hooks/useCoaches";
import { publicCoachRatingLabel } from "@/utils/publicRating";
import { getInitials } from "@/lib/utils";
import { BrandStar } from "@/components/brand";
import { CoachProfileCard, CoachProfileCardHeader } from "./CoachProfileCard";

interface OtherTopCoachesProps {
  currentCoachId?: string;
}

export function OtherTopCoaches({ currentCoachId }: OtherTopCoachesProps) {
  const navigate = useNavigate();
  const { coaches, coachesLoading } = useCoaches();

  return (
    <CoachProfileCard>
      <CoachProfileCardHeader title="Other top coaches" />
      <div className="flex flex-col gap-1">
        {coachesLoading ? (
          [...Array(3)].map((_, index) => (
            <div key={index} className="flex items-center gap-3 p-2">
              <Skeleton className="size-10 shrink-0 rounded-[8px]" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4 rounded-[4px]" />
                <Skeleton className="h-3 w-1/2 rounded-[4px]" />
              </div>
            </div>
          ))
        ) : coaches && coaches.length > 0 ? (
          coaches
            .filter((c) => c.is_verified === true && c.id !== currentCoachId)
            .slice(0, 3)
            .map((coach) => (
              <button
                type="button"
                key={coach.id}
                className="flex w-full items-center gap-3 rounded-[8px] p-2 text-left transition-colors hover:bg-[#F4F4EB]"
                onClick={() => navigate(`/coach/${coach.id}`)}
              >
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-[#C1C1B8] text-[14px] font-medium text-[#484D56]">
                  {coach.profile_image_url ? (
                    <img src={coach.profile_image_url} alt={coach.name} className="size-full object-cover" />
                  ) : (
                    getInitials(coach.name || "")
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">
                    {coach.name}
                  </span>
                  <span className="block truncate text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
                    {coach.specialties?.[0] || "Coach"}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-[3px] text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
                  <BrandStar size={10} />
                  {publicCoachRatingLabel(coach.rating, coach.total_reviews)}
                </span>
              </button>
            ))
        ) : (
          <p className="py-4 text-center text-[14px] leading-[18px] tracking-[-0.03em] text-[#A3A6AB]">
            No other coaches yet
          </p>
        )}
      </div>

      <Button variant="outline" className="w-full" onClick={() => navigate("/coaches")}>
        View all coaches
      </Button>
    </CoachProfileCard>
  );
}
