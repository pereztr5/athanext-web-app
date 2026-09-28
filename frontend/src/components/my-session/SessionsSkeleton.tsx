import { Skeleton } from "@/components/ui/skeleton";

const block = "rounded-[4px] bg-[#EAEADF]";

const SessionCardSkeleton = () => (
  <div className="grid grid-cols-1 gap-5 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] pb-[25px] pt-[30px] md:grid-cols-[1fr_auto] md:gap-x-6">
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className={`h-[18px] w-48 ${block}`} />
        <Skeleton className={`h-[19px] w-16 ${block}`} />
      </div>
      <div className="flex flex-wrap gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className={`h-[13px] w-12 ${block}`} />
            <Skeleton className={`h-[18px] w-24 ${block}`} />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className={`h-[13px] w-16 ${block}`} />
        <div className="flex gap-1.5">
          <Skeleton className={`h-7 w-24 ${block}`} />
          <Skeleton className={`h-7 w-20 ${block}`} />
        </div>
      </div>
    </div>
    <div className="flex flex-row items-end justify-between gap-5 md:flex-col">
      <div className="flex flex-col items-start gap-1.5 md:items-end">
        <Skeleton className={`h-[30px] w-16 ${block}`} />
        <Skeleton className={`h-[14px] w-16 ${block}`} />
      </div>
      <Skeleton className="h-[30px] w-28 rounded-[8px] bg-[#EAEADF]" />
    </div>
  </div>
);

const SectionSkeleton = ({ cards }: { cards: number }) => (
  <div className="flex flex-col gap-[14px]">
    <div className="flex items-center gap-[10px]">
      <Skeleton className="size-8 rounded-[8px] bg-[#EAEADF]" />
      <Skeleton className={`h-6 w-48 ${block}`} />
      <Skeleton className={`h-[18px] w-6 ${block}`} />
    </div>
    {Array.from({ length: cards }).map((_, i) => (
      <SessionCardSkeleton key={i} />
    ))}
  </div>
);

/**
 * Loading skeleton for MySessions page
 * Displays placeholder session cards while data is being fetched
 */
export const SessionsSkeleton = () => (
  <div className="overflow-x-hidden px-4 pb-16 md:px-10" aria-busy="true" aria-label="Loading sessions">
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-[10px]">
        <Skeleton className={`h-7 w-48 ${block}`} />
        <Skeleton className={`h-[18px] w-72 ${block}`} />
      </div>

      {/* Filter card */}
      <div className="flex flex-col gap-5 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] pb-[25px] pt-[30px]">
        <div className="flex items-center gap-[5px]">
          <Skeleton className={`size-4 ${block}`} />
          <Skeleton className={`h-[18px] w-16 ${block}`} />
        </div>
        <Skeleton className="h-[38px] w-full rounded-[8px] bg-[#F1F1E6]" />
        <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-[5px]">
              <Skeleton className={`h-[14px] w-12 ${block}`} />
              <Skeleton className="h-[38px] w-full rounded-[8px] bg-[#F1F1E6]" />
            </div>
          ))}
        </div>
      </div>

      <SectionSkeleton cards={1} />
      <SectionSkeleton cards={2} />
      <SectionSkeleton cards={1} />
    </div>
  </div>
);
