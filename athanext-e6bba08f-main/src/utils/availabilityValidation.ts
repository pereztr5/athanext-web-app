/**
 * Availability Form Validation Utilities
 * Validates coach availability scheduling data
 */

import type {
  AvailabilityFormData,
  AvailabilityValidationErrors,
  SlotFormData,
  SlotValidationError,
  DayOfWeek,
} from '@/types/availability';

/**
 * Parse time string (HH:mm) to minutes since midnight
 */
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Normalize time format - remove any trailing characters or milliseconds
 * Converts "HH:mm:ss" or "HH:mm:ss.sss" to "HH:mm"
 */
export const normalizeTimeFormat = (time: string): string => {
  if (!time) return '';
  // Extract only HH:mm from the time string
  const match = time.match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : time;
};

/**
 * Validate time format (HH:mm)
 */
export const isValidTimeFormat = (time: string): boolean => {
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

/**
 * Validate individual slot
 */
export const validateSlot = (slot: SlotFormData): SlotValidationError => {
  const errors: SlotValidationError = {};

  // Skip validation for disabled slots
  if (!slot.is_enabled) return errors;

  // Session name validation
  if (!slot.session_name?.trim()) {
    errors.session_name = 'Session name is required (e.g., "Morning Training")';
  } else if (slot.session_name.length > 100) {
    errors.session_name = `Session name is too long (${slot.session_name.length}/100 chars)`;
  }

  // Pillar validation
  if (!slot.pillar_slot || !slot.pillar_slot.trim()) {
    errors.pillar_slot = 'Pillar is required';
  }

  // Price validation
  if (slot.price <= 0) {
    errors.price = `Price must be greater than 0 (current: ${slot.price})`;
  } else if (slot.price > 9999.99) {
    errors.price = `Price is too high (max: $9999.99, current: $${slot.price})`;
  }

  // Duration validation
  if (![30, 45, 60, 90, 120, 180].includes(slot.duration_minutes)) {
    errors.duration_minutes = `Duration must be 30, 45, 60, 90, 120, or 180 minutes (current: ${slot.duration_minutes})`;
  }

  // Time format validation with normalized times
  const normalizedStartTime = normalizeTimeFormat(slot.start_time);
  const normalizedEndTime = normalizeTimeFormat(slot.end_time);

  if (!isValidTimeFormat(normalizedStartTime)) {
    errors.start_time = `Invalid start time "${slot.start_time}" - use format HH:mm (e.g., 09:30)`;
  }

  if (!isValidTimeFormat(normalizedEndTime)) {
    errors.end_time = `Invalid end time "${slot.end_time}" - use format HH:mm (e.g., 10:30)`;
  }

  // Time range validation
  if (isValidTimeFormat(normalizedStartTime) && isValidTimeFormat(normalizedEndTime)) {
    const startMinutes = timeToMinutes(normalizedStartTime);
    const endMinutes = timeToMinutes(normalizedEndTime);

    if (endMinutes <= startMinutes) {
      errors.time_range = `End time (${normalizedEndTime}) must be after start time (${normalizedStartTime})`;
    }

    // Validate duration matches time range
    const durationFromRange = endMinutes - startMinutes;
    if (durationFromRange !== slot.duration_minutes) {
      errors.time_range =
        `Duration (${slot.duration_minutes}min) doesn't match time range (${normalizedStartTime} to ${normalizedEndTime} = ${durationFromRange}min)`;
    }
  }

  return errors;
};

/**
 * Validate entire availability form
 */
export const validateAvailabilityForm = (
  formData: AvailabilityFormData
): AvailabilityValidationErrors => {
  const errors: AvailabilityValidationErrors = {};

  // Date range validation
  if (formData.end_date < formData.start_date) {
    errors.dateRange = 'End date must be after start date';
  }

  // At least one enabled slot validation
  const hasEnabledSlots = Object.values(formData.slots).some(
    (slotsForDay) => (slotsForDay || []).some((slot) => slot && slot.is_enabled)
  );

  if (!hasEnabledSlots) {
    errors.general = 'At least one day must be enabled';
  }

  // Validate individual slots
  const slotErrors: Partial<Record<DayOfWeek, Array<SlotValidationError | null>>> = {};
  let hasErrors = false;

  for (const dayNum of [1, 2, 3, 4, 5, 6, 7]) {
    const dayOfWeek = dayNum as DayOfWeek;
    const slots = formData.slots[dayOfWeek] || [];
    const perDayErrors: Array<SlotValidationError | null> = [];
    slots.forEach((slot) => {
      const dayErrors = validateSlot(slot);
      perDayErrors.push(Object.keys(dayErrors).length > 0 ? dayErrors : null);
      if (Object.keys(dayErrors).length > 0) {
        hasErrors = true;
      }
    });
    if (perDayErrors.some((e) => e)) {
      slotErrors[dayOfWeek] = perDayErrors;
    }
  }

  if (hasErrors) {
    errors.slots = slotErrors as any;
  }

  // Check for overlapping slots on the same day
  const overlaps = checkSlotOverlaps(formData.slots);
  if (overlaps.length > 0) {
    errors.overlap = `Overlapping time slots detected on ${overlaps.join(', ')}`;
  }

  return errors;
};

/**
 * Check for overlapping time slots within the same day
 */
export const checkSlotOverlaps = (
  slots: Record<DayOfWeek, Array<SlotFormData>>
): string[] => {
  const overlappingDays: string[] = [];
  const dayNames = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  for (const dayNum of [1, 2, 3, 4, 5, 6, 7]) {
    const dayOfWeek = dayNum as DayOfWeek;
    const daySlots = (slots[dayOfWeek] || []).filter((s) => s && s.is_enabled);
    if (daySlots.length <= 1) continue;

    const sorted = daySlots
      .map((s) => ({
        start: timeToMinutes(normalizeTimeFormat(s.start_time)),
        end: timeToMinutes(normalizeTimeFormat(s.end_time)),
      }))
      .sort((a, b) => a.start - b.start);

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].start < sorted[i - 1].end) {
        overlappingDays.push(dayNames[dayNum - 1]);
        break;
      }
    }
  }

  return overlappingDays;
};

/**
 * Format time display (HH:mm to readable format)
 */
export const formatTime = (time: string): string => {
  if (!isValidTimeFormat(time)) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

/**
 * Calculate end time based on start time and duration
 */
export const calculateEndTime = (startTime: string, durationMinutes: number): string => {
  if (!isValidTimeFormat(startTime)) return '';

  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;

  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;

  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
};

/**
 * Generate user-friendly error summary
 */
export const generateErrorMessage = (errors: AvailabilityValidationErrors): string => {
  const messages: string[] = [];

  if (errors.dateRange) {
    messages.push(`📅 ${errors.dateRange}`);
  }

  if (errors.general) {
    messages.push(`⚠️ ${errors.general}`);
  }

  if (errors.overlap) {
    messages.push(`⏰ ${errors.overlap}`);
  }

  if (errors.slots) {
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const daysWithErrors: string[] = [];

    for (const dayNum of [1, 2, 3, 4, 5, 6, 7]) {
      const dayOfWeek = dayNum as DayOfWeek;
      if (errors.slots[dayOfWeek]) {
        daysWithErrors.push(dayNames[dayNum - 1]);
      }
    }

    if (daysWithErrors.length > 0) {
      messages.push(`❌ Fix errors in: ${daysWithErrors.join(', ')}`);
    }
  }

  return messages.join(' • ');
};

/**
 * Check if form has any errors
 */
export const hasValidationErrors = (errors: AvailabilityValidationErrors): boolean => {
  if (errors.dateRange || errors.overlap) return true;
  if (errors.slots) {
    return Object.values(errors.slots).some((dayErrors) =>
      Array.isArray(dayErrors) ? dayErrors.some((d) => d !== null) : Boolean(dayErrors)
    );
  }
  return false;
};
