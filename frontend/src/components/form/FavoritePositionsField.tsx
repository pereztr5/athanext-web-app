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
      <Label className="text-label-xsm text-dark-300">
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
                    "flex min-h-[38px] cursor-pointer items-center gap-3 rounded-control border px-3 py-2 transition-colors",
                    checked
                      ? "border-primary bg-primary-50"
                      : "border-light-525 bg-light-300 hover:bg-light-200"
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={checked}
                    onChange={() => onToggle(option.value)}
                  />
                  <span className="text-body-m text-dark">{option.label}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="text-caption text-dark-300">
            No positions available for this sport.
          </p>
        )
      ) : (
        <p className="text-caption text-dark-300">
          Choose a sport first to pick the positions you coach.
        </p>
      )}
      {error && <p className="text-caption text-error-700">{error}</p>}
    </div>
  );
};

export default FavoritePositionsField;
