import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PROFILE_TYPE } from "@/utils/db";

type PositionOption = {
  value: string;
  label: string;
};

type FavoritePositionsFieldProps = {
  persona: string;
  sport: string;
  availablePositions: PositionOption[];
  selectedPositions: string[];
  onToggle: (value: string) => void;
  error?: string;
};

const FavoritePositionsField = ({
  persona,
  sport,
  availablePositions,
  selectedPositions,
  onToggle,
  error,
}: FavoritePositionsFieldProps) => {
  if (persona !== PROFILE_TYPE.coach) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-[12px] font-medium leading-[14px] tracking-[-0.03em] text-[#767980]">
        Positions coached
      </Label>
      {sport ? (
        availablePositions.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {availablePositions.map((option) => {
              const checked = selectedPositions.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex min-h-[38px] cursor-pointer items-center gap-3 rounded-[8px] border px-3 py-2 transition-colors",
                    checked
                      ? "border-[#6698D2] bg-[#E5EDF7]"
                      : "border-[#EAEADF] bg-[#F1F1E6] hover:bg-[#F4F4EB]"
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#0054B4]"
                    checked={checked}
                    onChange={() => onToggle(option.value)}
                  />
                  <span className="text-[14px] tracking-[-0.03em] text-[#1A202C]">{option.label}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
            No positions available for this sport.
          </p>
        )
      ) : (
        <p className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
          Choose a sport first to pick the positions you coach.
        </p>
      )}
      {error && <p className="text-[12px] leading-[14px] tracking-[-0.03em] text-destructive">{error}</p>}
    </div>
  );
};

export default FavoritePositionsField;
