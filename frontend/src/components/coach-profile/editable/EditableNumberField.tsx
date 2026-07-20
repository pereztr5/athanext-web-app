import React from "react";
import { Input } from "@/components/ui/input";

export interface EditableNumberFieldProps {
    icon?: React.ReactNode;
    isEditMode: boolean;
    value: number | undefined;
    onChange: (value: number) => void;
    placeholder?: string;
    inputClassName?: string;
    label?: string;
    prefix?: React.ReactNode;
    suffix?: React.ReactNode;
    renderDisplay: (value: number | undefined) => React.ReactNode;
}

/**
 * EditableNumberField - Handles number inputs with proper parsing
 * 
 * Usage:
 * <EditableNumberField
 *   isEditMode={isEditMode}
 *   value={coach.years_experience}
 *   onChange={(value) => handleChange("years_experience", value)}
 *   suffix={<span>years</span>}
 *   renderDisplay={(value) => <span>{value}+ years experience</span>}
 * />
 */
export const EditableNumberField: React.FC<EditableNumberFieldProps> = ({
    icon,
    isEditMode,
    value,
    onChange,
    placeholder,
    inputClassName = "",
    label,
    prefix,
    suffix,
    renderDisplay,
}) => {
    if (!isEditMode) {
        return <>{renderDisplay(value)}</>;
    }

    const inputElement = (
        <div className="flex items-center gap-1">
            {prefix}
            <Input
                type="number"
                value={value || ""}
                onChange={(e) => {
                    const numValue = parseInt(e.target.value) || 0;
                    // Only allow positive numbers
                    if (numValue >= 0) {
                        onChange(numValue);
                    }
                }}
                min="0"
                className={inputClassName}
                placeholder={placeholder}
            />
            {suffix}
        </div>
    );

    if (label) {
        return (
            <div className="flex items-center gap-2">
                <div className="flex items-center">
                    {icon}
                </div>
                <div className="">
                    <label className="text-sm font-medium">{label}</label>
                    {inputElement}
                </div>
            </div>
        );
    }

    return inputElement;
};
