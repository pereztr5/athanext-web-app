import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for athlete profile pages
 * Displays placeholder content while profile data is being fetched
 */
export const ProfileSkeleton = () => (
  <div className="pt-6 mb-20">
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <Skeleton className="h-[360px] w-full rounded-md" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-56 w-full rounded-md lg:col-span-2" />
        <Skeleton className="h-56 w-full rounded-md" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-72 w-full rounded-md lg:col-span-2" />
        <Skeleton className="h-72 w-full rounded-md" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-72 w-full rounded-md lg:col-span-2" />
        <Skeleton className="h-72 w-full rounded-md" />
      </div>
    </div>
  </div>
);
