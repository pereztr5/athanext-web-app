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
  const verticalPadding = compact ? 'py-2' : 'py-3';
  const cellClass = `${compact ? 'px-2' : 'px-4'} ${verticalPadding} text-sm`;
  const dateLabel = slot?.occurrence_date
    ? parseISODateLocal(slot.occurrence_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
  const todayISO = getTodayISODate();
  // Only disable for past dates (strictly before today), allow today and future
  const isPastDate = lockPastDates && slot?.occurrence_date ? slot.occurrence_date < todayISO : false;
  const isLocked = isPastDate || isBookingLocked;
  const inputDisabled = !isEnabled || isLocked;
  const rowClass = `border-b ${isEnabled ? 'bg-green-50' : 'bg-white'} ${isLocked ? 'opacity-60' : ''}`;

  return (
    <tr className={rowClass}>
      <td className={`${cellClass}`}>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isEnabled}
            onCheckedChange={() => onToggle(dayOfWeek, slotIndex)}
            disabled={isLocked}
          />
          <div className="flex flex-col leading-tight">
            <span className="font-medium">{dayName}</span>
            {dateLabel && <span className="text-xs text-gray-500">{dateLabel}</span>}
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
          className={`h-9 w-full ${slotError?.session_name ? 'border-red-500' : ''}`}
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
            className={`h-9 w-40 text-left pl-2 ${slotError?.pillar_slot ? 'border-red-500' : ''}`}
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
        <div className="flex items-center gap-1">
          <span className="text-gray-500">$</span>
          <Input
            type="number"
            value={slot?.price ?? 50}
            onChange={(e) => onChange(dayOfWeek, 'price', parseFloat(e.target.value), slotIndex)}
            disabled={inputDisabled}
            className={`h-9 ${compact ? 'w-16' : 'w-20'} ${slotError?.price ? 'border-red-500' : ''}`}
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
            className="h-9 w-24"
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
          className={`h-9 w-28 ${slotError?.start_time ? 'border-red-500' : ''}`}
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
          className="h-9 w-28 bg-gray-50"
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
            className="h-9 w-32"
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
            className={`${compact ? 'h-9 w-28 text-left pl-2' : 'h-9 w-32 text-left pl-2'}`}
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
              className="text-slate-600 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Duplicate this slot"
              onClick={() => onAddSlot(slot)}
              type="button"
              disabled={isLocked}
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.1} />
            </button>
          )}
          {onDeleteSlot && canDelete && (
            <button
              className="text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
