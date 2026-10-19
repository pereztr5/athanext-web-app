import { BrandStar } from "@/components/brand";

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
  <div className="flex items-center gap-1.5" role="group" aria-label={label}>
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        className="rounded-[4px] p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
        onClick={() => onChange(star)}
        onMouseEnter={() => onHover(star)}
        onMouseLeave={onLeave}
        aria-label={`${star} star${star > 1 ? "s" : ""}`}
      >
        <BrandStar filled={star <= value} size={size === "sm" ? 20 : 24} />
      </button>
    ))}
  </div>
);

export default RatingStars;
