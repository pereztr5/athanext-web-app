/**
 * Pure helpers extracted from ManageAvailabilityModal.
 * Duplicate detection, overlap detection, week/slot range math, and
 * occurrence-to-week-slot hydration.
 */

import { normalizeTimeFormat } from '@/utils/availabilityValidation';
import {
  getWeekStart,
  getTodayISODate,
  parseISODateLocal,
  toLocalISODate,
} from '@/utils/dateHelpers';
import { SESSION_TYPE_DB } from '@/types/sessions-api';
import type {
  SlotFormData,
  DayOfWeek,
  CoachAvailability,
} from '@/types/availability';
import type { SlotOccurrence } from '@/types/availabilityWithOccurrences';

export const DEFAULT_SLOT: SlotFormData = {
  day_of_week: 1,
  is_enabled: false,
  session_name: '',
  price: 50,
  duration_minutes: 60,
  start_time: '10:00',
  end_time: '11:00',
  session_type: 'individual',
  location: 'in-person',
  pillar_slot: '', // Added default field for pillar_slot
  max_bookings_per_slot: 1,
};

// Canonicalizers and helpers for duplicate detection
// Duplicate detection should ignore names and other attributes.
// It focuses on date range + enabled time slots (day + start/end times).
export const canonicalizeSlotForm = (s: SlotFormData): string => (
  [
    s.day_of_week,
    s.occurrence_date || '',
    normalizeTimeFormat(s.start_time),
    normalizeTimeFormat(s.end_time),
  ].join('|')
);

export const canonicalizeSlotExisting = (s: CoachAvailability['slots'][number]): string => (
  [
    s.day_of_week,
    normalizeTimeFormat(s.start_time),
    normalizeTimeFormat(s.end_time),
  ].join('|')
);

export const arraysHaveSameSet = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] !== sb[i]) return false;
  }
  return true;
};

export const isExactDuplicateAvailability = (
  formStartISO: string,
  formEndISO: string,
  enabledKeys: string[],
  existing: CoachAvailability[] | undefined,
): boolean => {
  if (!existing || existing.length === 0) return false;
  return existing.some((period) => {
    if (period.start_date !== formStartISO || period.end_date !== formEndISO) return false;
    const slots = Array.isArray(period.slots) ? period.slots : [];
    const existingKeys = slots
      .filter((s) => s.is_enabled)
      .map(canonicalizeSlotExisting);
    return arraysHaveSameSet(enabledKeys, existingKeys);
  });
};

// Helpers for overlap detection across periods
export const timeToMinutes = (t: string): number => {
  const [h, m] = normalizeTimeFormat(t).split(':').map(Number);
  return h * 60 + m;
};

export const slotsOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string): boolean => {
  const aS = timeToMinutes(aStart);
  const aE = timeToMinutes(aEnd);
  const bS = timeToMinutes(bStart);
  const bE = timeToMinutes(bEnd);
  return aS < bE && bS < aE;
};

export const dateRangesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string): boolean => {
  return !(new Date(aEnd) < new Date(bStart) || new Date(bEnd) < new Date(aStart));
};

export const hasCrossPeriodOverlap = (
  formStartISO: string,
  formEndISO: string,
  enabledSlots: SlotFormData[],
  existing: CoachAvailability[] | undefined,
  currentId?: string,
): boolean => {
  if (!existing || existing.length === 0) return false;

  const slotsByDate = new Map<string, { start: string; end: string; availabilityId: string }[]>();

  existing.forEach((period) => {
    if (currentId && period.id === currentId) return;
    if (!dateRangesOverlap(formStartISO, formEndISO, period.start_date, period.end_date)) return;

    const occurrences = (period as any).occurrences as SlotOccurrence[] | undefined;
    if (Array.isArray(occurrences) && occurrences.length > 0) {
      occurrences.forEach((occ) => {
        if (occ.is_enabled === false) return;
        if (!occ.occurrence_date) return;
        const start = normalizeTimeFormat(occ.start_time ?? '');
        const end = normalizeTimeFormat(occ.end_time ?? '');
        if (!start || !end) return;
        const list = slotsByDate.get(occ.occurrence_date) || [];
        list.push({ start, end, availabilityId: period.id });
        slotsByDate.set(occ.occurrence_date, list);
      });
    }
  });

  // Prefer precise overlap detection by concrete date when occurrences are available
  if (slotsByDate.size > 0) {
    const datedSlots = enabledSlots.filter((s) => s.is_enabled && s.occurrence_date);
    for (const slot of datedSlots) {
      const list = slotsByDate.get(slot.occurrence_date!);
      if (!list) continue;
      const sStart = normalizeTimeFormat(slot.start_time);
      const sEnd = normalizeTimeFormat(slot.end_time);
      for (const other of list) {
        if (slotsOverlap(sStart, sEnd, other.start, other.end)) {
          return true;
        }
      }
    }
  }

  // Fallback to weekly pattern check if we did not detect by date (or have no occurrence data)
  return existing.some((period) => {
    if (currentId && period.id === currentId) return false;
    if (!dateRangesOverlap(formStartISO, formEndISO, period.start_date, period.end_date)) return false;

    const existingSlots = Array.isArray(period.slots) ? period.slots : [];
    const enabledExisting = existingSlots.filter((s) => s.is_enabled);
    return enabledExisting.some((eslot) => {
      return enabledSlots.some((fslot) => {
        if (fslot.day_of_week !== eslot.day_of_week) return false;
        return slotsOverlap(fslot.start_time, fslot.end_time, eslot.start_time, eslot.end_time);
      });
    });
  });
};

export const buildWeeksRange = (start: Date, end: Date) => {
  const weeksArr: Date[] = [];
  const endDate = new Date(end);
  const startWeek = getWeekStart(start);
  const cursor = new Date(startWeek);

  while (cursor <= endDate) {
    weeksArr.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }

  return weeksArr;
};
export const isPastOrToday = (iso?: string | null): boolean => {
  if (!iso) return false;
  return iso < toLocalISODate(new Date());
};

export const isDateWithinRange = (iso: string | undefined | null, start: Date, end: Date): boolean => {
  if (!iso) return false;
  const startISO = toLocalISODate(start);
  const endISO = toLocalISODate(end);
  return iso >= startISO && iso <= endISO;
};

export const formatClampedWeekRange = (weekStart: Date, rangeStart: Date, rangeEnd: Date): string => {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const start = weekStart < rangeStart ? rangeStart : weekStart;
  const end = weekEnd > rangeEnd ? rangeEnd : weekEnd;
  const sameYear = start.getFullYear() === end.getFullYear();
  const startOpts: Intl.DateTimeFormatOptions = sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' };
  const endOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${start.toLocaleDateString('en-US', startOpts)} - ${end.toLocaleDateString('en-US', endOpts)}`;
};

export const clampSlotsToRange = (
  slots: Record<string, Record<DayOfWeek, SlotFormData[]>>,
  start: Date,
  end: Date
): Record<string, Record<DayOfWeek, SlotFormData[]>> => {
  const startTime = start.getTime();
  const endTime = end.getTime();
  const next: Record<string, Record<DayOfWeek, SlotFormData[]>> = {};

  Object.entries(slots || {}).forEach(([weekISO, weekSlots]) => {
    const weekCopy: Record<DayOfWeek, SlotFormData[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as any;
    Object.entries(weekSlots || {}).forEach(([dayKey, list]) => {
      const day = parseInt(dayKey, 10) as DayOfWeek;
      weekCopy[day] = (list || []).map((slot) => {
        if (!slot?.occurrence_date) return slot;
        const d = parseISODateLocal(slot.occurrence_date);
        const inRange = d.getTime() >= startTime && d.getTime() <= endTime;
        return inRange ? slot : { ...slot, is_enabled: false };
      });
    });
    next[weekISO] = weekCopy;
  });

  return next;
};

export const createEmptyWeekSlots = () =>
  ({ 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as Record<DayOfWeek, SlotFormData[]>);

export const clampWeekSlotsToRange = (
  weekSlots: Record<DayOfWeek, SlotFormData[]>,
  start: Date,
  end: Date
): Record<DayOfWeek, SlotFormData[]> => {
  const next: Record<DayOfWeek, SlotFormData[]> = createEmptyWeekSlots();
  Object.entries(weekSlots || {}).forEach(([dayKey, list]) => {
    const day = parseInt(dayKey, 10) as DayOfWeek;
    next[day] = (list || []).map((slot) => {
      if (!slot?.occurrence_date) return slot;
      const inRange = isDateWithinRange(slot.occurrence_date, start, end);
      return inRange ? slot : { ...slot, is_enabled: false };
    });
  });
  return next;
};

export const remapWeekFromTemplate = (
  template: Record<DayOfWeek, SlotFormData[]>,
  targetWeekISO: string
): Record<DayOfWeek, SlotFormData[]> => {
  const weekStart = new Date(targetWeekISO + 'T00:00:00');
  const mapped: Record<DayOfWeek, SlotFormData[]> = createEmptyWeekSlots();
  for (let i = 1; i <= 7; i++) {
    const daySlots = template[i as DayOfWeek] || [];
    const dayDate = new Date(weekStart);
    dayDate.setDate(dayDate.getDate() + (i - 1));
    const occDate = toLocalISODate(dayDate);
    mapped[i as DayOfWeek] = daySlots.map((slot) => ({
      ...slot,
      day_of_week: i as DayOfWeek,
      occurrence_date: occDate,
      occurrence_id: undefined,
    }));
  }
  return mapped;
};

export const hasFilledSlotValues = (slot?: SlotFormData | null): boolean => {
  if (!slot) return false;

  const hasSessionName = (slot.session_name || '').trim().length > 0;
  const hasPillar = (slot.pillar_slot || '').trim().length > 0;
  const hasCustomPrice = typeof slot.price === 'number' && slot.price !== DEFAULT_SLOT.price;
  const hasCustomDuration = typeof slot.duration_minutes === 'number' && slot.duration_minutes !== DEFAULT_SLOT.duration_minutes;
  const hasCustomStart = Boolean(slot.start_time) && normalizeTimeFormat(slot.start_time) !== normalizeTimeFormat(DEFAULT_SLOT.start_time);
  const hasCustomEnd = Boolean(slot.end_time) && normalizeTimeFormat(slot.end_time) !== normalizeTimeFormat(DEFAULT_SLOT.end_time);
  const hasCustomType = slot.session_type !== DEFAULT_SLOT.session_type;
  const hasCustomLocation = slot.location !== DEFAULT_SLOT.location;

  return (
    hasSessionName ||
    hasPillar ||
    hasCustomPrice ||
    hasCustomDuration ||
    hasCustomStart ||
    hasCustomEnd ||
    hasCustomType ||
    hasCustomLocation
  );
};

export const applyTemplateToWeek = (
  template: Record<DayOfWeek, SlotFormData[]>,
  targetWeekISO: string,
  existingWeek: Record<DayOfWeek, SlotFormData[]> | undefined,
  preservePast: boolean,
  lockedOccurrenceIds?: Set<string>,
  sourceWeekISO?: string,
  preserveFilledTargetSlots: boolean = false
): Record<DayOfWeek, SlotFormData[]> => {
  const mapped = remapWeekFromTemplate(template, targetWeekISO);
  if ((!preservePast && !preserveFilledTargetSlots) || !existingWeek) return mapped;
  const todayISO = getTodayISODate();
  const next: Record<DayOfWeek, SlotFormData[]> = createEmptyWeekSlots();
  for (let i = 1; i <= 7; i++) {
    const day = i as DayOfWeek;
    const mappedSlots = mapped[day] || [];
    const existingSlots = existingWeek[day] || [];
    const mergedSlots: SlotFormData[] = [];
    const maxLen = Math.max(mappedSlots.length, existingSlots.length);
    for (let idx = 0; idx < maxLen; idx++) {
      const slot = mappedSlots[idx];
      const existingSlot = existingSlots[idx];
      const isBookedOrReserved =
        Boolean(existingSlot?.occurrence_id) &&
        Boolean(lockedOccurrenceIds?.has(existingSlot.occurrence_id as string));
      const isPastSlot = Boolean(existingSlot?.occurrence_date && existingSlot.occurrence_date <= todayISO);
      const isEnabledTargetSlot =
        preservePast &&
        Boolean(existingSlot?.is_enabled) &&
        Boolean(sourceWeekISO) &&
        targetWeekISO !== sourceWeekISO;
      const shouldPreserveFilledTargetSlot =
        preserveFilledTargetSlots &&
        Boolean(existingSlot) &&
        Boolean(sourceWeekISO) &&
        targetWeekISO !== sourceWeekISO &&
        hasFilledSlotValues(existingSlot);

      if (isBookedOrReserved || isPastSlot || isEnabledTargetSlot || shouldPreserveFilledTargetSlot) {
        if (existingSlot) mergedSlots.push(existingSlot);
        continue;
      }

      if (slot) {
        mergedSlots.push(slot);
      }
    }
    next[day] = mergedSlots;
  }
  return next;
};

export const filterWeekSlotsWithinRange = (
  slots: Record<string, Record<DayOfWeek, SlotFormData[]>>,
  start: Date,
  end: Date
): Record<string, Record<DayOfWeek, SlotFormData[]>> => {
  const filtered: Record<string, Record<DayOfWeek, SlotFormData[]>> = {};

  Object.entries(slots || {}).forEach(([weekISO, weekSlots]) => {
    const weekStart = parseISODateLocal(weekISO);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const overlaps = weekStart <= end && weekEnd >= start;
    if (overlaps) {
      filtered[weekISO] = weekSlots;
    }
  });

  return filtered;
};

export const buildWeekSlotsFromOccurrences = (
  occurrences: SlotOccurrence[],
  defaultGroupCapacity: number = 50,
): Record<string, Record<DayOfWeek, SlotFormData[]>> => {
  const byWeek: Record<string, Record<DayOfWeek, SlotFormData[]>> = {};

  occurrences.forEach((occ) => {
    const d = parseISODateLocal(occ.occurrence_date);
    const weekStartISO = toLocalISODate(getWeekStart(d));
    const dow = ((d.getDay() + 6) % 7 + 1) as DayOfWeek;
    if (!byWeek[weekStartISO]) {
      byWeek[weekStartISO] = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as any;
    }
    byWeek[weekStartISO][dow].push({
      day_of_week: dow,
      is_enabled: occ.is_enabled ?? true,
      session_name: occ.session_name ?? DEFAULT_SLOT.session_name,
      price: typeof occ.price === 'number' ? occ.price : DEFAULT_SLOT.price,
      duration_minutes: (occ.duration_minutes as any) ?? DEFAULT_SLOT.duration_minutes,
      start_time: normalizeTimeFormat(occ.start_time ?? DEFAULT_SLOT.start_time),
      end_time: normalizeTimeFormat(occ.end_time ?? DEFAULT_SLOT.end_time),
      session_type: (occ.session_type as any) ?? DEFAULT_SLOT.session_type,
      location: (occ.location as any) ?? DEFAULT_SLOT.location,
      pillar_slot: occ.pillar_slot ?? '',
      occurrence_date: occ.occurrence_date,
      occurrence_id: occ.id,
      max_bookings_per_slot: typeof occ.max_bookings_per_slot === 'number'
        ? occ.max_bookings_per_slot
        : ((occ.session_type as any) === SESSION_TYPE_DB.GROUP ? defaultGroupCapacity : 1),
    });
  });

  return byWeek;
};
