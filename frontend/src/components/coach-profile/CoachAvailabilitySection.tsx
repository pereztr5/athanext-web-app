import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ManageAvailabilityModal } from './ManageAvailabilityModal';
import { SlotEditModal } from './SlotEditModal';
import { DeleteConfirmationDialog } from '@/components/common/DeleteConfirmationDialog';
import { AvailabilityTable } from '@/components/availability/AvailabilityTable';
import useCoachAvailabilityWithOccurrences from '@/hooks/useCoachAvailabilityWithOccurrences';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { supabase } from '@/integrations/supabase/client';
import { getDefaultGroupCapacity } from '@/api/configurations';
import { CoachAvailability, CoachAvailabilitySlot, DayOfWeek, SlotBookingStatus } from '@/types/availability';
import type { CoachAvailabilityWithOccurrences } from '@/types/availabilityWithOccurrences';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatWeekRange, getWeekStart, isBookingWindowClosed, parseISODateLocal, toLocalISODate } from '@/utils/dateHelpers';
import { BrandPill } from '@/components/brand';
import { strings } from '@/config/strings';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { PROFILE_TYPE } from "@/utils/db";
import { useFeeConfig } from "@/hooks/useFeeConfig";
import { useReferralWaiver } from "@/hooks/useReferrals";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { timeZoneAbbreviation } from "@/utils/viewerTime";
import { ACTIVE_BOOKING_STATUSES, buildSlotStatusMap, occurrenceToSlot, type SlotBookingRow } from "@/utils/slotBooking";
const parseISODateUtc = (iso: string): Date => parseISODateLocal(iso);
const toISODateUtc = (d: Date): string => toLocalISODate(d);
const getWeekStartUtc = (date: Date): Date => getWeekStart(date);

const formatClampedWeekRangeUtc = (weekStart: Date, rangeStartISO: string, rangeEndISO: string) => {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const rangeStart = parseISODateUtc(rangeStartISO);
  const rangeEnd = parseISODateUtc(rangeEndISO);
  const start = weekStart < rangeStart ? rangeStart : weekStart;
  const end = weekEnd > rangeEnd ? rangeEnd : weekEnd;
  const sameYear = start.getFullYear() === end.getFullYear();
  const startStr = start.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} - ${endStr}`;
};

const formatActualWeekRangeUtc = (isoDates: string[], fallbackStart: Date, rangeStartISO: string, rangeEndISO: string) => {
  if (!isoDates.length) {
    return formatClampedWeekRangeUtc(fallbackStart, rangeStartISO, rangeEndISO);
  }
  const sorted = [...isoDates].sort();
  const start = parseISODateUtc(sorted[0]);
  const end = parseISODateUtc(sorted[sorted.length - 1]);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startStr = start.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} - ${endStr}`;
};

const cardClass = "rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] shadow-none";
const cardBodyClass = "flex flex-col gap-5 px-[25px] pb-[25px] pt-[30px]";
const titleClass = "flex items-center gap-2 text-[20px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]";
const primaryButtonClass =
  "inline-flex h-[34px] items-center justify-center rounded-[8px] border border-[#6698D2] bg-[#0054B4] px-4 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#F1F1E6] transition-colors hover:bg-[#004390]";
const secondaryButtonClass =
  "inline-flex h-[34px] items-center justify-center rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] px-4 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C] transition-colors hover:bg-[#EAEADF] disabled:cursor-not-allowed disabled:opacity-40";
const iconButtonClass =
  "inline-flex size-[30px] items-center justify-center rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] text-[#1A202C] transition-colors hover:bg-[#EAEADF] disabled:cursor-not-allowed disabled:bg-[#F7F7F0] disabled:text-[#A3A6AB]";
const periodChipClass = (active: boolean) =>
  `rounded-[8px] border px-3 py-1.5 text-[12px] font-medium leading-[13px] tracking-[-0.03em] transition-colors ${
    active
      ? "border-transparent bg-[#E5EDF7] text-[#0054B4]"
      : "border-[#EAEADF] bg-[#F7F7F0] text-[#484D56] hover:bg-[#F1F1E6]"
  }`;

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h2 className={titleClass}>
    <Calendar className="size-5 flex-none text-[#0054B4]" strokeWidth={1.5} aria-hidden="true" />
    {children}
  </h2>
);

interface WeekHeaderProps {
  title: string;
  rangeLabel: string;
  weekIndex: number;
  weekCount: number;
  openCount: number | null;
  zoneLabel: string;
  zoneTitle: string;
  onPrevious: () => void;
  onNext: () => void;
}

/** Brand week header: "Week of Mar 9" + viewer time-zone pill, open-slot count and compact week pager. */
const WeekHeader = ({ title, rangeLabel, weekIndex, weekCount, openCount, zoneLabel, zoneTitle, onPrevious, onNext }: WeekHeaderProps) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-center gap-2">
      <Calendar className="size-5 flex-none text-[#0054B4]" strokeWidth={1.5} aria-hidden="true" />
      <h2
        className="text-[20px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]"
        title={rangeLabel || undefined}
      >
        {title}
      </h2>
      <span title={zoneTitle}>
        <BrandPill tone="amber">{zoneLabel}</BrandPill>
      </span>
    </div>
    <div className="flex items-center justify-between gap-3 sm:justify-end">
      {openCount !== null ? (
        <span className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
          {openCount} {openCount === 1 ? "slot" : "slots"} open
        </span>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onPrevious}
          disabled={weekIndex === 0}
          aria-label="Previous week"
          className={iconButtonClass}
        >
          <ChevronLeft className="size-4" strokeWidth={1.5} />
        </button>
        <span
          className="min-w-[40px] text-center text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]"
          aria-live="polite"
        >
          <span className="sr-only">Week </span>
          {weekIndex + 1}
          <span aria-hidden="true"> / </span>
          <span className="sr-only"> of </span>
          {weekCount}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={weekIndex >= weekCount - 1}
          aria-label="Next week"
          className={iconButtonClass}
        >
          <ChevronRight className="size-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  </div>
);

interface CoachAvailabilitySectionProps {
  coachId: string;
  allowEditing?: boolean;
  onBookSlot?: (payload: {
    slot: CoachAvailabilitySlot;
    date: string;
    availabilityId: string;
    weekStart: string;
    occurrenceId: string;
  }) => void;
  iconColor?: string;
}

export const CoachAvailabilitySection = ({
  coachId,
  allowEditing = true,
  onBookSlot,
}: CoachAvailabilitySectionProps) => {
  const viewerTimeZone = useViewerTimeZone();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState<CoachAvailability | CoachAvailabilityWithOccurrences | null>(null);
  const [focusDay, setFocusDay] = useState<DayOfWeek | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetType, setDeleteTargetType] = useState<'period' | 'slot'>('period');
  const [deleteTargetSlotId, setDeleteTargetSlotId] = useState<string | null>(null);
  const [slotEditOpen, setSlotEditOpen] = useState(false);
  const [slotEditData, setSlotEditData] = useState<CoachAvailabilitySlot | null>(null);
  const [slotEditDate, setSlotEditDate] = useState<string | null>(null);
  const [dateRangeStart, setDateRangeStart] = useState<Date | null>(null);
  const [dateRangeEnd, setDateRangeEnd] = useState<Date | null>(null);
  const [hasManualWeekSelection, setHasManualWeekSelection] = useState(false);
  const { platformFeePerc, stripeFeePerc } = useFeeConfig();
  const { data: availabilities, isLoading, error, refetch } = useCoachAvailabilityWithOccurrences(coachId);
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile } = useProfile();
  const canManage = allowEditing;

  const [slotStatusMap, setSlotStatusMap] = useState<Record<string, SlotBookingStatus>>({});
  const [slotStatusError, setSlotStatusError] = useState(false);
  const [slotStatusLoading, setSlotStatusLoading] = useState(true);
  const slotStatusRequestRef = useRef(0);
  const [defaultGroupCapacity, setDefaultGroupCapacity] = useState<number>(50);

  useEffect(() => {
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
  }, []);


  const handleSlotEditClose = (open: boolean) => {
    setSlotEditOpen(open);
    if (!open) {
      setSlotEditData(null);
      setSlotEditDate(null);
      refetch();
    }
  };

  // Sort availabilities by start date (oldest first)
  const sortedAvailabilities = useMemo(() => {
    const todayISO = toISODateUtc(new Date());
    return (availabilities || [])
      .filter(p => p.end_date >= todayISO)
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  }, [availabilities]);

  const deleteTargetPeriod = useMemo(
    () => sortedAvailabilities.find((p) => p.id === deleteTargetId) || null,
    [deleteTargetId, sortedAvailabilities]
  );

  // Select latest period by default
  const selectedPeriod = useMemo(() => {
    if (!sortedAvailabilities.length) return null;
    const selected = sortedAvailabilities.find(p => p.id === selectedPeriodId);
    return selected || sortedAvailabilities[0];
  }, [sortedAvailabilities, selectedPeriodId]);

  useEffect(() => {
    if (!sortedAvailabilities.length) return;

    if (selectedPeriodId && sortedAvailabilities.some((p) => p.id === selectedPeriodId)) {
      return;
    }

    const todayISO = toISODateUtc(new Date());
    const todayUtc = parseISODateUtc(todayISO);

    const coveringToday = sortedAvailabilities.find((p) => {
      const start = parseISODateUtc(p.start_date);
      const end = parseISODateUtc(p.end_date);
      return todayUtc >= start && todayUtc <= end;
    });

    const nextUpcoming = sortedAvailabilities.find((p) => parseISODateUtc(p.start_date) >= todayUtc);

    const target = coveringToday || nextUpcoming || sortedAvailabilities[0];

    if (target?.id && target.id !== selectedPeriodId) {
      setSelectedPeriodId(target.id);
      setCurrentWeekIndex(0); 
    }
  }, [sortedAvailabilities, selectedPeriodId]);

  useEffect(() => {
    setHasManualWeekSelection(false);
  }, [selectedPeriod?.id]);

  // Calculate weeks within selected period
  // Build weeks from occurrences (v3)
  const weeks = useMemo(() => {
    if (!selectedPeriod) return [];
    const seen = new Set<string>();
    const weekList: Date[] = [];
    (selectedPeriod as CoachAvailabilityWithOccurrences).occurrences?.forEach((occ) => {
      const d = parseISODateUtc(occ.occurrence_date);
      const ws = getWeekStartUtc(d);
      const key = toISODateUtc(ws);
      if (!seen.has(key)) {
        seen.add(key);
        weekList.push(ws);
      }
    });
    return weekList.sort((a, b) => a.getTime() - b.getTime());
  }, [selectedPeriod]);

  const currentWeek = weeks[currentWeekIndex] || null;

  // Auto-select the week containing today (or fallback) when weeks change, unless user has manually navigated
  useEffect(() => {
    if (!weeks.length) return;
    if (hasManualWeekSelection) return;

    const todayISO = toISODateUtc(new Date());
    const todayUtc = parseISODateUtc(todayISO);

    const findIndexForDate = (targetDate: Date) =>
      weeks.findIndex((weekStart) => {
        const start = new Date(weekStart);
        const end = new Date(weekStart);
        end.setDate(end.getDate() + 6);
        return targetDate >= start && targetDate <= end;
      });

    let targetIdx = findIndexForDate(todayUtc);

    // If today is not present in this availability, fall back to the first week (Week 1)
    if (targetIdx < 0) targetIdx = 0;

    if (targetIdx >= 0 && targetIdx !== currentWeekIndex) {
      setCurrentWeekIndex(targetIdx);
    }
  }, [weeks, currentWeekIndex, hasManualWeekSelection]);

  const formatRangeWithYear = (startISO: string, endISO: string) => {
    const start = parseISODateLocal(startISO);
    const end = parseISODateLocal(endISO);

    // Single-session periods start and end on the same day.
    if (startISO === endISO) {
      return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    if (start.getFullYear() === end.getFullYear()) {
      const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${startStr} - ${endStr}`;
    }

    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  };

  // A weekly repeat has no end date; its end_date is only how far it's generated (ATH-28).
  const formatPeriodLabel = (period: { start_date: string; end_date: string; repeats_weekly?: boolean }) =>
    period.repeats_weekly
      ? `From ${parseISODateLocal(period.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, repeats weekly`
      : formatRangeWithYear(period.start_date, period.end_date);

  // Resolve weekly overrides for display
  // Resolve slots for the current week using occurrences
  const resolvedWeeklySlots = useMemo(() => {
    if (!selectedPeriod || !currentWeek) return [] as CoachAvailabilitySlot[];
    const weekStartISO = toISODateUtc(currentWeek);
    const weekEnd = new Date(currentWeek);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndISO = toISODateUtc(weekEnd);

    const occs = (selectedPeriod as CoachAvailabilityWithOccurrences).occurrences || [];
    return occs
      .filter((occ) => occ.occurrence_date >= weekStartISO && occ.occurrence_date <= weekEndISO)
      .map(occurrenceToSlot)
      .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));
  }, [selectedPeriod, currentWeek]);

  const bookingMix = useMemo(() => {
    const groups: { label: string; type: 'individual' | 'group'; location: 'online' | 'in-person' }[] = [
      { label: 'Individual · Virtual', type: 'individual', location: 'online' },
      { label: 'Individual · In-person', type: 'individual', location: 'in-person' },
      { label: 'Group · Virtual', type: 'group', location: 'online' },
      { label: 'Group · In-person', type: 'group', location: 'in-person' },
    ];
    return groups
      .map((group) => {
        const slots = resolvedWeeklySlots.filter(
          (slot) => slot.is_enabled && slot.session_type === group.type && slot.location === group.location
        );
        const booked = slots.filter((slot) => (slotStatusMap[slot.id]?.totalCount || 0) > 0).length;
        return { label: group.label, total: slots.length, booked, open: Math.max(0, slots.length - booked) };
      })
      .filter((group) => group.total > 0);
  }, [resolvedWeeklySlots, slotStatusMap]);

  const bookedSlotCount = bookingMix.reduce((sum, group) => sum + group.booked, 0);
  const weeklySlotCount = bookingMix.reduce((sum, group) => sum + group.total, 0);

  const currentWeekRangeLabel = useMemo(() => {
    if (!selectedPeriod || !currentWeek) return '';
    const inRangeDates = (resolvedWeeklySlots || [])
      .map((s) => (s as any).occurrence_date)
      .filter(Boolean) as string[];
    return formatActualWeekRangeUtc(inRangeDates, currentWeek, selectedPeriod.start_date, selectedPeriod.end_date);
  }, [currentWeek, resolvedWeeklySlots, selectedPeriod]);

  const weekTitle = useMemo(() => {
    if (!selectedPeriod || !currentWeek) return '';
    const periodStart = parseISODateUtc(selectedPeriod.start_date);
    const start = currentWeek < periodStart ? periodStart : currentWeek;
    const showYear = start.getFullYear() !== new Date().getFullYear();
    return `Week of ${start.toLocaleDateString('en-US', showYear ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' })}`;
  }, [currentWeek, selectedPeriod]);

  // Open = enabled, not full and still inside the booking window. Hidden until statuses load.
  const openSlotCount = useMemo(() => {
    if (slotStatusLoading || slotStatusError) return null;
    return resolvedWeeklySlots.filter(
      (slot) =>
        slot.is_enabled &&
        !slotStatusMap[slot.id]?.isFull &&
        !isBookingWindowClosed(slot.occurrence_date, slot.start_time)
    ).length;
  }, [resolvedWeeklySlots, slotStatusMap, slotStatusLoading, slotStatusError]);

  // Handlers
  const handleEdit = (period: CoachAvailability, dayToFocus?: DayOfWeek) => {
    setEditData(period);
    setFocusDay(dayToFocus ?? null);
    setIsModalOpen(true);
  };

  const handleSlotEdit = (slot: CoachAvailabilitySlot) => {
    if (!currentWeek) return;
    const dateForDay = new Date(currentWeek);
    const offset = slot.day_of_week - 1;
    dateForDay.setDate(dateForDay.getDate() + offset);
    const concreteDate = (slot as any).occurrence_date || toISODateUtc(dateForDay);
    setSlotEditData(slot);
    setSlotEditDate(concreteDate);
    setSlotEditOpen(true);
  };

  const handleBookSlot = (slot: CoachAvailabilitySlot) => {
    if (!selectedPeriod || !currentWeek || !onBookSlot) return;
    // slot.id is occurrence_id in v3 mapping above
    const dateForDay = new Date(currentWeek);
    const offset = slot.day_of_week - 1;
    dateForDay.setDate(dateForDay.getDate() + offset);
    const concreteDate = toISODateUtc(dateForDay);
    onBookSlot({
      slot,
      date: concreteDate,
      availabilityId: selectedPeriod.id,
      weekStart: toISODateUtc(currentWeek),
      occurrenceId: slot.id,
    });
  };

  const currentSlots = useMemo(
    () => resolvedWeeklySlots.filter((s) => s?.id),
    [resolvedWeeklySlots]
  );

  const athleteProfileId = useMemo(() => {
    if (profile?.type === PROFILE_TYPE.athlete && profile?.data) {
      return (profile.data as any).id;
    }
    return null;
  }, [profile]);

  // Fee display (incl. the existing-client waiver) only applies in athlete booking mode.
  const { waived: referralWaived } = useReferralWaiver(
    onBookSlot ? athleteProfileId ?? undefined : undefined,
    onBookSlot ? coachId : undefined
  );

  // Compute booking state for each slot (full, booked by user, pending payment)
  useEffect(() => {
    const slotIds = currentSlots.map((s) => s.id);

    if (!slotIds.length) {
      slotStatusRequestRef.current += 1;
      setSlotStatusMap({});
      setSlotStatusError(false);
      setSlotStatusLoading(false);
      return;
    }

    const fetchStatuses = async () => {
      const requestId = slotStatusRequestRef.current + 1;
      slotStatusRequestRef.current = requestId;
      setSlotStatusLoading(true);
      try {
        const { data, error } = await supabase
          .from('coach_slot_bookings' as any)
          .select('occurrence_id, athlete_id, status')
          .in('occurrence_id', slotIds)
          .in('status', ACTIVE_BOOKING_STATUSES);

        if (requestId !== slotStatusRequestRef.current) return;

        if (error) {
          console.error('Failed to load slot booking status', error);
          setSlotStatusMap({});
          setSlotStatusError(true);
          return;
        }
        setSlotStatusError(false);

        const statusMap = buildSlotStatusMap(
          currentSlots,
          (data as unknown as SlotBookingRow[]) || [],
          defaultGroupCapacity,
          athleteProfileId || user?.id
        );

        setSlotStatusMap(statusMap);
      } catch (err) {
        if (requestId !== slotStatusRequestRef.current) return;
        console.error('Failed to load slot booking status', err);
        setSlotStatusMap({});
        setSlotStatusError(true);
      } finally {
        if (requestId === slotStatusRequestRef.current) {
          setSlotStatusLoading(false);
        }
      }
    };

    fetchStatuses();
  }, [currentSlots, defaultGroupCapacity, athleteProfileId, user?.id]);

  const handleDeletePeriod = (periodId: string) => {
    setDeleteTargetId(periodId);
    setDeleteTargetType('period');
    setDeleteConfirmOpen(true);
  };

  const handleDeleteSlot = (slot: CoachAvailabilitySlot) => {
    setDeleteTargetSlotId(slot.id);
    setDeleteTargetType('slot');
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteTargetType === 'slot' && deleteTargetSlotId) {
      try {
        const booked = slotStatusMap[deleteTargetSlotId]?.totalCount ?? 0;
        if (booked > 0) {
          toast({
            title: 'Cannot delete slot',
            description: 'This slot already has a booking. Cancel it first.',
            variant: 'destructive',
          });
          return;
        }
        const { error: slotError } = await supabase
          .from('coach_availability_slot_occurrences' as any)
          .delete()
          .eq('id', deleteTargetSlotId);
        if (slotError) throw slotError;
        toast({ title: 'Slot deleted', description: 'The time slot was removed.' });
        refetch();
      } catch (err: any) {
        toast({
          title: 'Delete failed',
          description: err?.message || 'Could not delete this slot',
          variant: 'destructive',
        });
      } finally {
        setDeleteConfirmOpen(false);
        setDeleteTargetId(null);
        setDeleteTargetSlotId(null);
      }
      return;
    }

    if (deleteTargetType !== 'period' || !deleteTargetId) {
      setDeleteConfirmOpen(false);
      setDeleteTargetId(null);
      setDeleteTargetSlotId(null);
      return;
    }

    try {
      const { count, error: countError } = await supabase
        .from('coach_slot_bookings' as any)
        .select('id', { count: 'exact', head: true })
        .eq('availability_id', deleteTargetId)
        .in('status', ['requested', 'pending_payment', 'booked', 'completed']);

      if (countError) throw countError;

      if ((count || 0) > 0) {
        toast({
          title: 'Cannot delete availability',
          description: 'There are active bookings for this period. Cancel them first.',
          variant: 'destructive',
        });
        return;
      }

      await supabase
        .from('coach_availability_slot_occurrences' as any)
        .delete()
        .eq('availability_id', deleteTargetId);

      await supabase
        .from('coach_availability_weekly_slots' as any)
        .delete()
        .eq('availability_id', deleteTargetId);

      const { error: delAvailError } = await supabase
        .from('coach_availability' as any)
        .delete()
        .eq('id', deleteTargetId);

      if (delAvailError) throw delAvailError;

      toast({
        title: 'Availability deleted',
        description: 'The availability period was removed successfully.',
      });
      refetch();
    } catch (err: any) {
      toast({
        title: 'Delete failed',
        description: err?.message || 'Could not delete availability',
        variant: 'destructive',
      });
    } finally {
      setDeleteConfirmOpen(false);
      setDeleteTargetId(null);
      setDeleteTargetSlotId(null);
    }
  };

  const handleModalClose = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setEditData(null);
      setFocusDay(null);
      refetch();
    }
  };

  const handlePreviousWeek = () => {
    if (currentWeekIndex > 0) {
      setCurrentWeekIndex(currentWeekIndex - 1);
      setHasManualWeekSelection(true);
    }
  };

  const handleNextWeek = () => {
    if (currentWeekIndex < weeks.length - 1) {
      setCurrentWeekIndex(currentWeekIndex + 1);
      setHasManualWeekSelection(true);
    }
  };

  // Handle date range selection to jump to specific week
  const handleDateRangeChange = (start: Date, end: Date) => {
    setDateRangeStart(start);
    setDateRangeEnd(end);

    if (!selectedPeriod || weeks.length === 0) return;

    // Find the availability period that contains this date range
    const periodStart = parseISODateUtc(selectedPeriod.start_date);
    const periodEnd = parseISODateUtc(selectedPeriod.end_date);

    // Check if selected range overlaps with current period
    if (start > periodEnd || end < periodStart) {
      // Try to find a different period that contains this range
      const matchingPeriod = sortedAvailabilities.find((period) => {
        const pStart = parseISODateUtc(period.start_date);
        const pEnd = parseISODateUtc(period.end_date);
        return start >= pStart && start <= pEnd;
      });

      if (matchingPeriod) {
        setSelectedPeriodId(matchingPeriod.id);
        // Wait for period change to trigger, then find the week
        setTimeout(() => {
          const weekIdx = weeks.findIndex((week) => {
            const weekStartISO = toISODateUtc(week);
            const weekEndDate = new Date(week);
            weekEndDate.setDate(weekEndDate.getDate() + 6);
            const weekEndISO = toISODateUtc(weekEndDate);
            const startISO = toISODateUtc(start);
            return startISO >= weekStartISO && startISO <= weekEndISO;
          });
          if (weekIdx >= 0) {
            setCurrentWeekIndex(weekIdx);
          }
        }, 100);
        return;
      }

      toast({
        title: 'Date range not found',
        description: 'No availability period contains the selected date range.',
        variant: 'destructive',
      });
      return;
    }

    // Find the week that contains the start date
    const weekIdx = weeks.findIndex((week) => {
      const weekStartISO = toISODateUtc(week);
      const weekEndDate = new Date(week);
      weekEndDate.setDate(weekEndDate.getDate() + 6);
      const weekEndISO = toISODateUtc(weekEndDate);
      const startISO = toISODateUtc(start);
      return startISO >= weekStartISO && startISO <= weekEndISO;
    });

    if (weekIdx >= 0) {
      setCurrentWeekIndex(weekIdx);
      setHasManualWeekSelection(true);
      toast({
        title: 'Week found',
        description: `Navigated to week ${weekIdx + 1} of ${weeks.length}`,
      });
    } else {
      toast({
        title: 'Week not found',
        description: 'The selected date is outside the current availability period.',
        variant: 'destructive',
      });
    }
  };

  // Initialize date range when period or week changes
  useEffect(() => {
    if (selectedPeriod && currentWeek) {
      const weekStart = new Date(currentWeek);
      const weekEnd = new Date(currentWeek);
      weekEnd.setDate(weekEnd.getDate() + 6);
      setDateRangeStart(weekStart);
      setDateRangeEnd(weekEnd);
    }
  }, [selectedPeriod?.id, currentWeek]);

  if (error) {
    return (
      <Card className={cardClass}>
        <CardContent className={cardBodyClass}>
          <SectionTitle>Availability</SectionTitle>
          <Alert variant="destructive" className="rounded-[8px] border-[#F5C2C2] bg-[#FDF1F1] text-[#B42318]">
            <AlertDescription className="text-[14px] leading-[18px] tracking-[-0.03em]">
              Couldn't load availability. Please try again later.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={cardClass}>
        <CardContent className={cardBodyClass}>
          <SectionTitle>Availability</SectionTitle>
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[50px] w-full rounded-[8px] bg-[#F1F1E6]" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const weekHeader = selectedPeriod && currentWeek ? (
    <WeekHeader
      title={weekTitle}
      rangeLabel={currentWeekRangeLabel.replace(" - ", " – ")}
      weekIndex={currentWeekIndex}
      weekCount={weeks.length}
      openCount={openSlotCount}
      zoneLabel={timeZoneAbbreviation(viewerTimeZone, weeks[currentWeekIndex] ?? new Date())}
      zoneTitle={`Times shown in ${viewerTimeZone.replace(/_/g, " ")}`}
      onPrevious={handlePreviousWeek}
      onNext={handleNextWeek}
    />
  ) : null;

  const periodChips = sortedAvailabilities.length > 1 ? (
    <div className="flex flex-wrap gap-2">
      {sortedAvailabilities.map((period) => (
        <button
          key={period.id}
          type="button"
          aria-pressed={selectedPeriod?.id === period.id}
          onClick={() => {
            setSelectedPeriodId(period.id);
            setCurrentWeekIndex(0);
          }}
          className={periodChipClass(selectedPeriod?.id === period.id)}
        >
          {formatPeriodLabel(period)}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <>
      <div className="space-y-6">
        {(!sortedAvailabilities || sortedAvailabilities.length === 0) ? (
          <Card className={cardClass}>
            <CardContent className={cardBodyClass}>
              <SectionTitle>Availability</SectionTitle>
              <div className="flex flex-col items-center justify-center gap-4 rounded-[8px] bg-[#F4F4EB] px-5 py-10 text-center">
                <Calendar className="size-8 text-[#A3A6AB]" strokeWidth={1.5} aria-hidden="true" />
                <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">No availability set yet</p>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className={primaryButtonClass}
                  >
                    Add availability
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : canManage ? (
          <div className="flex flex-col gap-6">
            <section className={`flex flex-col gap-5 ${cardClass} px-[25px] pb-[25px] pt-[30px]`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <SectionTitle>Booking period</SectionTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!selectedPeriod}
                    onClick={() => selectedPeriod && handleEdit(selectedPeriod)}
                    className={secondaryButtonClass}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={!selectedPeriod}
                    onClick={() => selectedPeriod && handleDeletePeriod(selectedPeriod.id)}
                    className={secondaryButtonClass}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className={primaryButtonClass}
                  >
                    Add availability
                  </button>
                </div>
              </div>
              {periodChips}
              {selectedPeriod && (
                <div className="flex flex-col gap-3 rounded-[8px] bg-[#F4F4EB] p-[10px] sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-[5px]">
                    <span className="text-[12px] font-normal leading-[14px] tracking-[-0.03em] text-[#767980]">Selected period</span>
                    <span className="text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">
                      {formatPeriodLabel(selectedPeriod)}
                    </span>
                  </div>
                  {weeklySlotCount > 0 && (
                    <p className="text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-[#767980]">
                      {bookedSlotCount} of {weeklySlotCount} weekly slots booked
                    </p>
                  )}
                </div>
              )}
            </section>

            {bookingMix.length > 0 && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                {bookingMix.map((group) => (
                  <div
                    key={group.label}
                    className={`flex flex-col gap-3 ${cardClass} px-[25px] pb-[25px] pt-[30px]`}
                  >
                    <p className="text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#767980]">{group.label}</p>
                    <p className="text-[32px] font-bold leading-[30px] tracking-[-0.05em] text-[#1A202C]">
                      {group.booked} / {group.total}
                    </p>
                    <div className="h-[5px] w-full overflow-hidden rounded-[10px] bg-[#EAEADF]">
                      <div
                        className="h-full rounded-[10px] bg-[#0054B4]"
                        style={{ width: `${Math.round((group.booked / group.total) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[12px] font-normal leading-[14px] tracking-[-0.03em] text-[#767980]">
                      {group.open} {group.open === 1 ? "slot" : "slots"} open
                    </p>
                  </div>
                ))}
              </div>
            )}

            {selectedPeriod && (
              <section className={`flex flex-col gap-5 ${cardClass} px-[25px] pb-[25px] pt-[30px]`}>
                {weekHeader ?? <SectionTitle>Weekly time slots</SectionTitle>}
                <AvailabilityTable
                  slots={resolvedWeeklySlots}
                  onEdit={handleSlotEdit}
                  onDelete={handleDeleteSlot}
                  showActions
                  slotStatusMap={slotStatusMap}
                  slotStatusLoading={slotStatusLoading && !slotStatusError}
                  platformFeePerc={platformFeePerc}
                  stripeFeePerc={stripeFeePerc}
                  platformFeeWaived={referralWaived}
                  appearance="coach"
                />
              </section>
            )}
          </div>
        ) : (
          <Card className={cardClass}>
            <CardContent className={cardBodyClass}>
              {weekHeader ?? <SectionTitle>Availability</SectionTitle>}

              {selectedPeriod && (
                <div className="flex flex-col gap-3 rounded-[8px] bg-[#F4F4EB] p-[10px] md:flex-row md:items-center md:justify-between">
                  {periodChips ?? (
                    <p className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
                      Booking period{" "}
                      <span className="font-medium text-[#1A202C]">
                        {formatPeriodLabel(selectedPeriod)}
                      </span>
                    </p>
                  )}
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                    <span className="text-[12px] font-normal leading-[14px] tracking-[-0.03em] text-[#767980]">Filter by date</span>
                    <DateRangePicker
                      startDate={dateRangeStart || new Date(selectedPeriod.start_date)}
                      endDate={dateRangeEnd || new Date(selectedPeriod.end_date)}
                      onChange={handleDateRangeChange}
                      minStartDate={new Date(selectedPeriod.start_date)}
                      variant="cream"
                      className="gap-3"
                    />
                  </div>
                </div>
              )}

              {selectedPeriod && (
                <AvailabilityTable
                  slots={resolvedWeeklySlots}
                  onBookSlot={onBookSlot ? handleBookSlot : undefined}
                  showActions={!!onBookSlot}
                  slotStatusMap={slotStatusMap}
                  slotStatusLoading={slotStatusLoading && !slotStatusError}
                  platformFeePerc={platformFeePerc}
                  stripeFeePerc={stripeFeePerc}
                  platformFeeWaived={referralWaived}
                  appearance="athlete"
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal */}
      {canManage && (
        <>
          <ManageAvailabilityModal
            open={isModalOpen}
            onOpenChange={handleModalClose}
            coachId={coachId}
            editData={editData as CoachAvailability | null}
            initialFocusDay={focusDay}
            existingAvailabilities={availabilities as any}
      />

          {/* Slot Edit Modal (week-specific overrides) */}
          <SlotEditModal
            open={slotEditOpen}
            onOpenChange={handleSlotEditClose}
            slot={slotEditData}
            overrideDate={slotEditDate}
            coachId={coachId}
            availabilityId={selectedPeriod?.id || null}
            defaultGroupCapacity={defaultGroupCapacity}
          />

          {/* Delete Confirmation Dialog */}
          <DeleteConfirmationDialog
            open={deleteConfirmOpen}
            
            onOpenChange={setDeleteConfirmOpen}
            onConfirm={handleConfirmDelete}
            title={deleteTargetType === 'period' ? 'Delete this availability period?' : strings.availability.deleteDialog.slotTitle}
            description={
              deleteTargetType === 'period'
                ? (
                  <div className="space-y-1">
                    <div className="py-5 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">
                      {deleteTargetPeriod
                        ? formatPeriodLabel(deleteTargetPeriod)
                        : 'Selected period'}
                    </div>
                    <div className="text-left text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
                      This will delete all slots and occurrences in this period. This cannot be undone.
                    </div>
                  </div>
                )
                : strings.availability.deleteDialog.slotDescription
            }
          />
        </>
      )}
    </>
  );
};

export default CoachAvailabilitySection;
