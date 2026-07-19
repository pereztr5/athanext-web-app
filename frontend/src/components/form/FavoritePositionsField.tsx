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
    <div className="space-y-2">
      <Label>Positions Coached</Label>
      {sport ? (
        availablePositions.length > 0 ? (
          <div className="flex flex-col gap-2">
            {availablePositions.map((option) => {
              const checked = selectedPositions.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-2 transition cursor-pointer",
                    checked ? "border-primary/60 bg-primary/5" : "border-border hover:border-primary/40"
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={checked}
                    onChange={() => onToggle(option.value)}
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No positions available for the selected sport.
          </p>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          Select a sport first to pick positions coached.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
};

export default FavoritePositionsField;
