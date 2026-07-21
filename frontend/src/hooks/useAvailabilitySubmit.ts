/**
 * useAvailabilitySubmit
 * Submit/mutation flow extracted verbatim from ManageAvailabilityModal:
 * validation → duplicate/overlap checks → supabase write + occurrence upsert
 * (+ create-mode rollback on failure).
 */

import { useState, useCallback, useMemo } from 'react';
import {
  validateAvailabilityForm,
  hasValidationErrors,
  generateErrorMessage,
  normalizeTimeFormat,
} from '@/utils/availabilityValidation';
import { DAY_OF_WEEK_MAP } from '@/types/availability';
import type {
  AvailabilityFormData,
  SlotFormData,
  DayOfWeek,
  AvailabilityValidationErrors,
  CoachAvailability,
} from '@/types/availability';
import { useToast } from '@/hooks/use-toast';
import { toLocalISODate } from '@/utils/dateHelpers';
import {
  canonicalizeSlotForm,
  isExactDuplicateAvailability,
  hasCrossPeriodOverlap,
  isDateWithinRange,
  clampWeekSlotsToRange,
} from '@/utils/availabilityModalHelpers';
import { useUpsertOccurrencesEditV3, useUpsertOccurrencesV3 } from '@/hooks/useAvailabilityOccurrences';
import { supabase } from '@/integrations/supabase/client';

const MIN_RANGE_DAYS = 6; // inclusive: start + 6 days = 7-day span

interface UseAvailabilitySubmitArgs {
  coachId: string;
  isEditMode: boolean;
  editData: CoachAvailability | null;
  existingAvailabilities: CoachAvailability[] | null;
  formData: AvailabilityFormData;
  weeks: Date[];
  occurrenceSlots: Record<string, Record<DayOfWeek, SlotFormData[]>>;
  enabledSlots: SlotFormData[];
  onValidationFailure: (r: {
    errors: AvailabilityValidationErrors;
    weekErrors: Record<string, AvailabilityValidationErrors>;
    firstProblemWeekIndex: number | null;
    duplicateError: string | null;
  }) => void;
  onSuccess: () => void;
}

export const useAvailabilitySubmit = ({
  coachId,
  isEditMode,
  editData,
  existingAvailabilities,
  formData,
  weeks,
  occurrenceSlots,
  enabledSlots: enabledSlotsMemo,
  onValidationFailure,
  onSuccess,
}: UseAvailabilitySubmitArgs) => {
  const { toast } = useToast();
  const upsertOccurrences = useUpsertOccurrencesV3();
  const upsertOccurrencesEdit = useUpsertOccurrencesEditV3();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Memoized derived values
  const formStartISO = useMemo(() => toLocalISODate(formData.start_date), [formData.start_date]);
  const formEndISO = useMemo(() => toLocalISODate(formData.end_date), [formData.end_date]);

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
        let firstProblemWeekIndex: number | null = null;
        if (hasWeeklyErrors) {
          const idx = weeks.findIndex((weekDate) => {
            const weekISO = toLocalISODate(weekDate);
            return weeklyValidation[weekISO] && hasValidationErrors(weeklyValidation[weekISO]);
          });
          if (idx >= 0) {
            firstProblemWeekIndex = idx;
          }
        }
        onValidationFailure({
          errors: baseErrors,
          weekErrors: weeklyValidation,
          firstProblemWeekIndex,
          duplicateError: null,
        });

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
        onValidationFailure({
          errors: {},
          weekErrors: {},
          firstProblemWeekIndex: null,
          duplicateError: message,
        });
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
        onValidationFailure({
          errors: {},
          weekErrors: {},
          firstProblemWeekIndex: null,
          duplicateError: message,
        });
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

      onSuccess();
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
  }, [formData, coachId, toast, onSuccess, onValidationFailure, isEditMode, editData, existingAvailabilities, enabledSlotsMemo, formStartISO, formEndISO, weeks, occurrenceSlots, upsertOccurrences, upsertOccurrencesEdit, cleanupExtraOccurrences]);

  return { handleSubmit, isSubmitting };
};
