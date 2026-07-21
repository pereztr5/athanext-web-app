/**
 * DateRangeHeader Component
 * Date-range section of the availability modal: period label, range picker,
 * recurring toggle, setup-instructions popover, and date-change confirm banner.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, Calendar, Info } from 'lucide-react';
import { formatDateForInput } from '@/utils/helperFunctions';
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
      {/* Date Range Section */}
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-sm md:text-base">Availability Period:</span>
          <span className="text-gray-600 text-sm md:text-base">
            {formatDateForInput(formData.start_date)} - {formatDateForInput(formData.end_date)}
          </span>
        </div>
        <DateRangePicker
          startDate={formData.start_date}
          endDate={formData.end_date}
          onChange={onRangeChange}
          minDays={minDays}
          minStartDate={minStartDate}
          disabled={isEditMode}
          badgeText="Min 1 week"
        />
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
          <Switch
            checked={isRecurring}
            onCheckedChange={onRecurringToggle}
            id="recurring-toggle"
          />
          <label htmlFor="recurring-toggle" className="text-sm font-semibold text-slate-700">
            Recurring session
          </label>
          <span className="text-xs text-slate-500">
            {isRecurring ? 'Applies to all weeks' : 'Only this week'}
          </span>
        </div>
        {/* Info Button with Popover */}
        <div className="relative ml-2">
          <div ref={infoPopoverRef} className="relative">
          <button
            onClick={() => setShowInfoPopover(!showInfoPopover)}
            className="bg-blue-100 hover:bg-blue-200 rounded-full p-2 transition"
            title="Setup instructions"
          >
            <Info className="h-5 w-5 text-blue-600" />
          </button>
          {showInfoPopover && (
            <div className="absolute right-0 mt-2 w-80 bg-white text-gray-900 rounded-lg shadow-lg p-4 z-50 border border-gray-200">
              <h3 className="font-semibold text-blue-900 mb-3">{SETUP_INSTRUCTIONS.title}</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                {SETUP_INSTRUCTIONS.steps.map((step, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="font-semibold text-blue-600">{idx + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
              {recurringInfo && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="font-semibold text-blue-900 mb-1">{recurringInfo.title}</p>
                  <p className="text-sm text-blue-800">{recurringInfo.description}</p>
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
