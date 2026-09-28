import { Skeleton } from "@/components/ui/skeleton";

const cardClass =
  "flex w-full min-w-0 flex-col gap-5 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] pb-[25px] pt-[30px]";

const SectionSkeleton = ({ className = "" }: { className?: string }) => (
  <div className={`${cardClass} ${className}`}>
    <Skeleton className="h-6 w-40 rounded-[6px]" />
    <Skeleton className="h-[58px] w-full rounded-[8px]" />
    <Skeleton className="h-[58px] w-full rounded-[8px]" />
  </div>
);

/**
 * Loading skeleton for athlete profile pages
 * Displays placeholder content while profile data is being fetched
 */
export const ProfileSkeleton = () => (
  <div className="mb-20 mt-[3.8rem] px-4 pt-6 md:px-10" aria-busy="true" aria-label="Loading profile">
    <div className="mx-auto flex w-full max-w-8xl flex-col gap-6">
      <div className={cardClass}>
        <Skeleton className="h-[200px] w-full rounded-[8px] md:h-[250px] lg:h-[550px]" />
        <div className="flex flex-col items-start gap-5 md:flex-row md:items-center">
          <Skeleton className="size-24 flex-shrink-0 rounded-full" />
          <div className="flex w-full flex-1 flex-col gap-[10px]">
            <Skeleton className="h-8 w-56 rounded-[6px]" />
            <Skeleton className="h-4 w-40 rounded-[6px]" />
            <Skeleton className="h-4 w-72 max-w-full rounded-[6px]" />
          </div>
          <Skeleton className="h-[34px] w-32 rounded-[8px]" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <div key={key} className={`${cardClass} gap-4`}>
            <Skeleton className="size-8 rounded-[8px]" />
            <Skeleton className="h-[30px] w-16 rounded-[6px]" />
            <Skeleton className="h-4 w-32 rounded-[6px]" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionSkeleton className="lg:col-span-2" />
        <SectionSkeleton />
        <SectionSkeleton className="lg:col-span-2" />
        <SectionSkeleton />
      </div>
    </div>
  </div>
);
