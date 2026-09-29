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
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatDateForInput } from '@/utils/helperFunctions';
import { parseISODateLocal } from '@/utils/dateHelpers';
import type { AvailabilityFormData } from '@/types/availability';

export type ScheduleMode = 'single' | 'repeating';

const SCHEDULE_MODES: { value: ScheduleMode; label: string }[] = [
  { value: 'single', label: 'Single session' },
  { value: 'repeating', label: 'Repeating weeks' },
];

interface DateRangeHeaderProps {
  formData: AvailabilityFormData;
  isEditMode: boolean;
  isRecurring: boolean;
  scheduleMode: ScheduleMode;
  onScheduleModeChange: (mode: ScheduleMode) => void;
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
  scheduleMode,
  onScheduleModeChange,
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
        {!isEditMode && (
          <div
            role="radiogroup"
            aria-label="Schedule type"
            className="inline-flex w-fit rounded-[8px] border border-[#EAEADF] bg-[#F1F1E6] p-[3px]"
          >
            {SCHEDULE_MODES.map((mode) => {
              const selected = scheduleMode === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onScheduleModeChange(mode.value)}
                  className={cn(
                    "h-[30px] rounded-[6px] px-3 text-[14px] font-medium leading-[18px] tracking-[-0.03em] transition-colors",
                    selected ? "bg-[#F7F7F0] text-[#1A202C] shadow-[0_0_4px_rgba(0,0,0,0.06)]" : "text-[#767980] hover:text-[#1A202C]"
                  )}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#767980]">
            {scheduleMode === 'single' ? 'Session date' : 'Availability period'}
          </span>
          {scheduleMode === 'single' ? (
            <Input
              type="date"
              aria-label="Session date"
              value={formatDateForInput(formData.start_date)}
              min={formatDateForInput(minStartDate)}
              disabled={isEditMode}
              onChange={(event) => {
                if (!event.target.value) return;
                const date = parseISODateLocal(event.target.value);
                // Ignore partial years while the date is being typed (e.g. "0002-10-05").
                if (isNaN(date.getTime()) || date.getFullYear() < 1900) return;
                onRangeChange(date, date);
              }}
              className="h-[38px] w-[150px] rounded-[8px] border-0 bg-[#F1F1E6] px-[10px] text-[14px] font-normal leading-[18px] tracking-[-0.42px] text-[#767980] shadow-none focus-visible:ring-0"
            />
          ) : (
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
          )}
        </div>
        {scheduleMode === 'repeating' && (
        <div className="flex flex-wrap items-center gap-[10px]">
          <Switch
            checked={isRecurring}
            onCheckedChange={onRecurringToggle}
            id="recurring-toggle"
            className="h-5 w-9 border-0 data-[state=checked]:bg-[#0054B4] data-[state=unchecked]:bg-[#D9D9CF] [&>span]:h-4 [&>span]:w-4 [&>span]:bg-[#F7F7F0] [&>span]:data-[state=checked]:translate-x-4"
          />
          <label htmlFor="recurring-toggle" className="text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">
            Recurring session
          </label>
          <span className="text-[12px] font-normal leading-[14px] tracking-[-0.03em] text-[#767980]">
            {isRecurring ? "Applies to all weeks" : "Only this week"}
          </span>
          <div ref={infoPopoverRef} className="relative">
            <button
              type="button"
              onClick={() => setShowInfoPopover(!showInfoPopover)}
              className="text-[#767980] hover:text-[#1A202C]"
              title="Setup instructions"
              aria-label="Setup instructions"
            >
              <Info className="size-4" strokeWidth={1.5} />
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
        )}
      </div>
      {showDateChangeConfirm && pendingDateRange && (
        <div className="flex flex-col gap-3 rounded-[8px] bg-[#FDF7EC] px-[15px] py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-[1px] size-4 flex-none text-[#906A29]" strokeWidth={1.5} aria-hidden="true" />
            <div className="flex flex-col gap-[3px]">
              <p className="text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">Apply new date range?</p>
              <p className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
                Changing dates may reset weekly slots. Overlapping weeks will be preserved.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancelDateChange}
              className="h-[30px] rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] px-4 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C] hover:bg-[#EAEADF]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onConfirmDateChange}
              className="h-[30px] rounded-[8px] border border-[#6698D2] bg-[#0054B4] px-4 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#F1F1E6] hover:bg-[#004390]"
            >
              Apply
            </Button>
          </div>
        </div>
      )}
    </>
  );
};
