import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

export interface EditableArrayFieldProps {
    isEditMode: boolean;
    values: string[];
    onChange: (values: string[]) => void;
    placeholder?: string;
    inputClassName?: string;
    label?: string;
    renderDisplay: (values: string[]) => React.ReactNode;
}

/**
 * EditableArrayField - Handles comma-separated array inputs with proper parsing
 * 
 * Usage:
 * <EditableArrayField
 *   isEditMode={isEditMode}
 *   values={coach.specialties || []}
 *   onChange={(values) => handleChange("specialties", values)}
 *   label="Specialties"
 *   renderDisplay={(values) => values.map(v => <Badge>{v}</Badge>)}
 * />
 */
export const EditableArrayField: React.FC<EditableArrayFieldProps> = ({
    isEditMode,
    values,
    onChange,
    placeholder,
    inputClassName = "",
    label,
    renderDisplay,
}) => {
    const [localInput, setLocalInput] = useState<string>(values?.join(", ") || "");

    useEffect(() => {
        setLocalInput(values?.join(", ") || "");
    }, [values]);

    const parseArrayInput = (raw: string): string[] => {
        return raw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    };

    const commitChanges = () => {
        const parsed = parseArrayInput(localInput);
        onChange(parsed);
        setLocalInput(parsed.join(", "));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            commitChanges();
            (e.target as HTMLInputElement).blur();
        }
    };

    if (!isEditMode) {
        return <>{renderDisplay(values)}</>;
    }

    const inputElement = (
        <Input
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            onBlur={commitChanges}
            onKeyDown={handleKeyDown}
            className={inputClassName}
            placeholder={placeholder}
        />
    );

    if (label) {
        return (
            <div className="flex flex-col gap-1.5">
                <label className="text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">{label}</label>
                {inputElement}
            </div>
        );
    }

    return inputElement;
};
