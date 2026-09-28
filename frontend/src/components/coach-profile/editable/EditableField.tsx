import React from "react";
import { Input } from "@/components/ui/input";

export interface EditableFieldProps {
    isEditMode: boolean;
    value: string;
    onChange?: (value: string) => void;
    onBlur?: () => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    placeholder?: string;
    inputClassName?: string;
    type?: string;
    /** Render function for display mode - provides flexibility for custom display */
    renderDisplay?: (value: string) => React.ReactNode;
    /** Optional prefix element shown before the input in edit mode */
    inputPrefix?: React.ReactNode;
    /** Optional suffix element shown after the input in edit mode */
    inputSuffix?: React.ReactNode;
    /** Label shown above the input in edit mode */
    label?: string;
    /** Marks the field as required in edit mode */
    required?: boolean;
}

/**
 * EditableField - Displays a value as text or input based on edit mode
 * 
 * Usage:
 * <EditableField
 *   isEditMode={isEditMode}
 *   value={coach.name}
 *   onChange={(value) => handleChange("name", value)}
 *   renderDisplay={(value) => <h1>{value}</h1>}
 * />
 */
export const EditableField: React.FC<EditableFieldProps> = ({
    isEditMode,
    value,
    onChange,
    onBlur,
    onKeyDown,
    placeholder,
    inputClassName = "",
    type = "text",
    renderDisplay,
    inputPrefix,
    inputSuffix,
    label,
    required = false,
}) => {
    const inputId = React.useId();
    if (isEditMode) {
        const inputElement = (
            <div className="flex items-center gap-1">
                {inputPrefix}
                <Input
                    id={inputId}
                    type={type}
                    value={value}
                    onBlur={onBlur}
                    onKeyDown={onKeyDown}
                    placeholder={placeholder}
                    className={inputClassName}
                    min={3}
                    max={10}
                    required={required}
                    aria-required={required}
                    onChange={(e) => onChange?.(e.target.value)}
                />
                {inputSuffix}
            </div>
        );

        if (label) {
            return (
                <div className="flex flex-col gap-1.5">
                    <label htmlFor={inputId} className="text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">
                        {label}
                        {required && <span className="ml-1 text-destructive">*</span>}
                    </label>
                    {inputElement}
                </div>
            );
        }

        return inputElement;
    }

    // Display mode
    if (renderDisplay) {
        return <>{renderDisplay(value)}</>;
    }

    return <span>{value}</span>;
};
