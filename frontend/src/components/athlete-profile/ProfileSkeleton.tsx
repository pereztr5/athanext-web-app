import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for athlete profile pages
 * Displays placeholder content while profile data is being fetched
 */
export const ProfileSkeleton = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50/30 to-slate-100/20 dark:from-slate-900 dark:via-slate-950/30 dark:to-slate-950/20 mt-[3.8rem] mb-20">
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
