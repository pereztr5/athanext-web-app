import { MapPin, Video } from "lucide-react";
import { CoachProfileCard, CoachProfileCardHeader, CoachProfileChip } from "./CoachProfileCard";

interface TrainingSpecializationProps {
  specializations?: string[];
  sessionTypes?: string[];
  locations?: string[];
  /** @deprecated no longer used by the brand-kit card */
  iconColor?: string;
}

/** "in-person" -> "In person" */
const formatSessionType = (value: string) => {
  const spaced = value.replace(/-/g, " ").trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const subheading = "text-[16px] font-normal leading-[18px] tracking-[-0.03em] text-[#1A202C]";

export function TrainingSpecialization({
  specializations = [],
  sessionTypes = [],
  locations = [],
}: TrainingSpecializationProps) {
  return (
    <CoachProfileCard>
      <CoachProfileCardHeader title="Training specialization and format" />

      <div className="flex flex-col gap-[10px]">
        <h3 className={subheading}>Specializations</h3>
        {specializations.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {specializations.map((spec, index) => (
              <CoachProfileChip key={`${spec}-${index}`} label={spec} />
            ))}
          </div>
        ) : (
          <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#A3A6AB]">None set</p>
        )}
      </div>

      {sessionTypes.length > 0 && (
        <div className="flex flex-col gap-[10px]">
          <h3 className={subheading}>Training format</h3>
          <ul className="flex flex-col gap-2">
            {sessionTypes.map((type, index) => {
              const isVirtual = type.toLowerCase().includes("virtual") || type.toLowerCase().includes("online");
              const Icon = isVirtual ? Video : MapPin;
              return (
                <li key={`${type}-${index}`} className="flex items-start gap-2 text-[14px] leading-[18px] tracking-[-0.03em]">
                  <Icon className="mt-px size-4 shrink-0 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
                  <span className="font-medium text-[#1A202C]">{formatSessionType(type)}</span>
                  {type.toLowerCase().includes("person") && locations.length > 0 && (
                    <span className="text-[#767980]">{locations[0]}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </CoachProfileCard>
  );
}
