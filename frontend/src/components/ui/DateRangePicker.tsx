import React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDateForInput } from "@/utils/helperFunctions";

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onChange: (start: Date, end: Date) => void;
  minDays?: number; // minimum gap in days (inclusive range). e.g., 6 => start + 6 days = 7-day span
  minStartDate?: Date;
  disabled?: boolean;
  className?: string;
  startLabel?: string;
  endLabel?: string;
  badgeText?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  minDays = 0,
  minStartDate,
  disabled = false,
  className,
  startLabel,
  endLabel,
  badgeText,
}) => {
  const minEndDate = React.useMemo(() => {
    const minEnd = new Date(startDate);
    minEnd.setDate(minEnd.getDate() + minDays);
    return minEnd;
  }, [startDate, minDays]);

  const handleStartChange = (value: string) => {
    let nextStart = new Date(value);
    if (Number.isNaN(nextStart.getTime())) return;

    if (minStartDate && nextStart < minStartDate) {
      nextStart = minStartDate;
    }

    let nextEnd = endDate;
    if (nextEnd < nextStart) {
      nextEnd = nextStart;
    }

    const minEnd = new Date(nextStart);
    minEnd.setDate(minEnd.getDate() + minDays);
    if (nextEnd < minEnd) {
      nextEnd = minEnd;
    }

    onChange(nextStart, nextEnd);
  };

  const handleEndChange = (value: string) => {
    const nextEnd = new Date(value);
    if (Number.isNaN(nextEnd.getTime())) return;

    let nextStart = startDate;
    if (nextEnd < startDate) {
      nextStart = nextEnd;
    }

    if (minStartDate && nextStart < minStartDate) {
      nextStart = minStartDate;
    }

    const minEnd = new Date(nextStart);
    minEnd.setDate(minEnd.getDate() + minDays);
    const adjustedEnd = nextEnd < minEnd ? minEnd : nextEnd;

    onChange(nextStart, adjustedEnd);
  };

  return (
    <div className={cn("flex items-center gap-2 md:gap-3 flex-wrap", className)}>
      <div className="flex items-center gap-2">
        {startLabel && <span className="text-sm text-gray-700">{startLabel}</span>}
        <Input
          type="date"
          value={formatDateForInput(startDate)}
          onChange={(e) => handleStartChange(e.target.value)}
          className="w-32 md:w-40"
          disabled={disabled}
          min={minStartDate ? formatDateForInput(minStartDate) : undefined}
        />
      </div>
      <span className="text-gray-500">to</span>
      <div className="flex items-center gap-2">
        {endLabel && <span className="text-sm text-gray-700">{endLabel}</span>}
        <Input
          type="date"
          value={formatDateForInput(endDate)}
          onChange={(e) => handleEndChange(e.target.value)}
          className="w-32 md:w-40"
          disabled={disabled}
          min={formatDateForInput(minEndDate)}
        />
      </div>
      {badgeText && (
        <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded-full border border-blue-100">
          {badgeText}
        </span>
      )}
    </div>
  );
};
