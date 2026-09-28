import { cn } from "@/lib/utils";

interface GenderPillProps {
    gender: string;
    showLabel?: boolean;
    size?: "sm" | "md" | "lg";
    className?: string;
}

const SIZE_CLASSES: Record<"sm" | "md" | "lg", string> = {
    sm: "px-1.5 py-[2px] text-[11px] leading-[12px]",
    md: "px-2 py-[3px] text-[12px] leading-[13px]",
    lg: "px-2.5 py-1 text-[14px] leading-[16px]",
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
                <p className="mb-1 text-[12px] font-medium leading-[14px] tracking-[-0.03em] text-[#767980]">Gender</p>
            )}
            <span
                className={cn(
                    "inline-flex items-center whitespace-nowrap rounded-[4px] bg-[#F1F1E6] font-medium tracking-[-0.03em] text-[#484D56]",
                    sizeClass
                )}
            >
                {formatGender(gender)}
            </span>
        </div>
    );
}
