/**
 * ManageAvailabilityModal Component
 * Modal for coaches to add/edit their availability with recurring weekly slots
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { AlertCircle, Calendar, X } from "@/components/icons";
import {
  validateAvailabilityForm,
  hasValidationErrors,
  normalizeTimeFormat,
} from '@/utils/availabilityValidation';
import {
  DURATION_OPTIONS,
  SESSION_TYPE_OPTIONS,
} from '@/types/availability';
import { SESSION_TYPE_DB } from '@/types/sessions-api';
import type {
  AvailabilityFormData,
  SlotFormData,
  DayOfWeek,
  AvailabilityValidationErrors,
  CoachAvailability,
} from '@/types/availability';
import { capitalizeFirst } from '@/utils/helperFunctions';
import { useCoachDetails } from '@/hooks/useCoachDetails';
import { useSportPillars } from '@/hooks/useSportPillars';
import { useLockedOccurrenceIds } from '@/hooks/useLockedOccurrenceIds';
import { formatWeekRange, getWeekStart, parseISODateLocal, toLocalISODate } from '@/utils/dateHelpers';
import {
  DEFAULT_SLOT,
  buildWeeksRange,
  clampSlotsToRange,
  clampWeekSlotsToRange,
  applyTemplateToWeek,
  filterWeekSlotsWithinRange,
  buildWeekSlotsFromOccurrences,
  createEmptyWeekSlots,
  isDateWithinRange,
} from '@/utils/availabilityModalHelpers';
import { DateRangeHeader, type ScheduleMode } from './DateRangeHeader';
import { WeeklySlotsTable } from './WeeklySlotsTable';
import type { Enums } from '@/integrations/supabase/types';
import { useOccurrencesV3 } from '@/hooks/useAvailabilityOccurrences';
import { useAvailabilitySubmit } from '@/hooks/useAvailabilitySubmit';
import { getDefaultGroupCapacity } from '@/api/configurations';
import type { SlotOccurrence } from '@/types/availabilityWithOccurrences';

interface ManageAvailabilityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coachId: string;
  editData?: CoachAvailability | null;
  initialFocusDay?: DayOfWeek | null;
  existingAvailabilities?: CoachAvailability[] | null;
  /** Schedule type selected when adding (e.g. 'single' for a one-off session). */
  defaultScheduleMode?: ScheduleMode;
}

// A weekly repeat with no end date is laid out as its first 8 weeks; the server keeps it 8 weeks ahead (ATH-28).
const ROLLING_RANGE_DAYS = 8 * 7 - 1;
const INITIAL_RANGE_DAYS: Record<ScheduleMode, number> = { single: 0, repeating: 30, rolling: ROLLING_RANGE_DAYS };

// Initial form state for a new availability of the given type
const getInitialFormData = (mode: ScheduleMode): AvailabilityFormData => ({
  start_date: new Date(),
  end_date: new Date(Date.now() + INITIAL_RANGE_DAYS[mode] * 24 * 60 * 60 * 1000),
  slots: {
    1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [],
  },
});

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};


const errorAlertClass =
  "flex min-h-[50px] items-center gap-2 rounded-control border border-error-300 bg-error-50 px-[15px] py-2 [&>svg]:static [&>svg]:text-error-600 [&>svg~*]:pl-0 [&>svg+div]:translate-y-0";

export const ManageAvailabilityModal = ({
  open,
  onOpenChange,
  coachId,
  editData = null,
  initialFocusDay = null,
  existingAvailabilities = null,
  defaultScheduleMode = 'repeating',
}: ManageAvailabilityModalProps) => {
  const isEditMode = !!editData;
  const { coach } = useCoachDetails(coachId);
  const coachSport = useMemo<Enums<'sport_type'> | undefined>(() => {
    const sportValue = coach?.sport;
    if (!sportValue) return undefined;
    return sportValue.toLowerCase() as Enums<'sport_type'>;
  }, [coach?.sport]);
  const { sportPillars } = useSportPillars({ sport: coachSport, autoFetch: !!coachSport });

  const [formData, setFormData] = useState<AvailabilityFormData>(() => getInitialFormData(defaultScheduleMode));
  const [errors, setErrors] = useState<AvailabilityValidationErrors>({});
  const [weekErrors, setWeekErrors] = useState<Record<string, AvailabilityValidationErrors>>({});
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const issueScrollRef = React.useRef<HTMLDivElement | null>(null);
  const resetDatesRef = React.useRef(false);
  // Slot carried to a newly picked single-session date; a ref so consuming it doesn't re-run seeding.
  const singleSlotCarryRef = React.useRef<Record<string, Record<DayOfWeek, SlotFormData[]>> | null>(null);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [occurrenceSlots, setOccurrenceSlots] = useState<Record<string, Record<DayOfWeek, SlotFormData[]>>>({});
  const [hasUserChanges, setHasUserChanges] = useState(false);
  const [weekInitialized, setWeekInitialized] = useState(false);
  const [customizedWeeks, setCustomizedWeeks] = useState<Set<string>>(new Set());
  const [pendingDateRange, setPendingDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [showDateChangeConfirm, setShowDateChangeConfirm] = useState(false);
  const [preservedSlotsForRange, setPreservedSlotsForRange] = useState<Record<string, Record<DayOfWeek, SlotFormData[]>> | null>(null);
  const [usePreservedSlots, setUsePreservedSlots] = useState(false);
  const [defaultGroupCapacity, setDefaultGroupCapacity] = useState<number>(50);
  const [pendingFocusTarget, setPendingFocusTarget] = useState<{
    weekISO: string;
    day: DayOfWeek;
    slotIndex: number;
    field: keyof SlotFormData;
  } | null>(null);
  const [isRecurring, setIsRecurring] = useState(!isEditMode && defaultScheduleMode !== 'single');
  const [showRecurringConfirm, setShowRecurringConfirm] = useState(false);
  const [editHydrated, setEditHydrated] = useState(false);
  const [awaitingOccurrences, setAwaitingOccurrences] = useState(false);
  const [addResetKey, setAddResetKey] = useState(0);

  const {
    data: occurrencesData,
    refetch: refetchOccurrences,
    isLoading: occurrencesLoading,
    isFetching: occurrencesFetching,
    isFetched: occurrencesFetched,
  } = useOccurrencesV3(editData?.id || null);
  const { lockedOccurrenceIds } = useLockedOccurrenceIds(
    editData?.id || null,
    open && isEditMode
  );
  const MIN_RANGE_DAYS = 6; // inclusive: start + 6 days = 7-day span
  // Single session: one date, one slot, no week minimum. Edit mode infers it from a one-day period.
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(defaultScheduleMode);
  const isSingleSession = isEditMode
    ? Boolean(editData && editData.start_date === editData.end_date)
    : scheduleMode === 'single';
  const minRangeDays = isSingleSession ? 0 : MIN_RANGE_DAYS;
  // Editing a repeating period: the coach can stop it by switching this off and picking an end date.
  const isRollingPeriod = isEditMode && Boolean(editData?.repeats_weekly);
  const [repeatsWeekly, setRepeatsWeekly] = useState(false);

  // Memoized derived values
  const enabledSlotsMemo = useMemo(() => {
    const out: SlotFormData[] = [];
    Object.values(occurrenceSlots).forEach((weekSlots) => {
      Object.values(weekSlots).forEach((slots) => {
        (slots || []).forEach((slot) => {
          if (slot && slot.is_enabled) {
            const maxBookings = typeof slot.max_bookings_per_slot === 'number'
              ? slot.max_bookings_per_slot
              : (slot.session_type === SESSION_TYPE_DB.GROUP ? defaultGroupCapacity : 1);
            const { occurrence_id: _occurrenceId, ...persistableSlot } = slot;
            out.push({
              ...persistableSlot,
              price: parseFloat(slot.price.toString()),
              max_bookings_per_slot: maxBookings,
            });
          }
        });
      });
    });
    return out;
  }, [defaultGroupCapacity, occurrenceSlots]);

  const weeks = useMemo(() => {
    // Prefer the availability dates (edit) to guarantee the intended period
    const baseStart = editData ? parseISODateLocal(editData.start_date) : formData.start_date;
    const baseEnd = editData ? parseISODateLocal(editData.end_date) : formData.end_date;
    const baseWeeks = buildWeeksRange(baseStart, baseEnd);

    // Also include any week keys from hydrated occurrence slots (in case of gaps)
    const extraWeeks = Object.keys(occurrenceSlots || {})
      .map((iso) => parseISODateLocal(iso));

    const merged: Date[] = [...baseWeeks];
    extraWeeks.forEach((ew) => {
      if (!merged.some((bw) => bw.toDateString() === ew.toDateString())) {
        merged.push(ew);
      }
    });

    return merged.sort((a, b) => a.getTime() - b.getTime());
  }, [occurrenceSlots, formData.start_date, formData.end_date, editData]);

  // Drop stale week errors when weeks change or when an entry no longer has validation issues
  useEffect(() => {
    setWeekErrors((prev) => {
      const validWeekSet = new Set(weeks.map((w) => toLocalISODate(w)));
      let changed = false;
      const next = { ...prev };
      Object.entries(next).forEach(([iso, err]) => {
        if (!validWeekSet.has(iso) || !err || !hasValidationErrors(err)) {
          delete next[iso];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [weeks]);

  // Re-validate tracked week errors when slots or dates change to drop stale issues
  useEffect(() => {
    setWeekErrors((prev) => {
      let changed = false;
      const next = { ...prev };

      Object.entries(prev).forEach(([iso, err]) => {
        const weekSlots = occurrenceSlots[iso];
        if (!weekSlots) {
          delete next[iso];
          changed = true;
          return;
        }
        const clampedWeekSlots = clampWeekSlotsToRange(
          weekSlots,
          formData.start_date,
          formData.end_date
        );
        const weekForm: AvailabilityFormData = {
          start_date: formData.start_date,
          end_date: formData.end_date,
          slots: clampedWeekSlots,
        };
        const validated = validateAvailabilityForm(weekForm);
        const filtered: AvailabilityValidationErrors = {};
        if (validated.slots) filtered.slots = validated.slots;
        if (validated.overlap) filtered.overlap = validated.overlap;

        if (hasValidationErrors(filtered)) {
          next[iso] = filtered;
        } else {
          delete next[iso];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [formData.end_date, formData.start_date, occurrenceSlots]);

  // Pull fresh occurrences when opening in edit mode
  useEffect(() => {
    if (open && isEditMode && editData) {
      refetchOccurrences();
      setAwaitingOccurrences(true);
    }
  }, [open, isEditMode, editData, refetchOccurrences]);

  // Clear dirty flag whenever modal is opened fresh
  useEffect(() => {
    if (open) {
      if (!isEditMode) {
        setFormData(getInitialFormData(defaultScheduleMode));
        setOccurrenceSlots({});
        resetDatesRef.current = true;
        setAddResetKey((prev) => prev + 1);
      } else if (editData) {
        setFormData({
          start_date: parseISODateLocal(editData.start_date),
          end_date: parseISODateLocal(editData.end_date),
          slots: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] },
        });
        setOccurrenceSlots({});
        setEditHydrated(false);
        setAwaitingOccurrences(true);
      }
      setIsRecurring(!isEditMode && defaultScheduleMode !== 'single');
      setScheduleMode(defaultScheduleMode);
      setRepeatsWeekly(Boolean(isEditMode && editData?.repeats_weekly));
      setHasUserChanges(false);
      setWeekInitialized(false);
      setCustomizedWeeks(new Set());
      setPendingDateRange(null);
      setShowDateChangeConfirm(false);
      setUsePreservedSlots(false);
      setPreservedSlotsForRange(null);
      setErrors({});
      setWeekErrors({});
      setDuplicateError(null);
      setShowRecurringConfirm(false);
      setCurrentWeekIndex(0);
      setPendingFocusTarget(null);
    }
  }, [defaultScheduleMode, editData, isEditMode, open]);

  useEffect(() => {
    if (!open) return;
    const fetchDefaultCapacity = async () => {
      try {
        const { data, error } = await getDefaultGroupCapacity();
        if (error) {
          console.error('Failed to load default group capacity', error);
          return;
        }
        if (typeof data === 'number' && data > 0) {
          setDefaultGroupCapacity(data);
        }
      } catch (err) {
        console.error('Failed to load default group capacity', err);
      }
    };
    fetchDefaultCapacity();
  }, [open]);

  // Reset form when modal opens or when occurrence data changes
  useEffect(() => {
    if (!open) return;
    // Do not overwrite local edits while user is typing
    if (isEditMode && hasUserChanges) return;
    // In edit mode, hydrate only once per open after data arrives
    if (isEditMode && editHydrated) return;
    // Wait for occurrences query to resolve in edit mode to avoid stale data
    if (isEditMode && (!occurrencesFetched || occurrencesFetching)) return;

    const sourceOccurrences: SlotOccurrence[] =
      (occurrencesData && occurrencesData.length ? occurrencesData : ((editData as any)?.occurrences ?? []));

    const filteredOccurrences = sourceOccurrences.filter((occ) => {
      if (!editData?.start_date || !editData?.end_date) return false;
      return (
        occ.occurrence_date >= editData.start_date &&
        occ.occurrence_date <= editData.end_date
      );
    });

    const hasOccurrences = filteredOccurrences.length > 0;
    const occurrencesStart = hasOccurrences
      ? parseISODateLocal(
          filteredOccurrences.reduce((min, occ) => (occ.occurrence_date < min ? occ.occurrence_date : min), filteredOccurrences[0].occurrence_date)
        )
      : null;
    const occurrencesEnd = hasOccurrences
      ? parseISODateLocal(
          filteredOccurrences.reduce((max, occ) => (occ.occurrence_date > max ? occ.occurrence_date : max), filteredOccurrences[0].occurrence_date)
        )
      : null;

    const resetDefaults = !isEditMode && resetDatesRef.current;
    const freshDefaults = resetDefaults ? getInitialFormData(defaultScheduleMode) : null;
    const effectiveStart = isEditMode && editData
      ? parseISODateLocal(editData.start_date)
      : occurrencesStart || freshDefaults?.start_date || formData.start_date;
    const effectiveEnd = isEditMode && editData
      ? parseISODateLocal(editData.end_date)
      : occurrencesEnd || freshDefaults?.end_date || formData.end_date;
    const currentWeeks = buildWeeksRange(effectiveStart, effectiveEnd);

    let byWeek: Record<string, Record<DayOfWeek, SlotFormData[]>> = {};

    if (isEditMode && editData) {
      // Use occurrences if available, else fall back to repeating slots replicated per week
      if (filteredOccurrences && filteredOccurrences.length > 0) {
        byWeek = buildWeekSlotsFromOccurrences(filteredOccurrences, defaultGroupCapacity);

        // Ensure each day has at least one row to allow adding new slots
        currentWeeks.forEach((ws) => {
          const weekISO = toLocalISODate(ws);
          const weekSlots = byWeek[weekISO] || { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as any;
          for (let i = 1; i <= 7; i++) {
            const daySlots = weekSlots[i as DayOfWeek] || [];
            if (daySlots.length === 0) {
              const dayDate = new Date(ws);
              dayDate.setDate(dayDate.getDate() + (i - 1));
              const occDate = toLocalISODate(dayDate);
              weekSlots[i as DayOfWeek] = [
                {
                  ...DEFAULT_SLOT,
                  day_of_week: i as DayOfWeek,
                  is_enabled: false,
                  occurrence_date: occDate,
                },
              ];
            }
          }
          byWeek[weekISO] = weekSlots;
        });

        setOccurrenceSlots(byWeek);
        setFormData({
          start_date: effectiveStart,
          end_date: effectiveEnd,
          slots: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] },
        });
        setEditHydrated(true);
        setAwaitingOccurrences(false);
        if (!weekInitialized) {
          setCurrentWeekIndex(0);
          setWeekInitialized(true);
        }
        setErrors({});
        setWeekErrors({});
        return; // short-circuit to avoid seeding defaults over fetched data
      } else {
        // replicate editData slots into each week (prefer weekly_slots if present)
        const editSlots = Array.isArray((editData as any)?.weekly_slots)
          ? (editData as any).weekly_slots
          : Array.isArray(editData.slots)
            ? editData.slots
            : [];
        currentWeeks.forEach((ws) => {
          const weekISO = toLocalISODate(ws);
          byWeek[weekISO] = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as any;
          editSlots.forEach((slot) => {
            const dayOffset = slot.day_of_week - 1;
            const dayDate = new Date(ws);
            dayDate.setDate(dayDate.getDate() + dayOffset);
            const occDate = toLocalISODate(dayDate);
            byWeek[weekISO][slot.day_of_week].push({
              day_of_week: slot.day_of_week,
              is_enabled: slot.is_enabled,
              session_name: slot.session_name,
              price: slot.price,
              duration_minutes: slot.duration_minutes,
              start_time: normalizeTimeFormat(slot.start_time),
              end_time: normalizeTimeFormat(slot.end_time),
              session_type: slot.session_type,
              location: slot.location,
              pillar_slot: slot.pillar_slot ?? '',
              occurrence_date: occDate,
              max_bookings_per_slot: typeof (slot as any).max_bookings_per_slot === 'number'
                ? (slot as any).max_bookings_per_slot
                : (slot.session_type === SESSION_TYPE_DB.GROUP ? defaultGroupCapacity : 1),
            });
          });
        });
      }

      // Ensure each day has at least one row to allow adding new slots
      currentWeeks.forEach((ws) => {
        const weekISO = toLocalISODate(ws);
        const weekSlots = byWeek[weekISO] || { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as any;
        for (let i = 1; i <= 7; i++) {
          const daySlots = weekSlots[i as DayOfWeek] || [];
          if (daySlots.length === 0) {
            const dayDate = new Date(ws);
            dayDate.setDate(dayDate.getDate() + (i - 1));
            const occDate = toLocalISODate(dayDate);
            weekSlots[i as DayOfWeek] = [
              {
                ...DEFAULT_SLOT,
                day_of_week: i as DayOfWeek,
                is_enabled: false,
                occurrence_date: occDate,
                max_bookings_per_slot: DEFAULT_SLOT.max_bookings_per_slot,
              },
            ];
          }
        }
        byWeek[weekISO] = weekSlots;
      });

      const clamped = clampSlotsToRange(byWeek, effectiveStart, effectiveEnd);
      setOccurrenceSlots(clamped);
      setFormData({
        start_date: effectiveStart,
        end_date: effectiveEnd,
        slots: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] },
      });
      setEditHydrated(true);
      setAwaitingOccurrences(false);
      if (!weekInitialized) {
        setCurrentWeekIndex(0);
        setWeekInitialized(true);
      }
    } else {
      // New availability: seed each week with default daily slots (all days enabled)
      // If we have preserved slots from a date change, start with them
      if (singleSlotCarryRef.current) {
        byWeek = { ...singleSlotCarryRef.current };
        singleSlotCarryRef.current = null;
      } else if (usePreservedSlots && preservedSlotsForRange) {
        byWeek = { ...preservedSlotsForRange };
      }

      currentWeeks.forEach((ws) => {
        const weekISO = toLocalISODate(ws);
        const existingWeek = byWeek[weekISO] || { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as any;
        // Ensure weekdays seeded; keep preserved rows if present
        for (let i = 1; i <= 7; i++) {
      const daySlots = existingWeek[i as DayOfWeek] || [];
      const dayDate = new Date(ws);
      dayDate.setDate(dayDate.getDate() + (i - 1));
      const occDate = toLocalISODate(dayDate);
      if (daySlots.length === 0) {
        existingWeek[i as DayOfWeek] = [
          {
            ...DEFAULT_SLOT,
            day_of_week: i as DayOfWeek,
            // Days before the start date are hidden in week 1 but still serve as the
            // recurring template, so they start off; otherwise later weeks inherit
            // enabled, unnamed slots the coach can't see and saving fails.
            is_enabled: occDate >= toLocalISODate(effectiveStart),
            pillar_slot: '',
            occurrence_date: occDate,
            max_bookings_per_slot: DEFAULT_SLOT.max_bookings_per_slot,
          },
        ];
      } else {
        // Update occurrence_date to current week for preserved slots
        existingWeek[i as DayOfWeek] = daySlots.map((slot) => {
          const maxBookings = typeof slot.max_bookings_per_slot === 'number'
            ? slot.max_bookings_per_slot
            : (slot.session_type === SESSION_TYPE_DB.GROUP ? defaultGroupCapacity : 1);
          return {
            ...slot,
            day_of_week: i as DayOfWeek,
            occurrence_date: occDate,
            is_enabled: slot.is_enabled,
            max_bookings_per_slot: maxBookings,
          };
        });
      }
        }
        byWeek[weekISO] = existingWeek;
      });
      // Reset preservation flags after applying
      if (usePreservedSlots) {
        setUsePreservedSlots(false);
        setPreservedSlotsForRange(null);
      }
      // For create flow, keep recurring pattern enabled across the whole template;
      // we will drop out-of-range slots right before submitting.
      setOccurrenceSlots(byWeek);
      setFormData({
        start_date: effectiveStart,
        end_date: effectiveEnd,
        slots: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] },
      });
      setEditHydrated(false);
      setAwaitingOccurrences(false);
      if (resetDefaults) {
        resetDatesRef.current = false;
      }
      if (!weekInitialized) {
        setCurrentWeekIndex(0);
        setWeekInitialized(true);
      }
    }

    setErrors({});
    setWeekErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    defaultGroupCapacity,
    editData,
    editHydrated,
    formData.end_date,
    formData.start_date,
    initialFocusDay,
    isEditMode,
    open,
    occurrencesFetched,
    occurrencesFetching,
    occurrencesData,
    preservedSlotsForRange,
    usePreservedSlots,
  ]);

  // Handle date changes
  const getMinStartDate = useCallback(() => {
    if (isEditMode && editData) {
      return parseISODateLocal(editData.start_date);
    }
    return new Date();
  }, [editData, isEditMode]);

  const handleDateChange = useCallback((field: 'start_date' | 'end_date', value: Date) => {
    const minStartDate = getMinStartDate();
    // If user has edits in create mode, defer and confirm before applying
    if (!isEditMode && hasUserChanges) {
      const nextStartRaw = field === 'start_date' ? value : formData.start_date;
      const nextStart = nextStartRaw < minStartDate ? minStartDate : nextStartRaw;
      let nextEnd = field === 'end_date' ? value : formData.end_date;
      if (nextEnd < nextStart) nextEnd = nextStart;
      const minEnd = new Date(nextStart);
      minEnd.setDate(minEnd.getDate() + MIN_RANGE_DAYS);
      if (nextEnd < minEnd) nextEnd = minEnd;
      setPendingDateRange({ start: nextStart, end: nextEnd });
      setShowDateChangeConfirm(true);
      return;
    }

    setFormData((prev) => {
      const rawStart = field === 'start_date' ? value : prev.start_date;
      const nextStart = rawStart < minStartDate ? minStartDate : rawStart;
      let nextEnd = field === 'end_date' ? value : prev.end_date;

      // Ensure end is not before start
      if (nextEnd < nextStart) {
        nextEnd = nextStart;
      }

      // Enforce minimum 1-week span (start + 6 days)
      const minEnd = new Date(nextStart);
      minEnd.setDate(minEnd.getDate() + MIN_RANGE_DAYS);
      if (nextEnd < minEnd) {
        nextEnd = minEnd;
      }

      return { ...prev, start_date: nextStart, end_date: nextEnd };
    });
    setErrors((prev) => ({ ...prev, dateRange: undefined }));
    setDuplicateError(null);
    setCurrentWeekIndex(0);
    setWeekInitialized(false);
    setCustomizedWeeks(new Set());
  }, [formData.end_date, formData.start_date, getMinStartDate, hasUserChanges, isEditMode]);

  const applyDateRange = useCallback((start: Date, end: Date, preserveSlots = false) => {
    const minStartDate = getMinStartDate();
    const nextStartClamped = start < minStartDate ? minStartDate : start;
    const nextEndRaw = end < nextStartClamped ? nextStartClamped : end;

    // Filter existing slots to overlapping weeks if preserving
    if (preserveSlots && !isEditMode) {
      const filtered = filterWeekSlotsWithinRange(occurrenceSlots, nextStartClamped, nextEndRaw);
      setPreservedSlotsForRange(filtered);
      setUsePreservedSlots(true);

      // Keep customized flags only for weeks still in range
      const nextCustomized = new Set<string>();
      customizedWeeks.forEach((iso) => {
        const weekDate = parseISODateLocal(iso);
        if (weekDate >= start && weekDate <= end) {
          nextCustomized.add(iso);
        }
      });
      setCustomizedWeeks(nextCustomized);
    } else {
      setCustomizedWeeks(new Set());
    }

    setFormData((prev) => {
      const nextStart = nextStartClamped;
      let nextEnd = nextEndRaw;
      if (nextEnd < nextStart) {
        nextEnd = nextStart;
      }

      const minEnd = new Date(nextStart);
      minEnd.setDate(minEnd.getDate() + minRangeDays);
      if (nextEnd < minEnd) {
        nextEnd = minEnd;
      }

      return { ...prev, start_date: nextStart, end_date: nextEnd };
    });
    setErrors((prev) => ({ ...prev, dateRange: undefined }));
    setDuplicateError(null);
    setCurrentWeekIndex(0);
    setWeekInitialized(false);
    setPendingDateRange(null);
    setShowDateChangeConfirm(false);
  }, [customizedWeeks, getMinStartDate, isEditMode, minRangeDays, occurrenceSlots]);

  // Carry the coach's single slot over to the newly picked date.
  const applySingleSessionDate = useCallback((date: Date) => {
    const minStartDate = getMinStartDate();
    const nextDate = date < minStartDate ? minStartDate : date;
    const currentSlot = Object.values(occurrenceSlots)
      .flatMap((weekSlots) => Object.values(weekSlots).flat())
      .find((slot) => slot && isDateWithinRange(slot.occurrence_date, formData.start_date, formData.end_date));
    if (currentSlot) {
      const weekISO = toLocalISODate(getWeekStart(nextDate));
      const day = (((nextDate.getDay() + 6) % 7) + 1) as DayOfWeek;
      const week = createEmptyWeekSlots();
      week[day] = [{ ...currentSlot, day_of_week: day, occurrence_date: toLocalISODate(nextDate) }];
      singleSlotCarryRef.current = { [weekISO]: week };
    }
    setFormData((prev) => ({ ...prev, start_date: nextDate, end_date: nextDate }));
    setErrors((prev) => ({ ...prev, dateRange: undefined }));
    setDuplicateError(null);
    setCurrentWeekIndex(0);
    setWeekInitialized(false);
  }, [formData.end_date, formData.start_date, getMinStartDate, occurrenceSlots]);

  const applyScheduleMode = useCallback((mode: ScheduleMode) => {
    const start = formData.start_date;
    const end = addDays(start, INITIAL_RANGE_DAYS[mode]);
    setScheduleMode(mode);
    setIsRecurring(mode !== 'single');
    setHasUserChanges(false);
    setCustomizedWeeks(new Set());
    setPendingDateRange(null);
    setShowDateChangeConfirm(false);
    setFormData((prev) => ({ ...prev, start_date: start, end_date: end }));
    setErrors({});
    setWeekErrors({});
    setDuplicateError(null);
    setCurrentWeekIndex(0);
    setWeekInitialized(false);
  }, [formData.start_date]);

  // Switching type rebuilds the slots, so confirm first when the coach has edits.
  const [pendingScheduleMode, setPendingScheduleMode] = useState<ScheduleMode | null>(null);
  const handleScheduleModeChange = useCallback((mode: ScheduleMode) => {
    if (isEditMode || mode === scheduleMode) return;
    if (hasUserChanges) {
      setPendingScheduleMode(mode);
      return;
    }
    applyScheduleMode(mode);
  }, [applyScheduleMode, hasUserChanges, isEditMode, scheduleMode]);

  const handleRangeChange = useCallback((start: Date, rangeEnd: Date) => {
    if (!isEditMode && isSingleSession) {
      applySingleSessionDate(start);
      return;
    }
    // A weekly repeat only picks its start; its first 8 weeks follow.
    const end = !isEditMode && scheduleMode === 'rolling' ? addDays(start, ROLLING_RANGE_DAYS) : rangeEnd;
    if (!isEditMode && hasUserChanges) {
      setPendingDateRange({ start, end });
      setShowDateChangeConfirm(true);
      return;
    }
    applyDateRange(start, end);
  }, [applyDateRange, applySingleSessionDate, hasUserChanges, isEditMode, isSingleSession, scheduleMode]);

  // Stopping a repeat: the end date can't drop a booked or requested session.
  const rollingEndBounds = useMemo(() => {
    if (!isRollingPeriod || !editData) return null;
    const max = parseISODateLocal(editData.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let min = addDays(parseISODateLocal(editData.start_date), MIN_RANGE_DAYS);
    if (today > min) min = today;
    (occurrencesData || []).forEach((occ) => {
      if (!lockedOccurrenceIds.has(occ.id)) return;
      const date = parseISODateLocal(occ.occurrence_date);
      if (date > min) min = date;
    });
    return { min: min > max ? max : min, max };
  }, [editData, isRollingPeriod, lockedOccurrenceIds, occurrencesData]);

  const handleRepeatingChange = useCallback((repeating: boolean) => {
    setRepeatsWeekly(repeating);
    setHasUserChanges(true);
    if (repeating && editData) {
      setFormData((prev) => ({ ...prev, end_date: parseISODateLocal(editData.end_date) }));
    }
  }, [editData]);

  const handleRollingEndChange = useCallback((date: Date) => {
    if (!rollingEndBounds) return;
    const next = date < rollingEndBounds.min ? rollingEndBounds.min : date > rollingEndBounds.max ? rollingEndBounds.max : date;
    setFormData((prev) => ({ ...prev, end_date: next }));
    setHasUserChanges(true);
  }, [rollingEndBounds]);

  const firstWeekISO = weeks.length ? toLocalISODate(weeks[0]) : '';

  const markWeekCustomized = useCallback((weekISO: string) => {
    setCustomizedWeeks((prev) => {
      if (prev.has(weekISO)) return prev;
      const next = new Set(prev);
      next.add(weekISO);
      return next;
    });
  }, []);

  const applyRecurringTemplate = useCallback(() => {
    if (!firstWeekISO) return;
    setOccurrenceSlots((prev) => {
      const template = prev[firstWeekISO];
      if (!template) return prev;
      let next: Record<string, Record<DayOfWeek, SlotFormData[]>> = { ...prev };
      weeks.forEach((wk, idx) => {
        if (idx === 0) return;
        const targetISO = toLocalISODate(wk);
        next = {
          ...next,
          [targetISO]: applyTemplateToWeek(
            template,
            targetISO,
            prev[targetISO],
            isEditMode,
            lockedOccurrenceIds,
            firstWeekISO,
            true
          ),
        };
      });
      return next;
    });
    setCustomizedWeeks(new Set());
    setHasUserChanges(true);
  }, [firstWeekISO, isEditMode, lockedOccurrenceIds, weeks]);

  const handleEnableRecurring = useCallback(() => {
    const shouldConfirm = customizedWeeks.size > 0 || (hasUserChanges && weeks.length > 1);
    if (shouldConfirm) {
      setShowRecurringConfirm(true);
      return;
    }
    setIsRecurring(true);
    applyRecurringTemplate();
  }, [applyRecurringTemplate, customizedWeeks.size, hasUserChanges, weeks.length]);

  // Clear only this field's error for the specific slot, and also for mirrored weeks when applicable
  const clearWeekFieldError = useCallback((
    weekISO: string,
    dayOfWeek: DayOfWeek,
    slotIndex: number,
    field: keyof SlotFormData
  ) => {
    setWeekErrors((prev) => {
      const next = { ...prev };
      const targetWeeks: string[] = [weekISO];
      if (!isEditMode && isRecurring) {
        weeks.forEach((wk, idx) => {
          const iso = toLocalISODate(wk);
          targetWeeks.push(iso);
        });
      }

      targetWeeks.forEach((iso) => {
        const weekErr = next[iso];
        if (!weekErr || !weekErr.slots?.[dayOfWeek]) return;
        const dayErrors = [...(weekErr.slots[dayOfWeek] as Array<Record<string, string> | null>)];
        const slotErr = (dayErrors[slotIndex] || {}) as Record<string, string>;
        if (!slotErr[field]) return;
        const nextSlotErr = { ...slotErr };
        delete nextSlotErr[field];
        dayErrors[slotIndex] = Object.keys(nextSlotErr).length ? nextSlotErr : null;
        next[iso] = { ...weekErr, slots: { ...weekErr.slots, [dayOfWeek]: dayErrors } };
      });

      return next;
    });
  }, [isEditMode, isRecurring, weeks]);

  useEffect(() => {
    if (currentWeekIndex >= weeks.length) {
      setCurrentWeekIndex(weeks.length ? weeks.length - 1 : 0);
    }
  }, [weeks, currentWeekIndex]);

  const currentWeek = weeks[currentWeekIndex] || null;
  const currentWeekISO = currentWeek ? toLocalISODate(currentWeek) : '';
  const currentWeekErrors = currentWeekISO ? (weekErrors[currentWeekISO] || {}) : {};
  const weekErrorSet = useMemo(() => {
    const set = new Set<string>();
    Object.entries(weekErrors || {}).forEach(([iso, err]) => {
      if (err && hasValidationErrors(err)) {
        set.add(iso);
      }
    });
    return set;
  }, [weekErrors]);
  const hasAnyErrors = useMemo(
    () => Boolean(errors.dateRange || errors.general || weekErrorSet.size > 0),
    [errors.dateRange, errors.general, weekErrorSet]
  );
  const isOccurrencesBusy =
    isEditMode && (awaitingOccurrences || !editHydrated || occurrencesLoading || occurrencesFetching);
  const goToFirstIssue = useCallback(() => {
    setPendingFocusTarget(null);
    let targetIdx = weeks.findIndex((weekDate) => weekErrorSet.has(toLocalISODate(weekDate)));
    if (targetIdx < 0) {
      targetIdx = 0;
    }
    const targetISO = weeks[targetIdx] ? toLocalISODate(weeks[targetIdx]) : '';
    const weekErr = weekErrors[targetISO];
    if (weekErr?.slots) {
      let foundFocus = false;
      const dayKeys = Object.keys(weekErr.slots).map((k) => parseInt(k, 10) as DayOfWeek).sort((a, b) => a - b);
      for (const day of dayKeys) {
        const slotErrs = (weekErr.slots as any)[day] as Array<Record<string, string>> | undefined;
        if (!Array.isArray(slotErrs)) continue;
        for (let i = 0; i < slotErrs.length; i++) {
          const slotErr = slotErrs[i];
          if (slotErr && Object.keys(slotErr).length > 0) {
            const firstField = Object.keys(slotErr)[0] as keyof SlotFormData;
            setPendingFocusTarget({ weekISO: targetISO, day, slotIndex: i, field: firstField });
            foundFocus = true;
            break;
          }
        }
        if (foundFocus) break;
      }
    }
    setCurrentWeekIndex(targetIdx);
    // Nudge the weekly section into view even if we're already on that week
    requestAnimationFrame(() => {
      issueScrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [weekErrorSet, weekErrors, weeks]);

  const onFocusHandled = useCallback(() => setPendingFocusTarget(null), []);
  const onUserChange = useCallback(() => setHasUserChanges(true), []);
  const onClearDuplicateError = useCallback(() => setDuplicateError(null), []);

  const handlePrevWeek = useCallback(() => {
    setHasUserChanges(true);
    setCurrentWeekIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleNextWeek = useCallback(() => {
    setHasUserChanges(true);
    setCurrentWeekIndex((i) => Math.min(weeks.length - 1, i + 1));
  }, [weeks.length]);

  const { handleSubmit, isSubmitting } = useAvailabilitySubmit({
    coachId,
    isEditMode,
    editData,
    existingAvailabilities,
    formData,
    weeks,
    occurrenceSlots,
    enabledSlots: enabledSlotsMemo,
    minRangeDays,
    repeatsWeekly: isEditMode ? repeatsWeekly : scheduleMode === 'rolling',
    onValidationFailure: ({ errors: nextErrors, weekErrors: nextWeekErrors, firstProblemWeekIndex, duplicateError: nextDuplicateError }) => {
      setErrors(nextErrors);
      setWeekErrors(nextWeekErrors);
      if (firstProblemWeekIndex !== null) {
        setCurrentWeekIndex(firstProblemWeekIndex);
      }
      setDuplicateError(nextDuplicateError);
    },
    onSuccess: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex w-[min(1160px,calc(100vw-2rem))] max-w-none max-h-[90dvh] flex-col gap-0 overflow-hidden border border-light-525 bg-light-300 p-0 shadow-overlay sm:rounded-card [&>button]:hidden"
      >
        <div className="flex items-center justify-between border-b border-light-525 p-[25px]">
          <h2 className="flex items-center gap-2 text-card-title text-dark">
            <Calendar className="size-5 flex-none text-primary" strokeWidth={1.5} aria-hidden="true" />
            {isEditMode ? "Edit availability" : "Add availability"}
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex size-[30px] items-center justify-center rounded-control text-dark-300 transition-colors hover:bg-light-400 hover:text-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label="Close"
          >
            <X className="size-5" strokeWidth={1.5} />
          </button>
        </div>

        <div
          key={isEditMode ? 'edit' : `add-${addResetKey}`}
          className="flex flex-1 flex-col gap-5 overflow-y-auto overflow-x-auto px-[25px] py-5"
        >
          <DateRangeHeader
            formData={formData}
            isEditMode={isEditMode}
            isRecurring={isRecurring}
            scheduleMode={isSingleSession ? 'single' : isRollingPeriod || (!isEditMode && scheduleMode === 'rolling') ? 'rolling' : 'repeating'}
            onScheduleModeChange={handleScheduleModeChange}
            minDays={minRangeDays}
            minStartDate={getMinStartDate()}
            pendingDateRange={pendingDateRange}
            showDateChangeConfirm={showDateChangeConfirm}
            onRangeChange={handleRangeChange}
            onRecurringToggle={(checked) => {
              if (checked) {
                handleEnableRecurring();
                return;
              }
              setIsRecurring(false);
            }}
            onConfirmDateChange={() => {
              if (pendingDateRange) {
                applyDateRange(pendingDateRange.start, pendingDateRange.end, true);
              }
            }}
            onCancelDateChange={() => {
              setPendingDateRange(null);
              setShowDateChangeConfirm(false);
            }}
            rollingEdit={rollingEndBounds ? {
              repeating: repeatsWeekly,
              onRepeatingChange: handleRepeatingChange,
              endDate: formData.end_date,
              minEndDate: rollingEndBounds.min,
              maxEndDate: rollingEndBounds.max,
              onEndDateChange: handleRollingEndChange,
            } : null}
          />

          {hasAnyErrors && (
            <Alert variant="destructive" className={errorAlertClass}>
              <AlertCircle className="size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <p className="text-label-sm text-error-700">
                  Availability incomplete. Finish the highlighted days before saving.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToFirstIssue}
                  className="w-fit"
                >
                  Review
                </Button>
              </div>
            </Alert>
          )}
          {duplicateError && (
            <Alert variant="destructive" className={errorAlertClass}>
              <AlertCircle className="size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
              <AlertDescription className="text-label-sm text-error-700">
                {duplicateError}
              </AlertDescription>
            </Alert>
          )}
          {errors.dateRange && (
            <p className="text-caption text-error-700">{errors.dateRange}</p>
          )}
          {errors.general && (
            <p className="text-caption text-error-700">{errors.general}</p>
          )}
          {/* Weekly Time Slots Section - with scrollable table */}
          <WeeklySlotsTable
            weeks={weeks}
            currentWeekIndex={currentWeekIndex}
            occurrenceSlots={occurrenceSlots}
            setOccurrenceSlots={setOccurrenceSlots}
            currentWeekErrors={currentWeekErrors}
            weekErrorSet={weekErrorSet}
            isRecurring={isRecurring}
            isEditMode={isEditMode}
            singleSlot={isSingleSession}
            formStartDate={formData.start_date}
            formEndDate={formData.end_date}
            lockedOccurrenceIds={lockedOccurrenceIds}
            sportPillars={sportPillars || []}
            defaultGroupCapacity={defaultGroupCapacity}
            isOccurrencesBusy={isOccurrencesBusy}
            pendingFocusTarget={pendingFocusTarget}
            onFocusHandled={onFocusHandled}
            onPrevWeek={handlePrevWeek}
            onNextWeek={handleNextWeek}
            onUserChange={onUserChange}
            onClearDuplicateError={onClearDuplicateError}
            markWeekCustomized={markWeekCustomized}
            clearWeekFieldError={clearWeekFieldError}
            scrollRef={issueScrollRef}
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-light-525 px-[25px] py-5">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || isOccurrencesBusy}
          >
            {isSubmitting ? 'Saving…' : 'Save availability'}
          </Button>
        </div>
      </DialogContent>
      <ConfirmationDialog
        open={pendingScheduleMode !== null}
        onOpenChange={(openState) => {
          if (!openState) setPendingScheduleMode(null);
        }}
        title="Switch schedule type?"
        description="Your current slot changes will be reset."
        confirmLabel="Switch"
        contentClassName="max-w-md"
        onConfirm={() => {
          if (pendingScheduleMode) applyScheduleMode(pendingScheduleMode);
          setPendingScheduleMode(null);
        }}
      />
      <ConfirmationDialog
        open={showRecurringConfirm}
        onOpenChange={setShowRecurringConfirm}
        title="Turn on recurring?"
        description="Changes made in the current week will be applied to all future and past weeks. Existing slots with values will remain unchanged."
        confirmLabel="Apply recurring"
        contentClassName="max-w-md"
        onConfirm={() => {
          setShowRecurringConfirm(false);
          setIsRecurring(true);
          applyRecurringTemplate();
        }}
      />
    </Dialog>
  );
};
