import React from "react";

interface GenderPillProps {
    gender: string;
    showLabel?: boolean;
    size?: "sm" | "md" | "lg";
    className?: string;
}

const GENDER_COLORS: Record<string, string> = {
    male: "bg-blue-50 text-blue-500 border border-blue-300",
    female: "bg-pink-50 text-pink-500 border border-pink-300",
    other: "bg-gray-50 text-gray-500 border border-gray-300",
    "prefer-not-to-say": "bg-gray-50 text-gray-400 border border-gray-300",
};

const SIZE_CLASSES: Record<"sm" | "md" | "lg", string> = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-xs",
    lg: "px-4 py-2 text-sm",
};

export function GenderPill({ 
    gender, 
    showLabel = true,
    size = "md",
    className = ""
}: GenderPillProps) {
    if (!gender) return null;

    const colorClass = GENDER_COLORS[gender.toLowerCase()] || "bg-gray-400";
    const sizeClass = SIZE_CLASSES[size];

    return (
        <div className={className}>
            {showLabel && (
                <p className="text-xs font-medium text-muted-foreground mb-1">Gender</p>
            )}
            <div
                className={`inline-flex items-center ${sizeClass} rounded-full font-semibold capitalize ${colorClass}`}
            >
                {gender}
            </div>
        </div>
    );
}
