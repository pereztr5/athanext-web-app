import { Medal } from "@/components/icons";
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

const messageClass = "col-span-full text-body-m text-dark-300";

export function SportPillars({ sport, pillars = [], isLoading = false, loadError = null }: SportPillarsProps) {
  const renderContent = () => {
    if (isLoading) {
      return <p className={messageClass}>Loading sport pillars</p>;
    }

    if (loadError) {
      return <p className="col-span-full text-body-m text-error-700">{loadError}</p>;
    }

    if (pillars?.length) {
      return pillars.map((pillar) => (
        <div
          key={pillar.id}
          className="flex items-start gap-[10px] rounded-card border border-light-525 bg-light-400 p-[15px]"
        >
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-card border border-primary-300 bg-primary-100 text-primary">
            <Medal className="size-4" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-subtitle text-dark">{pillar.name}</span>
            {pillar.description ? (
              <span className="text-caption text-dark-300">{pillar.description}</span>
            ) : null}
            {pillar.category ? (
              <span className="truncate text-label-xsm text-dark-300">
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
