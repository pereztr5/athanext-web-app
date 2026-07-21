/**
 * WeeklySlotsTable Component
 * Weekly time slots section of the availability modal: section header, week
 * navigation, per-day slot rows, and the per-week overlap alert.
 */

import React, { useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { AlertCircle, Clock } from 'lucide-react';
import {
  calculateEndTime,
  normalizeTimeFormat,
} from '@/utils/availabilityValidation';
import { DAY_OF_WEEK_MAP } from '@/types/availability';
import { SESSION_TYPE_DB } from '@/types/sessions-api';
import type {
  SlotFormData,
  DayOfWeek,
  AvailabilityValidationErrors,
} from '@/types/availability';
import { ManageAvailabilityTableHeader } from '@/components/availability/ManageAvailabilityTableHeader';
import { ManageAvailabilityTableRow } from '@/components/availability/ManageAvailabilityTableRow';
import { toLocalISODate } from '@/utils/dateHelpers';
import {
  DEFAULT_SLOT,
  isPastOrToday,
  isDateWithinRange,
  formatClampedWeekRange,
  applyTemplateToWeek,
} from '@/utils/availabilityModalHelpers';
import type { SPORTPILLARS } from '@/api/sport-pillars';

interface WeeklySlotsTableProps {
  weeks: Date[];
  currentWeekIndex: number;
  occurrenceSlots: Record<string, Record<DayOfWeek, SlotFormData[]>>;
  setOccurrenceSlots: React.Dispatch<React.SetStateAction<Record<string, Record<DayOfWeek, SlotFormData[]>>>>;
  currentWeekErrors: AvailabilityValidationErrors;
  weekErrorSet: Set<string>;
  isRecurring: boolean;
  isEditMode: boolean;
  formStartDate: Date;
  formEndDate: Date;
  lockedOccurrenceIds: Set<string>;
  sportPillars: SPORTPILLARS[];
  defaultGroupCapacity: number;
  isOccurrencesBusy: boolean;
  pendingFocusTarget: {
    weekISO: string;
    day: DayOfWeek;
    slotIndex: number;
    field: keyof SlotFormData;
  } | null;
  onFocusHandled: () => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onUserChange: () => void;
  onClearDuplicateError: () => void;
  markWeekCustomized: (weekISO: string) => void;
  clearWeekFieldError: (
    weekISO: string,
    dayOfWeek: DayOfWeek,
    slotIndex: number,
    field: keyof SlotFormData
  ) => void;
  scrollRef: React.Ref<HTMLDivElement>;
}

export const WeeklySlotsTable = ({
  weeks,
  currentWeekIndex,
  occurrenceSlots,
  setOccurrenceSlots,
  currentWeekErrors,
  weekErrorSet,
  isRecurring,
  isEditMode,
  formStartDate,
  formEndDate,
  lockedOccurrenceIds,
  sportPillars,
  defaultGroupCapacity,
  isOccurrencesBusy,
  pendingFocusTarget,
  onFocusHandled,
  onPrevWeek,
  onNextWeek,
  onUserChange,
  onClearDuplicateError,
  markWeekCustomized,
  clearWeekFieldError,
  scrollRef,
}: WeeklySlotsTableProps) => {
  const focusRegistryRef = React.useRef<Map<string, HTMLElement>>(new Map());

  const firstWeekISO = weeks.length ? toLocalISODate(weeks[0]) : '';

  const isSlotLockedByBooking = useCallback((slot?: SlotFormData | null): boolean => {
    if (!isEditMode || !slot?.occurrence_id) return false;
    return lockedOccurrenceIds.has(slot.occurrence_id);
  }, [isEditMode, lockedOccurrenceIds]);

  const getFocusKey = useCallback((
    weekISO: string,
    day: DayOfWeek,
    slotIndex: number,
    field: keyof SlotFormData
  ) => `${weekISO}|${day}|${slotIndex}|${field}`, []);

  const registerFocusRef = useCallback((
    weekISO: string,
    day: DayOfWeek,
    slotIndex: number,
    field: keyof SlotFormData,
    el: HTMLElement | null
  ) => {
    const key = getFocusKey(weekISO, day, slotIndex, field);
    if (el) {
      focusRegistryRef.current.set(key, el);
    } else {
      focusRegistryRef.current.delete(key);
    }
  }, [getFocusKey]);

  // Handle slot enable/disable toggle
  const handleSlotToggle = useCallback((dayOfWeek: DayOfWeek, index: number, weekISO: string) => {
    const affectedWeeks: string[] = [];
    let changed = false;

    setOccurrenceSlots((prev) => {
      const weekSlots = prev[weekISO] || { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as any;
      const slots = [...(weekSlots[dayOfWeek] || [])];
      if (!slots.length) return prev;
      if (isEditMode && isPastOrToday(slots[index]?.occurrence_date)) return prev;
      if (isSlotLockedByBooking(slots[index])) return prev;
      slots[index] = { ...slots[index], is_enabled: !slots[index].is_enabled };
      const next: Record<string, Record<DayOfWeek, SlotFormData[]>> = {
        ...prev,
        [weekISO]: { ...weekSlots, [dayOfWeek]: slots },
      };
      changed = true;

      affectedWeeks.push(weekISO);

      if (isRecurring) {
        return Object.fromEntries(
          weeks.map((wk) => {
            const targetISO = toLocalISODate(wk);
            return [
              targetISO,
              applyTemplateToWeek(next[weekISO], targetISO, prev[targetISO], isEditMode, lockedOccurrenceIds, weekISO),
            ];
          })
        ) as Record<string, Record<DayOfWeek, SlotFormData[]>>;
      }

      if (weekISO !== firstWeekISO) {
        markWeekCustomized(weekISO);
      }

      return next;
    });

    if (changed) {
      onClearDuplicateError();
      onUserChange();
    }
  }, [firstWeekISO, isEditMode, isRecurring, isSlotLockedByBooking, lockedOccurrenceIds, markWeekCustomized, onClearDuplicateError, onUserChange, setOccurrenceSlots, weeks]);

  // Handle slot field changes
  const handleSlotChange = useCallback((
    dayOfWeek: DayOfWeek,
    field: keyof SlotFormData,
    value: any,
    weekISO: string,
    slotIndex: number
  ) => {
    let changed = false;
    setOccurrenceSlots((prev) => {
      const weekSlots = prev[weekISO] || { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as any;
      const slots = weekSlots[dayOfWeek] || [];
      if (!slots.length) return prev;
      const targetSlot = slots[slotIndex];
      if (!targetSlot || (isEditMode && isPastOrToday(targetSlot.occurrence_date))) return prev;
      if (isSlotLockedByBooking(targetSlot)) return prev;
      const updatedSlots = slots.map((s, idx) => {
        if (idx !== slotIndex) return s;
        const newSlot = { ...s, [field]: value };
        if (field === 'duration_minutes' || field === 'start_time') {
          const startTime = field === 'start_time' ? value : newSlot.start_time;
          const duration = field === 'duration_minutes' ? value : newSlot.duration_minutes;
          newSlot.end_time = calculateEndTime(startTime, duration);
        }
        if (field === 'session_type') {
          // Keep capacity in sync with session type even during edits
          newSlot.max_bookings_per_slot = value === SESSION_TYPE_DB.GROUP ? defaultGroupCapacity : 1;
        }
        return newSlot;
      });
      const next = {
        ...prev,
        [weekISO]: { ...weekSlots, [dayOfWeek]: updatedSlots },
      };
      changed = true;

      if (isRecurring) {
        const recurringWeeks = Object.fromEntries(
          weeks.map((wk) => {
            const targetISO = toLocalISODate(wk);
            return [
              targetISO,
              applyTemplateToWeek(next[weekISO], targetISO, prev[targetISO], isEditMode, lockedOccurrenceIds, weekISO),
            ];
          })
        ) as Record<string, Record<DayOfWeek, SlotFormData[]>>;

        const shouldSyncRecurringField =
          field === 'session_name' ||
          field === 'price' ||
          field === 'pillar_slot' ||
          field === 'duration_minutes' ||
          field === 'start_time' ||
          field === 'location' ||
          field === 'session_type';

        if (shouldSyncRecurringField) {
          const syncedWeeks: Record<string, Record<DayOfWeek, SlotFormData[]>> = { ...recurringWeeks };

          weeks.forEach((wk) => {
            const targetISO = toLocalISODate(wk);
            const targetWeek = recurringWeeks[targetISO];
            if (!targetWeek) return;

            const daySlots = [...(targetWeek[dayOfWeek] || [])];
            const mirroredSlot = daySlots[slotIndex];
            if (!mirroredSlot) return;
            if (isEditMode && isPastOrToday(mirroredSlot.occurrence_date)) return;
            if (isSlotLockedByBooking(mirroredSlot)) return;

            const mirroredNext = {
              ...mirroredSlot,
              [field]: value,
            };
            if (field === 'duration_minutes' || field === 'start_time') {
              const startTime = field === 'start_time' ? value : mirroredNext.start_time;
              const duration = field === 'duration_minutes' ? value : mirroredNext.duration_minutes;
              mirroredNext.end_time = calculateEndTime(startTime, duration);
            }
            if (field === 'session_type') {
              mirroredNext.max_bookings_per_slot = value === SESSION_TYPE_DB.GROUP ? defaultGroupCapacity : 1;
            }
            daySlots[slotIndex] = mirroredNext;

            syncedWeeks[targetISO] = {
              ...targetWeek,
              [dayOfWeek]: daySlots,
            };
          });

          return syncedWeeks;
        }

        return recurringWeeks;
      }

      if (weekISO !== firstWeekISO) {
        markWeekCustomized(weekISO);
      }

      return next;
    });
    if (!changed) return;

    clearWeekFieldError(weekISO, dayOfWeek, slotIndex, field);
    onClearDuplicateError();
    onUserChange();
  }, [clearWeekFieldError, defaultGroupCapacity, firstWeekISO, isEditMode, isRecurring, isSlotLockedByBooking, lockedOccurrenceIds, markWeekCustomized, onClearDuplicateError, onUserChange, setOccurrenceSlots, weeks]);

  const addSlotToDay = useCallback((dayOfWeek: DayOfWeek, weekISO: string, baseSlot?: SlotFormData | null) => {
    let changed = false;
    setOccurrenceSlots((prev) => {
      const weekSlots = prev[weekISO] || { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as any;
      const slots = weekSlots[dayOfWeek] || [];
      const weekStart = new Date(weekISO + 'T00:00:00');
      const dayDate = new Date(weekStart);
      dayDate.setDate(dayDate.getDate() + (dayOfWeek - 1));
      const occDate = toLocalISODate(dayDate);
      if (isEditMode && isPastOrToday(occDate)) return prev;
      const base = baseSlot ? { ...baseSlot } : { ...DEFAULT_SLOT };
      const newStart = baseSlot?.end_time ? normalizeTimeFormat(baseSlot.end_time) : base.start_time;
      const newDuration = base.duration_minutes;
      const maxBookings = typeof base.max_bookings_per_slot === 'number'
        ? base.max_bookings_per_slot
        : (base.session_type === SESSION_TYPE_DB.GROUP ? defaultGroupCapacity : 1);
      const newSlot = {
        ...base,
        day_of_week: dayOfWeek,
        is_enabled: true,
        occurrence_date: occDate,
        occurrence_id: undefined,
        start_time: newStart,
        end_time: calculateEndTime(newStart, newDuration),
        max_bookings_per_slot: maxBookings,
      };

      const next = {
        ...prev,
        [weekISO]: {
          ...weekSlots,
          [dayOfWeek]: [
            ...slots,
            newSlot,
          ],
        },
      };
      changed = true;

      if (isRecurring) {
        return Object.fromEntries(
          weeks.map((wk) => {
            const targetISO = toLocalISODate(wk);
            return [
              targetISO,
              applyTemplateToWeek(next[weekISO], targetISO, prev[targetISO], isEditMode, lockedOccurrenceIds, weekISO),
            ];
          })
        ) as Record<string, Record<DayOfWeek, SlotFormData[]>>;
      }

      if (weekISO !== firstWeekISO) {
        markWeekCustomized(weekISO);
      }

      return next;
    });
    if (changed) {
      onUserChange();
    }
  }, [defaultGroupCapacity, firstWeekISO, isEditMode, isRecurring, lockedOccurrenceIds, markWeekCustomized, onUserChange, setOccurrenceSlots, weeks]);

  const handleDeleteSlot = useCallback((dayOfWeek: DayOfWeek, index: number, weekISO: string) => {
    let changed = false;
    setOccurrenceSlots((prev) => {
      const weekSlots = prev[weekISO] || { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as any;
      const slots = [...(weekSlots[dayOfWeek] || [])];
      if (!slots.length) return prev;
      const targetSlot = slots[index];
      if (!targetSlot || isPastOrToday(targetSlot.occurrence_date)) return prev;
      if (isSlotLockedByBooking(targetSlot)) return prev;
      slots.splice(index, 1);
      if (slots.length === 0) {
        const weekStart = new Date(weekISO + 'T00:00:00');
        const dayDate = new Date(weekStart);
        dayDate.setDate(dayDate.getDate() + (dayOfWeek - 1));
        const occDate = toLocalISODate(dayDate);
        slots.push({
          ...DEFAULT_SLOT,
          day_of_week: dayOfWeek,
          is_enabled: false,
          occurrence_date: occDate,
          max_bookings_per_slot: DEFAULT_SLOT.max_bookings_per_slot,
        });
      }
      const next = {
        ...prev,
        [weekISO]: { ...weekSlots, [dayOfWeek]: slots },
      };
      changed = true;

      if (isRecurring) {
        return Object.fromEntries(
          weeks.map((wk) => {
            const targetISO = toLocalISODate(wk);
            return [
              targetISO,
              applyTemplateToWeek(next[weekISO], targetISO, prev[targetISO], isEditMode, lockedOccurrenceIds, weekISO),
            ];
          })
        ) as Record<string, Record<DayOfWeek, SlotFormData[]>>;
      }

      if (weekISO !== firstWeekISO) {
        markWeekCustomized(weekISO);
      }

      return next;
    });
    if (changed) {
      onUserChange();
    }
  }, [firstWeekISO, isEditMode, isRecurring, isSlotLockedByBooking, lockedOccurrenceIds, markWeekCustomized, onUserChange, setOccurrenceSlots, weeks]);

  useEffect(() => {
    if (!pendingFocusTarget) return;
    const { weekISO, day, slotIndex, field } = pendingFocusTarget;
    const focusKey = getFocusKey(weekISO, day, slotIndex, field);

    // Skip if we're reacting to unrelated re-renders with the same target and week index
    const last = (focusRegistryRef.current as any)._lastFocusMeta as
      | { key: string; weekIndex: number }
      | undefined;
    if (last && last.key === focusKey && last.weekIndex === currentWeekIndex) {
      return;
    }
    (focusRegistryRef.current as any)._lastFocusMeta = { key: focusKey, weekIndex: currentWeekIndex };

    const selector = `[data-week="${weekISO}"][data-day="${day}"][data-slot="${slotIndex}"][data-field="${field}"]`;
    const focusEl = () => {
      const el = focusRegistryRef.current.get(focusKey) || (document.querySelector(selector) as HTMLElement | null);
      if (el) {
        el.focus({ preventScroll: true });
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Clear only after we confirm the element is actually focused to avoid unexpected loss of focus
        if (document.activeElement === el) {
          onFocusHandled();
        } else {
          requestAnimationFrame(() => {
            if (document.activeElement === el) {
              onFocusHandled();
            }
          });
        }
        return true;
      }
      return false;
    };
    const immediate = focusEl();
    if (immediate) return;
    const id = window.setTimeout(() => {
      focusEl();
    }, 150);
    return () => window.clearTimeout(id);
  }, [currentWeekIndex, getFocusKey, onFocusHandled, pendingFocusTarget]);

  const currentWeek = weeks[currentWeekIndex] || null;
  const currentWeekISO = currentWeek ? toLocalISODate(currentWeek) : '';

  return (
    <div
      className="flex flex-col min-h-[360px] max-h-[65vh]"
      ref={scrollRef}
    >
      <div className="mb-4 flex-shrink-0 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Clock className="w-5 h-5 text-red-600" />
          <h3 className="text-lg font-bold">Weekly Time Slots</h3>
          <span className="inline-flex items-center whitespace-nowrap rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
            EST
          </span>
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          {weeks.length > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onPrevWeek}
                disabled={currentWeekIndex === 0}
                className="text-gray-600 border border-slate-300 rounded-full px-3"
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onNextWeek}
                disabled={currentWeekIndex >= weeks.length - 1}
                className="text-gray-600 border border-slate-300 rounded-full px-3"
              >
                Next
              </Button>
            </div>
          )}
          <span className="text-sm text-gray-600 flex items-center gap-2 text-left md:text-right">
            Week {currentWeekIndex + 1} of {Math.max(weeks.length, 1)}{currentWeek ? `: ${formatClampedWeekRange(currentWeek, formStartDate, formEndDate)}` : ''}
            {currentWeekISO && weekErrorSet.has(currentWeekISO) && (
              <span
                className="inline-flex h-2 w-2 rounded-full bg-red-500"
                title="Issues in this week"
              />
            )}
          </span>
        </div>
      </div>

      {/* Scrollable Table */}
      <div className="border rounded-lg overflow-x-auto overflow-y-auto flex-1 min-h-[420px] md:min-h-[460px]">
        {isOccurrencesBusy ? (
          <div className="p-4">
            <div className="mb-3">
              <Skeleton className="h-6 w-40" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
        ) : (
          <table className="w-full min-w-[650px]">
            <ManageAvailabilityTableHeader compact />
            <tbody>
              {Object.entries(DAY_OF_WEEK_MAP).map(([dayNum, dayName]) => {
                const day = parseInt(dayNum) as DayOfWeek;
                const weekISO = weeks[currentWeekIndex] ? toLocalISODate(weeks[currentWeekIndex]) : '';
                const weekSlots = occurrenceSlots[weekISO] || { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as any;
                const slots = weekSlots[day] || [];
                const dayErrors = (currentWeekErrors.slots?.[day] as Array<any>) || [];
                return (
                  <React.Fragment key={dayNum}>
                    {slots.map((slot, idx) => {
                      const inRange = isDateWithinRange(
                        slot?.occurrence_date,
                        formStartDate,
                        formEndDate
                      );
                      if (!inRange) return null;
                      return (
                        <ManageAvailabilityTableRow
                          compact
                          key={`${dayNum}-${idx}`}
                          dayOfWeek={day}
                          dayName={idx === 0 ? dayName : `${dayName} (slot ${idx + 1})`}
                          weekISO={weekISO}
                          slot={slot}
                          slotError={dayErrors[idx] || null}
                          slotIndex={idx}
                          onToggle={(d) => handleSlotToggle(d, idx, weekISO)}
                          onChange={(d, field, value) => handleSlotChange(d, field, value, weekISO, idx)}
                          onAddSlot={() => addSlotToDay(day, weekISO, slot)}
                          showAddIcon
                          onDeleteSlot={() => handleDeleteSlot(day, idx, weekISO)}
                          canDelete={(day !== 1 && slots.length > 1) || (day === 1 && idx > 0)}
                          pillars={sportPillars || []}
                          lockPastDates={isEditMode}
                          isBookingLocked={isSlotLockedByBooking(slot)}
                          registerFocusRef={registerFocusRef}
                        />
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {currentWeekErrors.overlap && (
        <Alert
          variant="destructive"
          className="mt-3 bg-red-50 border border-red-200 py-2 px-3 flex items-center gap-3"
        >
          <AlertCircle className="h-4 w-4 text-red-600" />
          <span className="text-sm text-red-800 font-medium">{currentWeekErrors.overlap}</span>
        </Alert>
      )}
    </div>
  );
};
