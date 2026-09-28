import { Medal } from "lucide-react";
import type { Enums } from "@/integrations/supabase/types";
import { CoachProfileCard, CoachProfileCardHeader } from "./CoachProfileCard";

interface SportPillarsProps {
  sport?: Enums<"sport_type"> | string | null;
  pillars?: any[];
  /** @deprecated no longer used by the brand-kit card */
  iconColor?: string;
  /** @deprecated no longer used by the brand-kit card */
  pillarBg?: string;
  isLoading?: boolean;
  loadError?: string | null;
}

const messageClass = "col-span-full text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]";

export function SportPillars({ sport, pillars = [], isLoading = false, loadError = null }: SportPillarsProps) {
  const renderContent = () => {
    if (isLoading) {
      return <p className={messageClass}>Loading sport pillars</p>;
    }

    if (loadError) {
      return <p className={`${messageClass} text-destructive`}>{loadError}</p>;
    }

    if (pillars?.length) {
      return pillars.map((pillar) => (
        <div
          key={pillar.id}
          className="flex items-start gap-[10px] rounded-[10px] border border-[#EAEADF] bg-[#F4F4EB] p-[15px]"
        >
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-[#CCDDF0] bg-[#E5EDF7] text-[#0054B4]">
            <Medal className="size-4" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[16px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">{pillar.name}</span>
            {pillar.description ? (
              <span className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">{pillar.description}</span>
            ) : null}
            {pillar.category ? (
              <span className="truncate text-[12px] font-medium leading-[13px] tracking-[-0.03em] text-[#A3A6AB]">
                {pillar.category}
              </span>
            ) : null}
          </div>
        </div>
      ));
    }

    return (
      <p className={messageClass}>{sport ? "No sport pillars yet." : "Sport information is unavailable."}</p>
    );
  };

  return (
    <CoachProfileCard>
      <CoachProfileCardHeader title="Development pillars" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">{renderContent()}</div>
    </CoachProfileCard>
  );
}
