import { useMemo } from "react";
import { BrandPill } from "@/components/brand";
import { calculateProfileProgress, type ProfileData } from "@/utils/profileCompletion";
import { CoachProfileCard } from "./CoachProfileCard";
import { cn } from "@/lib/utils";

interface ProfileStrengthMeterProps {
  coach?: ProfileData | null;
  athlete?: ProfileData | null;
  /** Shows the "Edit profile" link. Omit it while the profile is already in edit mode. */
  onEdit?: () => void;
  /** "card" renders its own brand card; "inline" (default) sits inside another card. */
  variant?: "card" | "inline";
  className?: string;
}

export function ProfileStrengthMeter({
  coach,
  athlete,
  onEdit,
  variant = "inline",
  className,
}: ProfileStrengthMeterProps) {
  const profileSource = athlete ?? coach ?? null;
  const profileStrength = useMemo(
    () => calculateProfileProgress(profileSource || undefined),
    [profileSource]
  );

  // A complete profile needs no meter
  if (profileStrength.completion >= 100) {
    return null;
  }

  const { completion, completedFields, totalFields, missingFields } = profileStrength;
  const fieldsLeft = missingFields.length;

  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-card-title text-dark">Profile strength</h2>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 text-label-sm text-primary hover:text-primary-600"
          >
            Edit profile
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-[6px]">
        <span className="text-stat tabular-nums text-dark">{completion}%</span>
        <span className="text-caption text-dark-300">
          {completedFields} of {totalFields} fields complete
        </span>
      </div>

      <div
        className="h-[5px] w-full overflow-hidden rounded-card bg-light-550"
        role="progressbar"
        aria-label="Profile strength"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={completion}
      >
        <div
          className="h-full rounded-card bg-primary transition-[width] duration-300"
          style={{ width: `${Math.max(0, Math.min(100, completion))}%` }}
        />
      </div>

      {fieldsLeft > 0 ? (
        <div className="flex flex-col gap-[10px] rounded-control bg-light-400 p-3">
          <span className="text-label-xsm text-dark-300">
            {fieldsLeft} {fieldsLeft === 1 ? "field" : "fields"} left. Complete profiles get booked more
          </span>
          <div className="flex flex-wrap gap-[6px]">
            {missingFields.map((field) => (
              <BrandPill key={field} tone="neutral">
                {field}
              </BrandPill>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );

  if (variant === "card") {
    return <CoachProfileCard className={className}>{content}</CoachProfileCard>;
  }

  return <div className={cn("flex w-full flex-col gap-5 pb-5", className)}>{content}</div>;
}
