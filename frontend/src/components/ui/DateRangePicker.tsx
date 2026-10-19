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
  variant?: "default" | "cream" | "modal";
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
  variant = "default",
  startLabel,
  endLabel,
  badgeText,
}) => {
  const modal = variant === "modal";
  const cream = variant === "cream";
  const fieldClass = modal
    ? "h-[38px] w-[150px] rounded-[8px] border-0 bg-light px-[10px] text-[14px] font-normal leading-[18px] tracking-[-0.42px] text-dark-300 shadow-none focus-visible:ring-0"
    : cream
      ? "h-auto w-[148px] rounded-[8px] border-light-525 bg-light px-[15px] py-[10px] text-[16px] font-medium leading-[18px] tracking-[-0.48px] text-dark"
      : "w-32 md:w-40";

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
          className={fieldClass}
          disabled={disabled}
          min={minStartDate ? formatDateForInput(minStartDate) : undefined}
        />
      </div>
      <span className={modal ? "text-[14px] font-normal leading-[18px] tracking-[-0.42px] text-dark-300" : cream ? "text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-dark-300" : "text-gray-500"}>to</span>
      <div className="flex items-center gap-2">
        {endLabel && <span className="text-sm text-gray-700">{endLabel}</span>}
        <Input
          type="date"
          value={formatDateForInput(endDate)}
          onChange={(e) => handleEndChange(e.target.value)}
          className={fieldClass}
          disabled={disabled}
          min={formatDateForInput(minEndDate)}
        />
      </div>
      {badgeText && (
        <span
          className={
            modal
              ? "rounded-[4px] border border-info-200 bg-info-50 px-2 py-[3px] text-[12px] font-medium leading-[13px] tracking-[-0.36px] text-info"
              : "text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded-full border border-blue-100"
          }
        >
          {badgeText}
        </span>
      )}
    </div>
  );
};
