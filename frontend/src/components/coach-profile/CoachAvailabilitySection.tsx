import { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
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
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { getDefaultGroupCapacity } from '@/api/configurations';
import { CoachAvailability, CoachAvailabilitySlot, DayOfWeek, SlotBookingStatus } from '@/types/availability';
import type { CoachAvailabilityWithOccurrences } from '@/types/availabilityWithOccurrences';
import { Calendar, Clock, Trash2, Edit, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { formatWeekRange, getWeekStart, parseISODateLocal, toLocalISODate } from '@/utils/dateHelpers';
import { strings } from '@/config/strings';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { PROFILE_TYPE } from "@/utils/db";
import { useFeeConfig } from "@/hooks/useFeeConfig";
import { PRIMARY } from '@/config/colors';

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
  iconColor,
}: CoachAvailabilitySectionProps) => {
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
  const { platformFeePerc } = useFeeConfig();
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
  const resolvedIconClass = iconColor || "text-blue-600";

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

    if (start.getFullYear() === end.getFullYear()) {
      const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${startStr} - ${endStr}`;
    }

    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  };

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
      .map((occ) => {
        const dateObj = parseISODateUtc(occ.occurrence_date);
        const isoDay = ((dateObj.getDay() + 6) % 7) + 1 as DayOfWeek; // convert Sunday=0 to 7 using local time
        return {
          id: occ.id,
          weekly_slot_id: occ.weekly_slot_id,
          day_of_week: isoDay,
          session_name: occ.session_name,
          price: occ.price,
          duration_minutes: occ.duration_minutes as any,
          start_time: occ.start_time,
          end_time: occ.end_time,
          session_type: occ.session_type as any,
          location: occ.location as any,
          pillar_slot: occ.pillar_slot || null,
          is_enabled: occ.is_enabled,
          max_bookings_per_slot: occ.max_bookings_per_slot,
          availability_id: occ.availability_id,
          coach_id: occ.coach_id,
          occurrence_date: occ.occurrence_date,
        } as CoachAvailabilitySlot;
      })
      .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));
  }, [selectedPeriod, currentWeek]);

  const currentWeekRangeLabel = useMemo(() => {
    if (!selectedPeriod || !currentWeek) return '';
    const inRangeDates = (resolvedWeeklySlots || [])
      .map((s) => (s as any).occurrence_date)
      .filter(Boolean) as string[];
    return formatActualWeekRangeUtc(inRangeDates, currentWeek, selectedPeriod.start_date, selectedPeriod.end_date);
  }, [currentWeek, resolvedWeeklySlots, selectedPeriod]);

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
          .in('status', ['pending_payment', 'booked', 'completed']);

        if (requestId !== slotStatusRequestRef.current) return;

        if (error) {
          console.error('Failed to load slot booking status', error);
          setSlotStatusMap({});
          setSlotStatusError(true);
          return;
        }
        setSlotStatusError(false);

        const statusMap: Record<string, SlotBookingStatus> = {};
        currentSlots.forEach((slot) => {
          const rowsForSlot = (data as unknown as Array<{ occurrence_id: string; athlete_id: string; status: string }> || []).filter((row) => row.occurrence_id === slot.id);
          const capacityFromSlot = (slot as any).max_bookings_per_slot ?? (slot as any).max_bookings_per_slot;
          const capacity = slot.session_type === 'group'
            ? (capacityFromSlot && capacityFromSlot > 0 ? capacityFromSlot : defaultGroupCapacity)
            : (capacityFromSlot && capacityFromSlot > 0 ? capacityFromSlot : 1);

          const bookingCount = rowsForSlot.length;
          const pendingCount = rowsForSlot.filter((row) => row.status === 'pending_payment').length;
          const myBooking = rowsForSlot.find(
            (row) => row.athlete_id === (athleteProfileId || user?.id)
          );
          const myPendingPayment = myBooking?.status === 'pending_payment';
          const bookedByMe = Boolean(myBooking) && myBooking.status !== 'pending_payment';
          const hasPendingPayment = pendingCount > 0;
          const isFull = slot.session_type === 'group'
            ? bookingCount >= capacity
            : bookingCount > 0; // any booking occupies an individual slot

          statusMap[slot.id] = {
            isFull,
            bookedByMe,
            hasPendingPayment,
            myPendingPayment: Boolean(myPendingPayment),
            totalCount: bookingCount,
            capacity,
          };
        });

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

  const handleConfirmDelete = async () => {
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
        .in('status', ['pending_payment', 'booked', 'completed']);

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

  const renderHeader = () => (
    <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        <Calendar className={`w-6 h-6 ${resolvedIconClass}`} />
        <h2 className="text-2xl font-medium">
          Availability
        </h2>
      </div>
      <div className="w-full flex justify-end gap-3 md:w-auto md:justify-start">
        <Button
          onClick={() => setIsModalOpen(true)}
          className="hover:brightness-110"
          style={{ backgroundColor: PRIMARY.main, color: PRIMARY.foreground }}
        >
          + Add Availability
        </Button>
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Calendar className={`w-5 h-5 ${resolvedIconClass}`} />
              <h2 className="text-xl font-medium">Availability</h2>
            </div>
            <Alert variant="destructive">
              <AlertDescription>
                Failed to load availability. Please try again later.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Calendar className={`w-5 h-5 ${resolvedIconClass}`} />
              <h2 className="text-xl font-medium">Availability</h2>
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {(!sortedAvailabilities || sortedAvailabilities.length === 0) ? (
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Calendar className={`w-6 h-6 ${resolvedIconClass}`} />
                  <h2 className="text-2xl font-medium">Availability</h2>
                </div>
                {canManage && (
                  <Button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full sm:w-auto bg-primary text-white rounded-full font-semibold shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                  >
                    + Add Availability
                  </Button>
                )}
              </div>
              <div className="flex flex-col items-center justify-center space-y-4">
                <Calendar className={`w-16 h-16 ${resolvedIconClass}`} />
                <p className="text-gray-600 text-base">No availability set yet</p>
                {canManage && (
                  <Button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-primary text-white rounded-full px-8 shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                  >
                    + Add Availability
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className={`w-6 h-6 ${resolvedIconClass}`} />
                  <h2 className="text-2xl font-medium">Availability</h2>
                </div>
                {canManage && (
                  <Button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full sm:w-auto bg-primary text-white rounded-full font-semibold shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                  >
                    + Add Availability
                  </Button>
                )}
              </div>
              {/* Period Selector Pills */}
              {sortedAvailabilities.length > 1 && (
                <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-center md:justify-between">
                  <span className="text-sm font-medium text-gray-700 flex-shrink-0">Availability Period:</span>
                  <div className="flex-1  min-w-0 overflow-x-auto px-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] [&::-webkit-scrollbar]:h-[2rem] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb:hover][scrollbar-width:thin]:bg-gray-400 ">
                    <div className="flex mb-2 gap-3">
                      {sortedAvailabilities.map((period) => (
                        <button
                          key={period.id}
                          onClick={() => {
                            setSelectedPeriodId(period.id);
                            setCurrentWeekIndex(0);
                          }}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition flex-shrink-0 ${
                            selectedPeriod?.id === period.id
                              ? 'bg-primary text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {formatRangeWithYear(period.start_date, period.end_date)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Period Info and Actions */}
              {selectedPeriod && (
                <>
                  <div className="border rounded bg-gray-50 px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 font-semibold">Selected Period</span>
                      <div className="text-gray-800 font-semibold">
                        {formatRangeWithYear(selectedPeriod.start_date, selectedPeriod.end_date)}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditData(selectedPeriod);
                            setIsModalOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex items-center gap-1"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePeriod(selectedPeriod.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Date Range Picker for Week Navigation */}
                  <div className="flex flex-col md:flex-row md:items-center gap-3 pb-4 border-b">
                    <span className="text-sm font-medium text-gray-700">Jump to date:</span>
                    <DateRangePicker
                      startDate={dateRangeStart || new Date(selectedPeriod.start_date)}
                      endDate={dateRangeEnd || new Date(selectedPeriod.end_date)}
                      onChange={handleDateRangeChange}
                      minStartDate={new Date(selectedPeriod.start_date)}
                      className="flex-1"
                    />
                  </div>
                </>
              )}

              {/* Week Navigation */}
              {selectedPeriod && currentWeek && (
                <>
                  {/* Mobile: buttons in one row, weekly slots in full-width row below */}
                  <div className="flex flex-col gap-2 md:hidden">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlePreviousWeek}
                        disabled={currentWeekIndex === 0}
                        className="text-gray-600 flex-shrink-0"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Previous
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleNextWeek}
                        disabled={currentWeekIndex === weeks.length - 1}
                        className="text-gray-600 flex-shrink-0"
                      >
                        Next
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                    <div className="w-full">
                      <div className="flex items-center justify-center w-full">
                        <div className="text-center w-full px-2">
                          <div className="flex items-center justify-center gap-2">
                            <div className="font-semibold">Weekly Time Slots</div>
                            <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                              EST
                            </span>
                          </div>
                        <div className="text-sm text-gray-600 truncate">Week {currentWeekIndex + 1} of {weeks.length}: {currentWeekRangeLabel}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Desktop: original layout (buttons on sides, info center) */}
                  <div className="hidden md:flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePreviousWeek}
                      disabled={currentWeekIndex === 0}
                      className="text-gray-600 border border-slate-300 rounded-full px-3"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous Week
                    </Button>
                    <div className="flex items-center gap-2">
                      <Clock className={`w-6 h-6 -mt-0.5 ${resolvedIconClass}`} />
                      <div className="text-left leading-tight">
                        <div className="flex items-center justify-start gap-2">
                          <div className="font-semibold">Weekly Time Slots</div>
                          <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            EST
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">Week {currentWeekIndex + 1} of {weeks.length}: {currentWeekRangeLabel}</div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNextWeek}
                      disabled={currentWeekIndex === weeks.length - 1}
                      className="text-gray-600 border border-slate-300 rounded-full px-3"
                    >
                      Next Week
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </>
              )}

              {/* Table */}
              {selectedPeriod && (
              <AvailabilityTable
                slots={resolvedWeeklySlots}
                onEdit={canManage ? handleSlotEdit : undefined}
                onBookSlot={onBookSlot ? handleBookSlot : undefined}
                showActions={canManage || !!onBookSlot}
                slotStatusMap={slotStatusMap}
                slotStatusLoading={slotStatusLoading && !slotStatusError}
                platformFeePerc={platformFeePerc}
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
                    <div className="text-gray-800 font-semibold py-5">
                      {deleteTargetPeriod
                        ? formatRangeWithYear(deleteTargetPeriod.start_date, deleteTargetPeriod.end_date)
                        : 'Selected period'}
                    </div>
                    <div className="text-sm text-left text-gray-600 ">
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
