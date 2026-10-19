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
import { Plus, Trash2 } from "@/components/icons";
import { BrandPill } from '@/components/brand';
import { formatSlotTime } from '@/utils/sessionFormatting';
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
  const fieldClass = "h-[38px] px-[10px]";
  const dateLabel = slot?.occurrence_date
    ? parseISODateLocal(slot.occurrence_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
  const todayISO = getTodayISODate();
  // Only disable for past dates (strictly before today), allow today and future
  const isPastDate = lockPastDates && slot?.occurrence_date ? slot.occurrence_date < todayISO : false;
  const isLocked = isPastDate || isBookingLocked;
  const inputDisabled = !isEnabled || isLocked;
  const rowClass = `border-b border-light-525 ${isLocked ? "opacity-60" : ""}`;

  return (
    <tr className={rowClass}>
      <td className={`${cellClass}`}>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isEnabled}
            onCheckedChange={() => onToggle(dayOfWeek, slotIndex)}
            disabled={isLocked}
            className="size-4 rounded-pill border-light-550 bg-light-50 data-[state=checked]:border-primary-300 data-[state=checked]:bg-primary data-[state=checked]:text-light"
          />
          <div className="flex flex-col">
            <span className="text-label-sm text-dark">{dayName}</span>
            {dateLabel && <span className="mt-[2px] text-caption text-dark-300">{dateLabel}</span>}
            {isPastDate && (
              <BrandPill tone="neutral" className="mt-1 w-fit">Unavailable</BrandPill>
            )}
            {isBookingLocked && (
              <BrandPill tone="neutral" className="mt-1 w-fit">Booked or reserved</BrandPill>
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
          className={`${fieldClass} w-[147px] ${slotError?.session_name ? "border-error-600" : ""}`}
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
            className={`${fieldClass} w-[147px] text-left ${slotError?.pillar_slot ? "border-error-600" : ""}`}
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
          <span className="pointer-events-none absolute left-[10px] top-1/2 -translate-y-1/2 text-body-m text-dark">$</span>
          <Input
            type="number"
            value={slot?.price ?? 50}
            onChange={(e) => onChange(dayOfWeek, 'price', parseFloat(e.target.value), slotIndex)}
            disabled={inputDisabled}
            className={`${fieldClass} w-[82px] pl-6 ${slotError?.price ? "border-error-600" : ""}`}
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
        <div className="flex items-center gap-2">
          <Input
            type="time"
            aria-label="Start time"
            value={slot?.start_time || '10:00'}
            onChange={(e) => onChange(dayOfWeek, 'start_time', e.target.value, slotIndex)}
            disabled={inputDisabled}
            className={`${fieldClass} w-[92px] ${slotError?.start_time ? "border-error-600" : ""}`}
            data-week={weekISO}
            data-day={dayOfWeek}
            data-slot={slotIndex}
            data-field="start_time"
            ref={(el) => registerFocusRef?.(weekISO, dayOfWeek, slotIndex, 'start_time', el)}
          />
          <span className="whitespace-nowrap text-body-m text-dark-300">
            to {formatSlotTime(slot?.end_time || '11:00')}
          </span>
        </div>
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
        <div className="flex items-center justify-end gap-3">
          {onAddSlot && (
            <button
              className="inline-flex size-4 items-center justify-center text-dark-300 hover:text-dark disabled:cursor-not-allowed disabled:text-dark-200"
              title="Duplicate this slot"
              aria-label="Duplicate this slot"
              onClick={() => onAddSlot(slot)}
              type="button"
              disabled={isLocked}
            >
              <Plus className="size-4" strokeWidth={1.5} />
            </button>
          )}
          {onDeleteSlot && canDelete && (
            <button
              className="inline-flex size-4 items-center justify-center text-dark-300 hover:text-dark disabled:cursor-not-allowed disabled:text-dark-200"
              title="Delete this slot"
              aria-label="Delete this slot"
              onClick={onDeleteSlot}
              type="button"
              disabled={isLocked}
            >
              <Trash2 className="size-4" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};
