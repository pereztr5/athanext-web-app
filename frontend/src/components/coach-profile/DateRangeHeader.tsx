/**
 * DateRangeHeader Component
 * Date-range section of the availability modal: period label, range picker,
 * recurring toggle, setup-instructions popover, and date-change confirm banner.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, Info } from 'lucide-react';
import { SETUP_INSTRUCTIONS } from '@/utils/db';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import type { AvailabilityFormData } from '@/types/availability';

interface DateRangeHeaderProps {
  formData: AvailabilityFormData;
  isEditMode: boolean;
  isRecurring: boolean;
  minDays: number;
  minStartDate: Date;
  pendingDateRange: { start: Date; end: Date } | null;
  showDateChangeConfirm: boolean;
  onRangeChange: (start: Date, end: Date) => void;
  onRecurringToggle: (enabled: boolean) => void;
  onConfirmDateChange: () => void;
  onCancelDateChange: () => void;
}

export const DateRangeHeader = ({
  formData,
  isEditMode,
  isRecurring,
  minDays,
  minStartDate,
  pendingDateRange,
  showDateChangeConfirm,
  onRangeChange,
  onRecurringToggle,
  onConfirmDateChange,
  onCancelDateChange,
}: DateRangeHeaderProps) => {
  const [showInfoPopover, setShowInfoPopover] = useState(false);
  const infoPopoverRef = React.useRef<HTMLDivElement | null>(null);
  const recurringInfo = SETUP_INSTRUCTIONS.recurring;

  // Close info popover on outside click
  useEffect(() => {
    if (!showInfoPopover) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (infoPopoverRef.current && !infoPopoverRef.current.contains(event.target as Node)) {
        setShowInfoPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showInfoPopover]);

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#767980]">
            Availability period
          </span>
          <DateRangePicker
            startDate={formData.start_date}
            endDate={formData.end_date}
            onChange={onRangeChange}
            minDays={minDays}
            minStartDate={minStartDate}
            disabled={isEditMode}
            badgeText="Min 1 week"
            variant="modal"
          />
        </div>
        <div className="flex flex-wrap items-center gap-[10px]">
          <Switch
            checked={isRecurring}
            onCheckedChange={onRecurringToggle}
            id="recurring-toggle"
            className="h-5 w-9 border-0 data-[state=checked]:bg-[#0054B4] data-[state=unchecked]:bg-[#D9D9CF] [&>span]:h-4 [&>span]:w-4 [&>span]:bg-white [&>span]:data-[state=checked]:translate-x-4"
          />
          <label htmlFor="recurring-toggle" className="text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#1A202C]">
            Recurring session
          </label>
          <span className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#767980]">
            {isRecurring ? "Applies to all weeks" : "Only this week"}
          </span>
          <div ref={infoPopoverRef} className="relative">
            <button
              type="button"
              onClick={() => setShowInfoPopover(!showInfoPopover)}
              className="text-[#767980]"
              title="Setup instructions"
              aria-label="Setup instructions"
            >
              <Info className="size-4" strokeWidth={1.75} />
            </button>
            {showInfoPopover && (
              <div className="absolute left-0 z-50 mt-2 w-80 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] p-4 text-[#1A202C] shadow-[0_0_15px_rgba(0,0,0,0.05)]">
                <h3 className="mb-3 text-[14px] font-medium text-[#1A202C]">{SETUP_INSTRUCTIONS.title}</h3>
                <ul className="space-y-2 text-[12px] leading-[14px] text-[#484D56]">
                  {SETUP_INSTRUCTIONS.steps.map((step, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="font-medium text-[#0054B4]">{idx + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
                {recurringInfo && (
                  <div className="mt-3 border-t border-[#EAEADF] pt-3">
                    <p className="mb-1 text-[14px] font-medium text-[#1A202C]">{recurringInfo.title}</p>
                    <p className="text-[12px] leading-[14px] text-[#767980]">{recurringInfo.description}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {showDateChangeConfirm && pendingDateRange && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <div>
              <p className="text-sm font-semibold">Apply new date range?</p>
              <p className="text-xs text-amber-800">
                Changing dates may reset weekly slots. Overlapping weeks will be preserved.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancelDateChange}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onConfirmDateChange}
            >
              Apply
            </Button>
          </div>
        </div>
      )}
    </>
  );
};
