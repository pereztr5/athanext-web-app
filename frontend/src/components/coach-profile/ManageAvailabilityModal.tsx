/**
 * ManageAvailabilityModal Component
 * Modal for coaches to add/edit their availability with recurring weekly slots
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { AlertCircle, Clock, X } from 'lucide-react';
import {
  validateAvailabilityForm,
  calculateEndTime,
  hasValidationErrors,
  generateErrorMessage,
  normalizeTimeFormat,
} from '@/utils/availabilityValidation';
import {
  DURATION_OPTIONS,
  DAY_OF_WEEK_MAP,
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
import { useToast } from '@/hooks/use-toast';
import { capitalizeFirst } from '@/utils/helperFunctions';
import { ManageAvailabilityTableHeader } from '@/components/availability/ManageAvailabilityTableHeader';
import { ManageAvailabilityTableRow } from '@/components/availability/ManageAvailabilityTableRow';
import { useCoachDetails } from '@/hooks/useCoachDetails';
import { useSportPillars } from '@/hooks/useSportPillars';
import { useLockedOccurrenceIds } from '@/hooks/useLockedOccurrenceIds';
import { formatWeekRange, parseISODateLocal, toLocalISODate } from '@/utils/dateHelpers';
import {
  DEFAULT_SLOT,
  canonicalizeSlotForm,
  isExactDuplicateAvailability,
  hasCrossPeriodOverlap,
  buildWeeksRange,
  isPastOrToday,
  isDateWithinRange,
  formatClampedWeekRange,
  clampSlotsToRange,
  clampWeekSlotsToRange,
  applyTemplateToWeek,
  filterWeekSlotsWithinRange,
  buildWeekSlotsFromOccurrences,
} from '@/utils/availabilityModalHelpers';
import { DateRangeHeader } from './DateRangeHeader';
import type { Enums } from '@/integrations/supabase/types';
import { useOccurrencesV3, useUpsertOccurrencesEditV3, useUpsertOccurrencesV3 } from '@/hooks/useAvailabilityOccurrences';
import { supabase } from '@/integrations/supabase/client';
import { getDefaultGroupCapacity } from '@/api/configurations';
import type { SlotOccurrence } from '@/types/availabilityWithOccurrences';

interface ManageAvailabilityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coachId: string;
  editData?: CoachAvailability | null;
  initialFocusDay?: DayOfWeek | null;
  existingAvailabilities?: CoachAvailability[] | null;
}


export const ManageAvailabilityModal = ({
  open,
  onOpenChange,
  coachId,
  editData = null,
  initialFocusDay = null,
  existingAvailabilities = null,
}: ManageAvailabilityModalProps) => {
  const { toast } = useToast();
  const upsertOccurrences = useUpsertOccurrencesV3();
  const upsertOccurrencesEdit = useUpsertOccurrencesEditV3();
  const isEditMode = !!editData;
  const { coach } = useCoachDetails(coachId);
  const coachSport = useMemo<Enums<'sport_type'> | undefined>(() => {
    const sportValue = coach?.sport;
    if (!sportValue) return undefined;
    return sportValue.toLowerCase() as Enums<'sport_type'>;
  }, [coach?.sport]);
  const { sportPillars } = useSportPillars({ sport: coachSport, autoFetch: !!coachSport });

  // Initialize form state
  const getInitialFormData = (): AvailabilityFormData => ({
    start_date: new Date(),
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    slots: {
      1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [],
    },
  });

  const [formData, setFormData] = useState<AvailabilityFormData>(() => getInitialFormData());
  const [errors, setErrors] = useState<AvailabilityValidationErrors>({});
  const [weekErrors, setWeekErrors] = useState<Record<string, AvailabilityValidationErrors>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const issueScrollRef = React.useRef<HTMLDivElement | null>(null);
  const resetDatesRef = React.useRef(false);
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
  const focusRegistryRef = React.useRef<Map<string, HTMLElement>>(new Map());
  const [isRecurring, setIsRecurring] = useState(!isEditMode);
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

  // Memoized derived values
  const formStartISO = useMemo(() => toLocalISODate(formData.start_date), [formData.start_date]);
  const formEndISO = useMemo(() => toLocalISODate(formData.end_date), [formData.end_date]);
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
        setFormData(getInitialFormData());
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
      setIsRecurring(!isEditMode);
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
  }, [editData, isEditMode, open]);

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
    const freshDefaults = resetDefaults ? getInitialFormData() : null;
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
      if (usePreservedSlots && preservedSlotsForRange) {
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
            is_enabled: true,
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
    setPendingDateRange(null);
    setShowDateChangeConfirm(false);
  }, [MIN_RANGE_DAYS, customizedWeeks, getMinStartDate, isEditMode, occurrenceSlots]);

  const handleRangeChange = useCallback((start: Date, end: Date) => {
    if (!isEditMode && hasUserChanges) {
      setPendingDateRange({ start, end });
      setShowDateChangeConfirm(true);
      return;
    }
    applyDateRange(start, end);
  }, [applyDateRange, hasUserChanges, isEditMode]);

  const firstWeekISO = weeks.length ? toLocalISODate(weeks[0]) : '';

  const isSlotLockedByBooking = useCallback((slot?: SlotFormData | null): boolean => {
    if (!isEditMode || !slot?.occurrence_id) return false;
    return lockedOccurrenceIds.has(slot.occurrence_id);
  }, [isEditMode, lockedOccurrenceIds]);

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
      setDuplicateError(null);
      setHasUserChanges(true);
    }
  }, [firstWeekISO, isEditMode, isRecurring, isSlotLockedByBooking, lockedOccurrenceIds, markWeekCustomized, weeks]);

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

    // Clear only this field's error for the specific slot, and also for mirrored weeks when applicable
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
    setDuplicateError(null);
    setHasUserChanges(true);
  }, [defaultGroupCapacity, firstWeekISO, isEditMode, isRecurring, isSlotLockedByBooking, lockedOccurrenceIds, markWeekCustomized, weeks]);

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
      setHasUserChanges(true);
    }
  }, [defaultGroupCapacity, firstWeekISO, isEditMode, isRecurring, lockedOccurrenceIds, markWeekCustomized, weeks]);

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
          setPendingFocusTarget(null);
        } else {
          requestAnimationFrame(() => {
            if (document.activeElement === el) {
              setPendingFocusTarget(null);
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
  }, [currentWeekIndex, getFocusKey, pendingFocusTarget]);

  const handlePrevWeek = useCallback(() => {
    setHasUserChanges(true);
    setCurrentWeekIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleNextWeek = useCallback(() => {
    setHasUserChanges(true);
    setCurrentWeekIndex((i) => Math.min(weeks.length - 1, i + 1));
  }, [weeks.length]);

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
      setHasUserChanges(true);
    }
  }, [firstWeekISO, isEditMode, isRecurring, isSlotLockedByBooking, lockedOccurrenceIds, markWeekCustomized, weeks]);

  // Remove any occurrences auto-generated for weeks/dates the coach did not enable
  const cleanupExtraOccurrences = useCallback(
    async (availabilityId: string, allowedSlots: SlotFormData[]) => {
      const allowedKeys = new Set<string>();
      allowedSlots.forEach((slot) => {
        if (!slot.occurrence_date) return;
        const start = normalizeTimeFormat(slot.start_time);
        const end = normalizeTimeFormat(slot.end_time);
        allowedKeys.add(`${slot.occurrence_date}|${start}|${end}`);
      });

      const { data: existing, error: fetchError } = await supabase
        .from('coach_availability_slot_occurrences' as any)
        .select('id, occurrence_date, start_time, end_time')
        .eq('availability_id', availabilityId);

      if (fetchError || !existing) return;

      const toDelete = (existing as any[]).filter((occ) => {
        const key = `${occ.occurrence_date}|${normalizeTimeFormat(occ.start_time)}|${normalizeTimeFormat(occ.end_time)}`;
        return !allowedKeys.has(key);
      }).map((occ) => occ.id);

      if (toDelete.length > 0) {
        await supabase
          .from('coach_availability_slot_occurrences' as any)
          .delete()
          .in('id', toDelete);
      }
    },
    []
  );

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    // Track any newly created availability to roll back on failure
    let newAvailabilityId: string | null = null;
    try {
      setIsSubmitting(true);

      const baseErrors: AvailabilityValidationErrors = {};
      if (formData.end_date < formData.start_date) {
        baseErrors.dateRange = 'End date must be after start date';
      }
      const minEnd = new Date(formData.start_date);
      minEnd.setDate(minEnd.getDate() + MIN_RANGE_DAYS);
      if (formData.end_date < minEnd) {
        baseErrors.dateRange = 'Availability must span at least 7 days';
      }

      const weeklyValidation: Record<string, AvailabilityValidationErrors> = {};
      weeks.forEach((weekDate) => {
        const weekISO = toLocalISODate(weekDate);
        const weekSlots = occurrenceSlots[weekISO] || { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as any;
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
        const weekErrors = validateAvailabilityForm(weekForm);
        const filtered: AvailabilityValidationErrors = {};
        if (weekErrors.slots) filtered.slots = weekErrors.slots;
        if (weekErrors.overlap) filtered.overlap = weekErrors.overlap;
        if (Object.keys(filtered).length > 0) {
          weeklyValidation[weekISO] = filtered;
        }
      });

      const enabledSlots = enabledSlotsMemo.filter((slot) =>
        isDateWithinRange(slot.occurrence_date, formData.start_date, formData.end_date)
      );

      if (enabledSlots.length === 0) {
        baseErrors.general = 'At least one day must be enabled';
      }

      const hasWeeklyErrors = Object.values(weeklyValidation).some((err) => hasValidationErrors(err));
      const hasBaseErrors = Boolean(baseErrors.dateRange || baseErrors.general || hasValidationErrors(baseErrors));

      if (hasBaseErrors || hasWeeklyErrors) {
        setErrors(baseErrors);
        setWeekErrors(weeklyValidation);

        if (hasWeeklyErrors) {
          const firstProblemWeekIndex = weeks.findIndex((weekDate) => {
          const weekISO = toLocalISODate(weekDate);
            return weeklyValidation[weekISO] && hasValidationErrors(weeklyValidation[weekISO]);
          });
          if (firstProblemWeekIndex >= 0) {
            setCurrentWeekIndex(firstProblemWeekIndex);
          }
        }

        const errorDescription = generateErrorMessage(baseErrors);
        toast({
          title: 'Validation Error',
          description: errorDescription || 'Please fix the highlighted errors and try again.',
          variant: 'destructive',
        });

        setIsSubmitting(false);
        return;
      }

      const formKeys = enabledSlots.map(canonicalizeSlotForm);
      const existingToCheck = (existingAvailabilities || []).filter((p) =>
        isEditMode && editData ? p.id !== editData.id : true
      );
      const isExactDuplicate = isExactDuplicateAvailability(
        formStartISO,
        formEndISO,
        formKeys,
        existingToCheck,
      );

      const hasOverlap = hasCrossPeriodOverlap(
        formStartISO,
        formEndISO,
        enabledSlots,
        existingToCheck,
        isEditMode && editData ? editData.id : undefined,
      );

      if (isExactDuplicate) {
        const message = 'Duplicate availability: Same date range and identical time slots already exist. Names can repeat, but time slots must be unique for the selected period.';
        setDuplicateError(message);
        toast({
          title: 'Duplicate Availability',
          description: message,
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      if (hasOverlap) {
        const message = 'Overlapping availability: The selected date range has time slots that overlap with an existing availability. Adjust start/end times to avoid conflicts.';
        setDuplicateError(message);
        toast({
          title: 'Overlapping Availability',
          description: message,
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      if (isEditMode && editData) {
        const { error: updateError } = await supabase
          .from('coach_availability' as any)
          .update({
            start_date: toLocalISODate(formData.start_date),
            end_date: toLocalISODate(formData.end_date),
          })
          .eq('id', editData.id);

        if (updateError) {
          throw updateError;
        }

        await upsertOccurrencesEdit.mutateAsync({
          availabilityId: editData.id,
          slots: enabledSlots,
        });

        await cleanupExtraOccurrences(editData.id, enabledSlots);

        toast({
          title: 'Success',
          description: 'Availability updated successfully',
        });
      } else {
        // Track inserted ID so we can roll back if any downstream step fails
        const { data: inserted, error: insertError } = await supabase
          .from('coach_availability' as any)
          .insert({
            coach_id: coachId,
            start_date: toLocalISODate(formData.start_date),
            end_date: toLocalISODate(formData.end_date),
          })
          .select('id')
          .single();

        if (insertError || !(inserted as any)?.id) {
          throw insertError || new Error('Failed to create availability');
        }

        newAvailabilityId = (inserted as any).id;

        await upsertOccurrences.mutateAsync({
          availabilityId: (inserted as any).id,
          slots: enabledSlots,
        });

        await cleanupExtraOccurrences((inserted as any).id, enabledSlots);

        const enabledDays = enabledSlots
          .map(slot => DAY_OF_WEEK_MAP[slot.day_of_week])
          .filter((day, index, self) => self.indexOf(day) === index)
          .join(', ');
        const dateRange = `${new Date(formData.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(formData.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

        toast({
          title: 'Availability Added Successfully!',
          description: `${enabledSlots.length} session(s) added for ${enabledDays} (${dateRange})`,
        });
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Error creating availability:', error);
      // Roll back newly created availability if occurrences/cleanup fail
      if (!isEditMode && newAvailabilityId) {
        try {
          await supabase.from('coach_availability' as any).delete().eq('id', newAvailabilityId);
        } catch (rollbackErr) {
          console.error('Rollback failed for availability', rollbackErr);
        }
      }
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save availability',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, coachId, toast, onOpenChange, isEditMode, editData, existingAvailabilities, enabledSlotsMemo, formStartISO, formEndISO, weeks, occurrenceSlots, upsertOccurrences, upsertOccurrencesEdit, cleanupExtraOccurrences]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[98vw] max-w-[1400px] max-h-[90vh] overflow-hidden p-0 [&>button]:hidden gap-0 flex flex-col"
      >
        {/* Blue Header */}
        <div className="bg-blue-600 text-white p-3 md:p-4 flex items-center justify-between rounded-t-lg sticky top-0 z-20">
          <h2 className="text-xl font-bold">{isEditMode ? 'Update Availability' : 'Add Availability'}</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-white hover:text-gray-200 text-2xl leading-none"
            aria-label="Close modal"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div
          key={isEditMode ? 'edit' : `add-${addResetKey}`}
          className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto overflow-x-auto flex-1"
        >
          <DateRangeHeader
            formData={formData}
            isEditMode={isEditMode}
            isRecurring={isRecurring}
            minDays={MIN_RANGE_DAYS}
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
          />

          {hasAnyErrors && (
            <Alert variant="destructive" className="bg-red-50 border py-2 border-red-200 flex items-center gap-3 min-h-[55px]">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <div className="flex items-center justify-between gap-3 w-full">
                <p className="text-sm text-red-800 font-medium">
                  Availability incomplete - finish the highlighted days before saving.
                </p>
                <Button variant="outline" size="sm" onClick={goToFirstIssue}>
                  Review
                </Button>
              </div>
            </Alert>
          )}
          {/* Duplicate Error */}
        {duplicateError && (
            <Alert variant="destructive" className="bg-red-50 border py-2 border-red-200 flex items-center gap-3 min-h-[55px]">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <div className="flex items-center justify-between gap-3 w-full">
              <AlertDescription className="text-sm text-red-800 font-medium">
                
                <p>{duplicateError} </p>
                </AlertDescription>
                </div>
            </Alert>
        )}
          {errors.dateRange && (
            <p className="text-xs text-red-600">{errors.dateRange}</p>
          )}
          {errors.general && (
            <p className="text-xs text-red-600">{errors.general}</p>
          )}
          {/* Weekly Time Slots Section - with scrollable table */}
          <div
            className="flex flex-col min-h-[360px] max-h-[65vh]"
            ref={issueScrollRef}
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
                      onClick={handlePrevWeek}
                      disabled={currentWeekIndex === 0}
                      className="text-gray-600 border border-slate-300 rounded-full px-3"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNextWeek}
                      disabled={currentWeekIndex >= weeks.length - 1}
                      className="text-gray-600 border border-slate-300 rounded-full px-3"
                    >
                      Next
                    </Button>
                  </div>
                )}
                <span className="text-sm text-gray-600 flex items-center gap-2 text-left md:text-right">
                  Week {currentWeekIndex + 1} of {Math.max(weeks.length, 1)}{currentWeek ? `: ${formatClampedWeekRange(currentWeek, formData.start_date, formData.end_date)}` : ''}
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
                              formData.start_date,
                              formData.end_date
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
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 md:p-6 border-t bg-gray-50 sticky bottom-0 z-20">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="px-8"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || isOccurrencesBusy}
            className="px-8 bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
      <ConfirmationDialog
        open={showRecurringConfirm}
        onOpenChange={setShowRecurringConfirm}
        title="Turn on recurring?"
        description="Changes made in the current week will be applied to all future and past weeks. Existing slots with values will remain unchanged."
        confirmLabel="Apply Recurring"
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
