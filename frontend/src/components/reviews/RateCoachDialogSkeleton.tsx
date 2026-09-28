import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type RateCoachDialogSkeletonProps = {
  className?: string;
};

/** Placeholder for the rating and comment fields while existing feedback loads. */
export const RateCoachDialogSkeleton = ({ className }: RateCoachDialogSkeletonProps) => (
  <div className={cn("flex flex-col gap-5", className)} aria-hidden="true">
    <div className="flex flex-col gap-[10px]">
      <Skeleton className="h-[18px] w-32 rounded-[4px] bg-[#EAEADF]" />
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-6 w-6 rounded-[4px] bg-[#EAEADF]" />
        ))}
      </div>
    </div>
    <div className="flex flex-col gap-[10px]">
      <Skeleton className="h-[18px] w-32 rounded-[4px] bg-[#EAEADF]" />
      <Skeleton className="h-[90px] w-full rounded-[8px] bg-[#F1F1E6]" />
    </div>
  </div>
);
