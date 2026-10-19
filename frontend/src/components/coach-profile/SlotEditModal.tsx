/**
 * SlotEditModal Component
 * Modal to edit individual time slot attributes for a specific date (via overrides)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { CoachAvailabilitySlot, DURATION_OPTIONS, SESSION_TYPE_OPTIONS } from '@/types/availability';
import { useToast } from '@/hooks/use-toast';
import { calculateEndTime, normalizeTimeFormat } from '@/utils/availabilityValidation';
import { LOCATION_OPTIONS } from '@/utils/db';
import { useCoachDetails } from '@/hooks/useCoachDetails';
import { useSportPillars } from '@/hooks/useSportPillars';
import type { Enums } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface SlotEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: CoachAvailabilitySlot | null;
  overrideDate: string | null; // YYYY-MM-DD concrete date for this week's slot
  coachId: string;
  availabilityId?: string | null;
  defaultGroupCapacity?: number;
}

export function SlotEditModal({
  open,
  onOpenChange,
  slot,
  overrideDate,
  coachId,
  availabilityId,
  defaultGroupCapacity = 50,
}: SlotEditModalProps) {
  const { toast } = useToast();
  const { coach } = useCoachDetails(coachId);
  const queryClient = useQueryClient();
  const coachSport = useMemo<Enums<'sport_type'> | undefined>(() => {
    const sportValue = coach?.sport;
    if (!sportValue) return undefined;
    return sportValue.toLowerCase() as Enums<'sport_type'>;
  }, [coach?.sport]);
  const { sportPillars } = useSportPillars({ sport: coachSport, autoFetch: !!coachSport });

  // Initialize isEnabled based on slot, default to true for new slots
  const [isEnabled, setIsEnabled] = useState(slot?.is_enabled ?? true);
  const [sessionName, setSessionName] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [duration, setDuration] = useState<number | ''>('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [sessionType, setSessionType] = useState<'individual' | 'group' | ''>('');
  const [location, setLocation] = useState<'online' | 'in-person' | ''>('');
  const [pillarSlot, setPillarSlot] = useState('');

  // Helper to keep end time aligned when start/duration change
  const updateEndTime = useCallback((start: string, durationMinutes: number | '') => {
    const normalizedStart = normalizeTimeFormat(start);
    const durationNum = typeof durationMinutes === 'number' ? durationMinutes : Number(durationMinutes);

    if (!normalizedStart || Number.isNaN(durationNum) || durationNum <= 0) return;

    const calculatedEndTime = calculateEndTime(normalizedStart, durationNum);
    if (calculatedEndTime) {
      setEndTime(calculatedEndTime);
    }
  }, []);

  // Auto-calculate end time when duration or start time changes
  useEffect(() => {
    updateEndTime(startTime, duration);
  }, [startTime, duration, updateEndTime]);

  const canSubmit = () => {
    if (!slot || !overrideDate) return false;
    if (!isEnabled) return true; // Can always disable
    
    // When enabling: require core fields (session name, price, duration, time)
    // Pillar is optional if the slot already has basic data configured
    const hasBasicData = slot && slot.session_name && slot.price && slot.duration_minutes && slot.start_time && slot.end_time;
    
    if (hasBasicData) {
      // Slot has core data, can enable/modify without requiring pillar
      return true;
    }
    
    // For new slots or major edits, require all fields including pillar
    if (!sessionName || price === '' || duration === '' || !startTime || !endTime) return false;
    return true;
  };

  useEffect(() => {
    if (slot) {
      setIsEnabled(slot.is_enabled);
      setSessionName(slot.session_name);
      setPrice(slot.price ?? '');
      setDuration(slot.duration_minutes ?? '');
      const normalizedStart = normalizeTimeFormat(slot.start_time);
      const normalizedEnd = normalizeTimeFormat(slot.end_time);
      setStartTime(normalizedStart);
      setEndTime(normalizedEnd || '');
      setSessionType(slot.session_type);
      setLocation(slot.location);
      setPillarSlot(slot.pillar_slot ?? '');
    } else {
      setIsEnabled(true);
      setSessionName('');
      setPrice('');
      setDuration('');
      setStartTime('');
      setEndTime('');
      setSessionType('');
      setLocation('');
      setPillarSlot('');
    }
  }, [slot]);

  const handleSave = async () => {
    if (!slot || !overrideDate) return;

    try {
      // Update the concrete occurrence row in v3 only
      const payload: any = { is_enabled: isEnabled };
      if (isEnabled) {
        const currentGroupCapacity =
          slot.session_type === 'group' &&
          typeof slot.max_bookings_per_slot === 'number' &&
          slot.max_bookings_per_slot > 1
            ? slot.max_bookings_per_slot
            : null;
        const resolvedCapacity =
          sessionType === 'group'
            ? currentGroupCapacity ?? defaultGroupCapacity
            : 1;

        payload.session_name = sessionName;
        payload.price = typeof price === 'number' ? price : Number(price);
        payload.duration_minutes = typeof duration === 'number' ? duration : Number(duration);
        payload.start_time = startTime;
        payload.end_time = endTime;
        payload.session_type = sessionType || null;
        payload.location = location || null;
        payload.pillar_slot = pillarSlot || null;
        payload.max_bookings_per_slot = resolvedCapacity;
      }

      const { error } = await supabase
        .from('coach_availability_slot_occurrences')
        .update(payload)
        .eq('id', slot.id);

      if (error) throw error;

      if (slot.weekly_slot_id) {
        const { error: weeklySlotError } = await supabase
          .from('coach_availability_weekly_slots')
          .update(payload)
          .eq('id', slot.weekly_slot_id);

        if (weeklySlotError) throw weeklySlotError;
      }
      const availabilityKey = availabilityId || (slot as any).availability_id || null;
      if (availabilityKey) {
        queryClient.invalidateQueries({ queryKey: ['occurrences', availabilityKey] });
        queryClient.invalidateQueries({ queryKey: ['coach-availability', coachId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['coach-availability', coachId] });
      }

      toast({ title: 'Saved', description: `Slot updated for ${overrideDate}.` });
      onOpenChange(false);
    } catch (e: any) {
      const msg = (() => {
        const rawMsg = e?.message || '';
        if (e?.code === 'P0001' && rawMsg.toLowerCase().includes('overlapping')) {
          return 'This time overlaps another availability for this coach on that date. Adjust start/end to avoid conflicts.';
        }
        return rawMsg || 'Could not save override';
      })();
      toast({ title: 'Save failed', description: msg, variant: 'destructive' });
    }
  };

  const labelClass = 'text-label-xsm text-dark-300';
  const dateLabel = (() => {
    if (!overrideDate) return null;
    const parsed = new Date(`${overrideDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return overrideDate;
    return parsed.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-hidden p-0 font-sans tracking-[-0.03em] text-dark sm:max-w-xl md:max-w-2xl [&>button]:right-[17px] [&>button]:top-[19px]">
        <DialogHeader className="space-y-1.5 px-[25px] py-5 pr-14 text-left">
          <DialogTitle className="text-section text-dark">
            Edit time slot
          </DialogTitle>
          <DialogDescription className={dateLabel ? 'text-body-m text-dark-300' : 'sr-only'}>
            {dateLabel ?? 'Change this slot for one date'}
          </DialogDescription>
        </DialogHeader>

        <div className="h-px bg-light-525" />

        {!slot ? (
          <p className="px-[25px] py-5 text-body-m text-dark-300">No slot selected.</p>
        ) : (
          <>
            <div className="max-h-[60vh] overflow-y-auto px-[25px] py-5">
              <div
                className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                style={{ opacity: !isEnabled ? 0.6 : 1 }}
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="slot-session-name" className={labelClass}>Session name</Label>
                  <Input
                    id="slot-session-name"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    disabled={!isEnabled}
                    placeholder="Enter session name"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="slot-price" className={labelClass}>Price</Label>
                  <Input
                    id="slot-price"
                    type="number"
                    min={0}
                    step="1"
                    value={price}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setPrice('');
                        return;
                      }
                      const next = Number(raw);
                      if (Number.isFinite(next)) {
                        setPrice(Number(next.toFixed(0)));
                      }
                    }}
                    disabled={!isEnabled}
                    placeholder="0"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className={labelClass}>Duration</Label>
                  <Select
                    value={duration === '' ? '' : String(duration)}
                    onValueChange={(v) => {
                      const nextDuration = Number(v);
                      setDuration(nextDuration);
                      updateEndTime(startTime, nextDuration);
                    }}
                    disabled={!isEnabled}
                  >
                    <SelectTrigger aria-label="Duration">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map((d) => (
                        <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="slot-start-time" className={labelClass}>Start time</Label>
                  <Input
                    id="slot-start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => {
                      const nextStart = normalizeTimeFormat(e.target.value);
                      setStartTime(nextStart);
                      updateEndTime(nextStart, duration);
                    }}
                    disabled={!isEnabled}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="slot-end-time" className={labelClass}>End time</Label>
                  <Input id="slot-end-time" type="time" value={endTime} disabled className="bg-light-400" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className={labelClass}>Session type</Label>
                  <Select value={sessionType || ''} onValueChange={(v) => setSessionType(v as any)} disabled={!isEnabled}>
                    <SelectTrigger aria-label="Session type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {SESSION_TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t === 'individual' ? 'Individual' : 'Group'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className={labelClass}>Pillar</Label>
                  <Select value={pillarSlot} onValueChange={(v) => setPillarSlot(v)} disabled={!isEnabled || sportPillars.length === 0}>
                    <SelectTrigger aria-label="Pillar">
                      <SelectValue placeholder={sportPillars.length ? 'Select pillar' : 'No pillars'} />
                    </SelectTrigger>
                    <SelectContent>
                      {sportPillars.map((p) => (
                        <SelectItem key={p.id} value={p.title || ''}>
                          {p.title || 'Untitled'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className={labelClass}>Location</Label>
                  <Select value={location || ''} onValueChange={(v) => setLocation(v as any)} disabled={!isEnabled}>
                    <SelectTrigger aria-label="Location">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCATION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-5 flex items-start gap-[10px] rounded-control bg-light-400 p-3">
                <Checkbox
                  id="slotEnabled"
                  checked={isEnabled}
                  onCheckedChange={(checked) => setIsEnabled(checked === true)}
                  className="mt-px"
                />
                <div className="flex flex-col gap-1">
                  <Label className="cursor-pointer text-label-sm text-dark" htmlFor="slotEnabled">
                    Enable this slot
                  </Label>
                  <p className="text-caption text-dark-300">Disabled slots stay hidden from booking until you turn them back on.</p>
                </div>
              </div>
            </div>

            <div className="h-px bg-light-525" />

            <div className="flex flex-col-reverse gap-[10px] px-[25px] py-5 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!canSubmit()}>
                Save
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default SlotEditModal;
