/**
 * DateRangeHeader Component
 * Date-range section of the availability modal: period label, range picker,
 * recurring toggle, setup-instructions popover, and date-change confirm banner.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, Info } from "@/components/icons";
import { SETUP_INSTRUCTIONS } from '@/utils/db';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { segButton, segGroup } from '@/components/schedule/styles';
import { formatDateForInput } from '@/utils/helperFunctions';
import { parseISODateLocal } from '@/utils/dateHelpers';
import type { AvailabilityFormData } from '@/types/availability';

export type ScheduleMode = 'single' | 'repeating' | 'rolling';

const SCHEDULE_MODES: { value: ScheduleMode; label: string }[] = [
  { value: 'single', label: 'Single session' },
  { value: 'repeating', label: 'Repeating weeks' },
  { value: 'rolling', label: 'Repeats weekly' },
];

/** Edit controls for a period that repeats weekly with no end date (ATH-28). */
export interface RollingEditControls {
  repeating: boolean;
  onRepeatingChange: (repeating: boolean) => void;
  endDate: Date;
  minEndDate: Date;
  maxEndDate: Date;
  onEndDateChange: (date: Date) => void;
}

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
  rollingEdit?: RollingEditControls | null;
}

const dateInputClass =
  "h-[38px] w-[150px] rounded-control border-0 bg-light px-[10px] text-body-m text-dark focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-primary focus-visible:ring-0";

/** Parses a date input's value, ignoring partial years while it's being typed (e.g. "0002-10-05"). */
const parseDateInput = (value: string): Date | null => {
  if (!value) return null;
  const date = parseISODateLocal(value);
  return isNaN(date.getTime()) || date.getFullYear() < 1900 ? null : date;
};

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
  rollingEdit = null,
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
            className={cn(segGroup, "w-fit")}
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
                  className={cn(segButton(selected), "flex-none px-3")}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-label-sm text-dark-300">
            {scheduleMode === 'single' ? 'Session date' : scheduleMode === 'rolling' ? 'Starts on' : 'Availability period'}
          </span>
          {scheduleMode === 'single' || scheduleMode === 'rolling' ? (
            <Input
              type="date"
              aria-label={scheduleMode === 'single' ? 'Session date' : 'Start date'}
              value={formatDateForInput(formData.start_date)}
              min={formatDateForInput(minStartDate)}
              disabled={isEditMode}
              onChange={(event) => {
                const date = parseDateInput(event.target.value);
                if (date) onRangeChange(date, date);
              }}
              className={dateInputClass}
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
        {scheduleMode === 'rolling' && !isEditMode && (
          <p className="text-caption text-dark-300">
            Repeats weekly, no end date. Sessions stay open 8 weeks ahead.
          </p>
        )}
        {rollingEdit && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-[10px]">
              <Switch
                checked={rollingEdit.repeating}
                onCheckedChange={rollingEdit.onRepeatingChange}
                id="repeats-weekly-toggle"
                className="h-5 w-9 border-0 data-[state=checked]:bg-primary data-[state=unchecked]:bg-light-550 [&>span]:h-4 [&>span]:w-4 [&>span]:bg-light-300 [&>span]:data-[state=checked]:translate-x-4"
              />
              <label htmlFor="repeats-weekly-toggle" className="text-label-sm text-dark">
                Repeats weekly, no end date
              </label>
              {!rollingEdit.repeating && (
                <>
                  <span className="text-label-sm text-dark-300">Ends on</span>
                  <Input
                    type="date"
                    aria-label="End date"
                    value={formatDateForInput(rollingEdit.endDate)}
                    min={formatDateForInput(rollingEdit.minEndDate)}
                    max={formatDateForInput(rollingEdit.maxEndDate)}
                    onChange={(event) => {
                      const date = parseDateInput(event.target.value);
                      if (date) rollingEdit.onEndDateChange(date);
                    }}
                    className={dateInputClass}
                  />
                </>
              )}
            </div>
            <p className="text-caption text-dark-300">
              {rollingEdit.repeating
                ? 'Sessions stay open 8 weeks ahead.'
                : 'Sessions after the end date are removed. It can’t be before your last booked session.'}
            </p>
          </div>
        )}
        {scheduleMode !== 'single' && (scheduleMode === 'repeating' || isEditMode) && (
        <div className="flex flex-wrap items-center gap-[10px]">
          <Switch
            checked={isRecurring}
            onCheckedChange={onRecurringToggle}
            id="recurring-toggle"
            className="h-5 w-9 border-0 data-[state=checked]:bg-primary data-[state=unchecked]:bg-light-550 [&>span]:h-4 [&>span]:w-4 [&>span]:bg-light-300 [&>span]:data-[state=checked]:translate-x-4"
          />
          <label htmlFor="recurring-toggle" className="text-label-sm text-dark">
            Recurring session
          </label>
          <span className="text-caption text-dark-300">
            {isRecurring ? "Applies to all weeks" : "Only this week"}
          </span>
          <div ref={infoPopoverRef} className="relative">
            <button
              type="button"
              onClick={() => setShowInfoPopover(!showInfoPopover)}
              className="text-dark-300 hover:text-dark"
              title="Setup instructions"
              aria-label="Setup instructions"
            >
              <Info className="size-4" strokeWidth={1.5} />
            </button>
            {showInfoPopover && (
              <div className="absolute left-0 z-50 mt-2 w-80 rounded-card border border-light-525 bg-light-300 p-4 text-dark shadow-overlay">
                <h3 className="mb-3 text-label-sm text-dark">{SETUP_INSTRUCTIONS.title}</h3>
                <ul className="space-y-2 text-caption text-dark-400">
                  {SETUP_INSTRUCTIONS.steps.map((step, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="font-medium text-primary">{idx + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
                {recurringInfo && (
                  <div className="mt-3 border-t border-light-525 pt-3">
                    <p className="mb-1 text-label-sm text-dark">{recurringInfo.title}</p>
                    <p className="text-caption text-dark-300">{recurringInfo.description}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        )}
      </div>
      {showDateChangeConfirm && pendingDateRange && (
        <div className="flex flex-col gap-3 rounded-control border border-info-300 bg-info-50 px-[15px] py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-[1px] size-4 flex-none text-info-700" strokeWidth={1.5} aria-hidden="true" />
            <div className="flex flex-col gap-[3px]">
              <p className="text-label-sm text-dark">Apply new date range?</p>
              <p className="text-caption text-dark-300">
                Changing dates may reset weekly slots. Overlapping weeks will be preserved.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
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
