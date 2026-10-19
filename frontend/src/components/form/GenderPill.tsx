import { cn } from "@/lib/utils";

interface GenderPillProps {
    gender: string;
    showLabel?: boolean;
    size?: "sm" | "md" | "lg";
    className?: string;
}

const SIZE_CLASSES: Record<"sm" | "md" | "lg", string> = {
    sm: "px-1.5 py-[2px] text-label-xsm",
    md: "px-[7px] py-[2px] text-label-xsm",
    lg: "px-2.5 py-1 text-label-sm",
};

/** "prefer-not-to-say" -> "Prefer not to say" */
const formatGender = (gender: string) => {
    const words = gender.replace(/[-_]+/g, " ").trim().toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
};

export function GenderPill({ 
    gender, 
    showLabel = true,
    size = "md",
    className = ""
}: GenderPillProps) {
    if (!gender) return null;

    const sizeClass = SIZE_CLASSES[size];

    return (
        <div className={className}>
            {showLabel && (
                <p className="mb-1 text-label-xsm text-dark-300">Gender</p>
            )}
            <span
                className={cn(
                    "inline-flex items-center whitespace-nowrap rounded-pill border border-light-600 bg-light-525 text-dark-400",
                    sizeClass
                )}
            >
                {formatGender(gender)}
            </span>
        </div>
    );
}
