# Editable Field Components

A collection of reusable React components for handling edit/display modes in forms. These components provide a consistent API and encapsulate state management for common form patterns.

## Components

### EditableField

A general-purpose component that renders either an input field (edit mode) or custom display content (view mode).

**Props:**
- `isEditMode`: boolean - Determines if field is editable
- `value`: string - Current field value
- `onChange`: (value: string) => void - Called when value changes
- `onBlur`: () => void - Called when input loses focus
- `onKeyDown`: (e: KeyboardEvent) => void - Keyboard event handler
- `placeholder`: string - Input placeholder text
- `inputClassName`: string - CSS classes for input
- `type`: string - Input type (default: "text")
- `renderDisplay`: (value: string) => ReactNode - Custom render for display mode
- `inputPrefix`: ReactNode - Element before input
- `inputSuffix`: ReactNode - Element after input
- `label`: string - Label text above input (edit mode only)

**Example:**
```tsx
<EditableField
  isEditMode={isEditMode}
  value={coach.name}
  onChange={(value) => onFieldChange("name", value)}
  inputClassName="text-2xl font-bold"
  placeholder="Coach name"
  renderDisplay={(value) => (
    <h1 className="text-2xl font-bold">{value}</h1>
  )}
/>
```

### EditableArrayField

Handles comma-separated string arrays with automatic parsing and validation.

**Props:**
- `isEditMode`: boolean - Determines if field is editable
- `values`: string[] - Array of values
- `onChange`: (values: string[]) => void - Called with parsed array
- `placeholder`: string - Input placeholder
- `inputClassName`: string - CSS classes for input
- `label`: string - Label text (edit mode only)
- `renderDisplay`: (values: string[]) => ReactNode - Custom render for display mode

**Example:**
```tsx
<EditableArrayField
  isEditMode={isEditMode}
  values={coach.specialties || []}
  onChange={(values) => onFieldChange("specialties", values)}
  label="Specialties (comma-separated)"
  placeholder="e.g., Strength Training, Cardio"
  renderDisplay={(values) => (
    <div className="flex gap-2">
      {values.map((v, i) => (
        <Badge key={i}>{v}</Badge>
      ))}
    </div>
  )}
/>
```

**Features:**
- Maintains local state for smooth typing experience
- Commits changes on blur or Enter key
- Automatically trims and filters empty values
- Normalizes display format after commit

### EditableNumberField

Handles numeric input with proper type conversion and validation.

**Props:**
- `isEditMode`: boolean - Determines if field is editable
- `value`: number | undefined - Current numeric value
- `onChange`: (value: number) => void - Called with parsed number
- `placeholder`: string - Input placeholder
- `inputClassName`: string - CSS classes for input
- `label`: string - Label text (edit mode only)
- `prefix`: ReactNode - Element before input
- `suffix`: ReactNode - Element after input
- `renderDisplay`: (value: number | undefined) => ReactNode - Custom render for display mode

**Example:**
```tsx
<EditableNumberField
  isEditMode={isEditMode}
  value={coach.years_experience}
  onChange={(value) => onFieldChange("years_experience", value)}
  inputClassName="w-24"
  suffix={<span>years</span>}
  renderDisplay={(value) => (
    <span>{value || 0}+ years experience</span>
  )}
/>
```

### EditableFieldGroup

Wrapper component that adds proper spacing between multiple editable fields in edit mode.

**Props:**
- `isEditMode`: boolean - Determines if group is in edit mode
- `children`: ReactNode - Child components

**Example:**
```tsx
<EditableFieldGroup isEditMode={isEditMode}>
  <EditableField ... />
  <EditableArrayField ... />
  <EditableNumberField ... />
</EditableFieldGroup>
```

## Usage Pattern

### Basic Implementation

```tsx
import {
  EditableField,
  EditableArrayField,
  EditableNumberField,
  EditableFieldGroup,
} from "@/components/coach-profile/editable";

function MyComponent({ isEditMode, data, onFieldChange }) {
  return (
    <EditableFieldGroup isEditMode={isEditMode}>
      <EditableField
        isEditMode={isEditMode}
        value={data.name}
        onChange={(value) => onFieldChange("name", value)}
        label="Name"
        renderDisplay={(value) => <h2>{value}</h2>}
      />
      
      <EditableArrayField
        isEditMode={isEditMode}
        values={data.tags}
        onChange={(values) => onFieldChange("tags", values)}
        label="Tags"
        renderDisplay={(values) => values.join(", ")}
      />
      
      <EditableNumberField
        isEditMode={isEditMode}
        value={data.age}
        onChange={(value) => onFieldChange("age", value)}
        label="Age"
        renderDisplay={(value) => `${value} years old`}
      />
    </EditableFieldGroup>
  );
}
```

## Benefits

✅ **Consistent API** - All components follow the same prop pattern  
✅ **Type Safety** - Full TypeScript support with proper interfaces  
✅ **State Management** - Components handle their own local state  
✅ **Flexibility** - Custom render functions for display mode  
✅ **Accessibility** - Proper label and input associations  
✅ **UX** - Smooth interactions with keyboard support  
✅ **Maintainable** - Separated concerns and single responsibility  

## Design Principles

1. **Declarative** - Components describe what to render, not how
2. **Composable** - Can be combined and nested as needed
3. **Controlled** - Parent controls the data, components handle UI
4. **Predictable** - Same props always produce same output
5. **Testable** - Isolated components easy to unit test
