/**
 * ManageAvailabilityTableRow Component
 * Reusable row component for manage availability table
 */

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import {
  DURATION_OPTIONS,
  SESSION_TYPE_OPTIONS,
} from '@/types/availability';
import { LOCATION_OPTIONS } from '@/utils/db';
import type {
  SlotFormData,
  DayOfWeek,
  SessionType,
  LocationType,
  SlotValidationError,
} from '@/types/availability';
import { capitalizeFirst } from '@/utils/helperFunctions';
import type { SPORTPILLARS } from '@/api/sport-pillars';
import { getTodayISODate, parseISODateLocal } from '@/utils/dateHelpers';

interface ManageAvailabilityTableRowProps {
  dayOfWeek: DayOfWeek;
  dayName: string;
  weekISO: string;
  slot: SlotFormData | null;
  slotError: SlotValidationError | null | undefined;
  onToggle: (dayOfWeek: DayOfWeek, index: number) => void;
  onChange: (dayOfWeek: DayOfWeek, field: keyof SlotFormData, value: any, slotIndex: number) => void;
  onAddSlot?: (slot?: SlotFormData | null) => void;
  onDeleteSlot?: () => void;
  showAddIcon?: boolean;
  canDelete?: boolean;
  slotIndex?: number;
  pillars: SPORTPILLARS[];
  lockPastDates?: boolean;
  isBookingLocked?: boolean;
  compact?: boolean;
  registerFocusRef?: (
    weekISO: string,
    dayOfWeek: DayOfWeek,
    slotIndex: number,
    field: keyof SlotFormData,
    el: HTMLElement | null
  ) => void;
}

export const ManageAvailabilityTableRow = ({
  dayOfWeek,
  dayName,
  slot,
  slotError,
  onToggle,
  onChange,
  onAddSlot,
  showAddIcon = false,
  canDelete = true,
  onDeleteSlot,
  slotIndex = 0,
  pillars,
  lockPastDates = true,
  isBookingLocked = false,
  compact = false,
  weekISO,
  registerFocusRef,
}: ManageAvailabilityTableRowProps) => {
  const isEnabled = slot?.is_enabled ?? false;
  const cellClass = "px-1 py-2 align-middle";
  const fieldClass =
    "h-[38px] rounded-[8px] border-0 bg-[#F1F1E6] px-[10px] text-[14px] font-normal leading-[18px] tracking-[-0.42px] text-[#1A202C] shadow-none placeholder:text-[#A3A6AB] focus-visible:ring-0 disabled:opacity-100";
  const dateLabel = slot?.occurrence_date
    ? parseISODateLocal(slot.occurrence_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
  const todayISO = getTodayISODate();
  // Only disable for past dates (strictly before today), allow today and future
  const isPastDate = lockPastDates && slot?.occurrence_date ? slot.occurrence_date < todayISO : false;
  const isLocked = isPastDate || isBookingLocked;
  const inputDisabled = !isEnabled || isLocked;
  const rowClass = `border-b border-[#EAEADF] ${isLocked ? "opacity-60" : ""}`;

  return (
    <tr className={rowClass}>
      <td className={`${cellClass}`}>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isEnabled}
            onCheckedChange={() => onToggle(dayOfWeek, slotIndex)}
            disabled={isLocked}
            className="size-4 rounded-[4px] border-[#D9D9CF] bg-[#FDFDFC] data-[state=checked]:border-[#6698D2] data-[state=checked]:bg-[#0054B4] data-[state=checked]:text-white"
          />
          <div className="flex flex-col leading-tight">
            <span className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#1A202C]">{dayName}</span>
            {dateLabel && <span className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#767980]">{dateLabel}</span>}
            {isPastDate && (
              <span className="text-[11px] font-semibold text-red-600">Unavailable</span>
            )}
            {isBookingLocked && (
              <span className="text-[11px] font-semibold text-amber-700">Booked/Reserved</span>
            )}
          </div>
        </div>
      </td>

      <td className={`${cellClass} min-w-[200px]`}>
        <Input
          placeholder="Enter name"
          value={slot?.session_name || ''}
          onChange={(e) => onChange(dayOfWeek, 'session_name', e.target.value, slotIndex)}
          disabled={inputDisabled}
          id={`session-name-${dayOfWeek}`}
          className={`${fieldClass} w-[147px] ${slotError?.session_name ? "border border-[#FB4747]" : ""}`}
          data-week={weekISO}
          data-day={dayOfWeek}
          data-slot={slotIndex}
          data-field="session_name"
          ref={(el) => registerFocusRef?.(weekISO, dayOfWeek, slotIndex, 'session_name', el)}
        />
      </td>

      <td className={`${cellClass}`}>
        <Select
          value={slot?.pillar_slot || ''}
          onValueChange={(value: string) => onChange(dayOfWeek, 'pillar_slot', value, slotIndex)}
          disabled={inputDisabled || pillars.length === 0}
        >
          <SelectTrigger
            className={`${fieldClass} w-[147px] text-left ${slotError?.pillar_slot ? "border border-[#FB4747]" : ""}`}
            data-week={weekISO}
            data-day={dayOfWeek}
            data-slot={slotIndex}
            data-field="pillar_slot"
            ref={(el) => registerFocusRef?.(weekISO, dayOfWeek, slotIndex, 'pillar_slot', el)}
          >
            <SelectValue placeholder={pillars.length ? 'Select pillar' : 'No pillars'} />
          </SelectTrigger>
          <SelectContent>
            {pillars.map((pillar) => (
              <SelectItem key={pillar.id} value={pillar.title || ''}>
                {pillar.title || 'Untitled'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      <td className={`${cellClass}`}>
        <div className="relative">
          <span className="pointer-events-none absolute left-[10px] top-1/2 -translate-y-1/2 text-[14px] text-[#1A202C]">$</span>
          <Input
            type="number"
            value={slot?.price ?? 50}
            onChange={(e) => onChange(dayOfWeek, 'price', parseFloat(e.target.value), slotIndex)}
            disabled={inputDisabled}
            className={`${fieldClass} w-[82px] pl-6 ${slotError?.price ? "border border-[#FB4747]" : ""}`}
            data-week={weekISO}
            data-day={dayOfWeek}
            data-slot={slotIndex}
            data-field="price"
            ref={(el) => registerFocusRef?.(weekISO, dayOfWeek, slotIndex, 'price', el)}
          />
        </div>
      </td>

      <td className={`${cellClass}`}>
        <Select
          value={slot?.duration_minutes?.toString() || '60'}
          onValueChange={(value) =>
            onChange(dayOfWeek, 'duration_minutes', parseInt(value) as 30 | 45 | 60 | 90 | 120 | 180, slotIndex)
          }
          disabled={inputDisabled}
        >
          <SelectTrigger
            className={`${fieldClass} w-[97px]`}
            data-week={weekISO}
            data-day={dayOfWeek}
            data-slot={slotIndex}
            data-field="duration_minutes"
            ref={(el) => registerFocusRef?.(weekISO, dayOfWeek, slotIndex, 'duration_minutes', el)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DURATION_OPTIONS.map((duration) => (
              <SelectItem key={duration} value={duration.toString()}>
                {duration} min
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      <td className={`${cellClass}`}>
        <Input
          type="time"
          value={slot?.start_time || '10:00'}
          onChange={(e) => onChange(dayOfWeek, 'start_time', e.target.value, slotIndex)}
          disabled={inputDisabled}
          className={`${fieldClass} w-[92px] ${slotError?.start_time ? "border border-[#FB4747]" : ""}`}
          data-week={weekISO}
          data-day={dayOfWeek}
          data-slot={slotIndex}
          data-field="start_time"
          ref={(el) => registerFocusRef?.(weekISO, dayOfWeek, slotIndex, 'start_time', el)}
        />
      </td>

      <td className={`${cellClass}`}>
        <Input
          type="time"
          value={slot?.end_time || '11:00'}
          disabled
          className="h-[38px] w-[92px] rounded-[8px] border-0 bg-[#F4F4EB] px-[10px] text-[14px] text-[#A3A6AB] shadow-none"
        />
      </td>

      <td className={`${cellClass}`}>
        <Select
          value={slot?.session_type || 'individual'}
          onValueChange={(value: SessionType) =>
            onChange(dayOfWeek, 'session_type', value, slotIndex)
          }
          disabled={inputDisabled}
        >
          <SelectTrigger
            className={`${fieldClass} w-[107px]`}
            data-week={weekISO}
            data-day={dayOfWeek}
            data-slot={slotIndex}
            data-field="session_type"
            ref={(el) => registerFocusRef?.(weekISO, dayOfWeek, slotIndex, 'session_type', el)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SESSION_TYPE_OPTIONS.map((type) => (
              <SelectItem key={type} value={type}>
                {capitalizeFirst(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>


      <td className={`${cellClass}`}>
        <Select
          value={slot?.location || LOCATION_OPTIONS[0].value}
          onValueChange={(value: LocationType) =>
            onChange(dayOfWeek, 'location', value, slotIndex)
          }
          disabled={inputDisabled}
        >
          <SelectTrigger
            className={`${fieldClass} w-[117px] text-left`}
            data-week={weekISO}
            data-day={dayOfWeek}
            data-slot={slotIndex}
            data-field="location"
            ref={(el) => registerFocusRef?.(weekISO, dayOfWeek, slotIndex, 'location', el)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="min-w-[100px]">
            {LOCATION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value as LocationType}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      <td className={`${cellClass}`}>
        <div className="flex items-center gap-2">
          {onAddSlot && (
            <button
              className="text-[#0054B4] disabled:cursor-not-allowed disabled:opacity-40"
              title="Duplicate this slot"
              onClick={() => onAddSlot(slot)}
              type="button"
              disabled={isLocked}
            >
              <Plus className="size-4" strokeWidth={1.75} />
            </button>
          )}
          {onDeleteSlot && canDelete && (
            <button
              className="text-[#767980] disabled:cursor-not-allowed disabled:opacity-40"
              title="Delete this slot"
              onClick={onDeleteSlot}
              type="button"
              disabled={isLocked}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M9 6V4h6v2m-8 0v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6" />
              </svg>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};
