import React, { useMemo } from "react";
import { calculateProfileProgress, type ProfileData } from "@/utils/profileCompletion";

interface ProfileStrengthMeterProps {
    coach?: ProfileData | null;
    athlete?: ProfileData | null;
}

export function ProfileStrengthMeter({ coach, athlete }: ProfileStrengthMeterProps) {
    const profileSource = athlete ?? coach ?? null;
    const profileStrength = useMemo(
        () => calculateProfileProgress(profileSource || undefined),
        [profileSource]
    );

    // If completion is 100%, don't render the meter
    if (profileStrength.completion === 100) {
        return null;
    }

    const getStrengthColor = (percentage: number): string => {
        if (percentage < 33) return "bg-red-500";
        if (percentage < 66) return "bg-yellow-500";
        return "bg-green-500";
    };

    const getStrengthLabel = (percentage: number): string => {
        if (percentage < 33) return "Weak";
        if (percentage < 66) return "Fair";
        return "Strong";
    };

    const getWidthClass = (percentage: number): string => {
        if (percentage <= 10) return "w-[10%]";
        if (percentage <= 20) return "w-[20%]";
        if (percentage <= 30) return "w-[30%]";
        if (percentage <= 40) return "w-[40%]";
        if (percentage <= 50) return "w-[50%]";
        if (percentage <= 60) return "w-[60%]";
        if (percentage <= 70) return "w-[70%]";
        if (percentage <= 80) return "w-[80%]";
        if (percentage <= 90) return "w-[90%]";
        return "w-full";
    };

    return (
        <div className="w-full py-4 space-y-2">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-semibold text-foreground">Profile Strength</p>
                    <p className="text-xs text-muted-foreground">
                        {profileStrength.completedFields} of {profileStrength.totalFields} fields completed
                    </p>
                </div>
                <span className="text-sm font-bold text-foreground">{profileStrength.completion}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-300 ${getStrengthColor(
                        profileStrength.completion
                    )} ${getWidthClass(profileStrength.completion)}`}
                />
            </div>

            {/* Strength Label */}
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getStrengthColor(profileStrength.completion)}`} />
                <p className="text-xs text-muted-foreground">
                    {getStrengthLabel(profileStrength.completion)} profile
                </p>
            </div>

            {profileStrength.consistencyIssues.length > 0 && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-700">
                    <p className="font-medium mb-1">Please review:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                        {profileStrength.consistencyIssues.map((issue) => (
                            <li key={issue}>{issue}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Missing Fields Warning */}
            {profileStrength.completion < 100 && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 space-y-2">
                    <div>
                        <p className="font-medium">Complete your profile to unlock more visibility</p>
                        <p className="text-blue-600">
                            Add the missing details to increase your credibility.
                        </p>
                    </div>

                    {profileStrength.missingFields.length > 0 && (
                        <div>
                            <p className="font-semibold text-[11px] text-blue-800">Pending fields</p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {profileStrength.missingFields.map((field) => (
                                    <span
                                        key={field}
                                        className="px-2.5 py-1 rounded-full bg-white text-blue-700 border border-blue-200 text-[11px]"
                                    >
                                        {field}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}
