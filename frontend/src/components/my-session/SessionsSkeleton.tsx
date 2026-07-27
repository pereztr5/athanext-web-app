import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for MySessions page
 * Displays placeholder session cards while data is being fetched
 */
export const SessionsSkeleton = () => (
  <div className="pt-6 pb-40 px-4 lg:px-6">
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-72" />
      </div>

      {/* Filter Card */}
      <div className="shadow-[0_14px_40px_rgba(15,23,42,0.08)] border border-slate-200 rounded-2xl overflow-hidden">
        <div className="pb-3 px-6 pt-4 flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="px-6 pb-6">
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <div className="flex flex-wrap gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 flex-1 min-w-[150px]" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* In-Progress Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-8" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 1 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      </div>

      {/* Upcoming Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-8" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      </div>

      {/* Past & Completed Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-8" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  </div>
);
