import React from "react";

export interface EditableFieldGroupProps {
    isEditMode: boolean;
    children: React.ReactNode;
}

/**
 * EditableFieldGroup - Wraps multiple editable fields with proper spacing
 * 
 * Usage:
 * <EditableFieldGroup isEditMode={isEditMode}>
 *   <EditableField ... />
 *   <EditableField ... />
 * </EditableFieldGroup>
 */
export const EditableFieldGroup: React.FC<EditableFieldGroupProps> = ({
    isEditMode,
    children,
}) => {
    if (!isEditMode) {
        return <>{children}</>;
    }
    return <div className="flex flex-col gap-4">{children}</div>;
};
