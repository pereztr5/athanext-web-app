import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type RateCoachDialogSkeletonProps = {
  className?: string;
};

export const RateCoachDialogSkeleton = ({ className }: RateCoachDialogSkeletonProps) => (
  <div className={cn("space-y-6", className)}>
    <div className="space-y-2">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-full" />
    </div>
    <div className="flex items-center gap-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-8 w-8 rounded-full" />
      ))}
    </div>
    <div className="space-y-2">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
    <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
      <Skeleton className="h-10 w-24 rounded-full" />
      <Skeleton className="h-10 w-32 rounded-full" />
    </div>
  </div>
);
