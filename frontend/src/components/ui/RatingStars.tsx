import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export type RatingStarsProps = {
  value: number;
  onChange: (next: number) => void;
  onHover: (next: number) => void;
  onLeave: () => void;
  label: string;
  size?: "sm" | "md";
};

const RatingStars = ({
  value,
  onChange,
  onHover,
  onLeave,
  label,
  size = "md",
}: RatingStarsProps) => (
  <div className="flex items-center gap-2" aria-label={label}>
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        className="p-0.5"
        onClick={() => onChange(star)}
        onMouseEnter={() => onHover(star)}
        onMouseLeave={onLeave}
        aria-label={`${star} star${star > 1 ? "s" : ""}`}
      >
        <Star
          className={cn(
            size === "sm" ? "h-5 w-5" : "h-7 w-7",
            star <= value ? "fill-yellow-400 text-yellow-400" : "text-slate-300"
          )}
        />
      </button>
    ))}
  </div>
);

export default RatingStars;
