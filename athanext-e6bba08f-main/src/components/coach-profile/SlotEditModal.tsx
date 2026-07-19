/**
 * SlotEditModal Component
 * Modal to edit individual time slot attributes for a specific date (via overrides)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
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
        .from('coach_availability_slot_occurrences' as any)
        .update(payload)
        .eq('id', slot.id);

      if (error) throw error;

      if (slot.weekly_slot_id) {
        const { error: weeklySlotError } = await supabase
          .from('coach_availability_weekly_slots' as any)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl rounded-2xl p-6 md:p-7">
        <DialogHeader className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-xl md:text-2xl font-bold text-slate-900">
              Edit Time Slot{overrideDate ? ` — ${overrideDate}` : ''}
            </DialogTitle>
            <DialogClose className="text-slate-500 hover:text-slate-700 transition" />
          </div>
          
        </DialogHeader>
        {!slot ? (
          <div className="text-sm text-muted-foreground">No slot selected.</div>
        ) : (
          <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-1">
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5 rounded-xl border border-slate-100 bg-slate-50/60 p-4"
              style={{ opacity: !isEnabled ? 0.6 : 1 }}
            >
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-800">Session name</Label>
                <Input
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  disabled={!isEnabled}
                  className="rounded-full h-11"
                  placeholder="Enter session name"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-800">Price</Label>
                <Input
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
                  className="rounded-full h-11"
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-800">Duration</Label>
                <Select
                  value={duration === '' ? '' : String(duration)}
                  onValueChange={(v) => {
                    const nextDuration = Number(v);
                    setDuration(nextDuration);
                    updateEndTime(startTime, nextDuration);
                  }}
                  disabled={!isEnabled}
                >
                  <SelectTrigger className="rounded-full h-11">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((d) => (
                      <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-800">Start time</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    const nextStart = normalizeTimeFormat(e.target.value);
                    setStartTime(nextStart);
                    updateEndTime(nextStart, duration);
                  }}
                  disabled={!isEnabled}
                  className="rounded-full h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-800">End time</Label>
                <Input type="time" value={endTime} disabled className="rounded-full h-11 bg-gray-50" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-800">Session type</Label>
                <Select value={sessionType || ''} onValueChange={(v) => setSessionType(v as any)} disabled={!isEnabled}>
                  <SelectTrigger className="rounded-full h-11">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>{t === 'individual' ? 'Individual' : 'Group'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-800">Pillar</Label>
                <Select value={pillarSlot} onValueChange={(v) => setPillarSlot(v)} disabled={!isEnabled || sportPillars.length === 0}>
                  <SelectTrigger className="rounded-full h-11">
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
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-800">Location</Label>
                <Select value={location || ''} onValueChange={(v) => setLocation(v as any)} disabled={!isEnabled}>
                  <SelectTrigger className="rounded-full h-11">
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
            

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
              <div className="flex items-center gap-3 sm:mr-auto mb-2 sm:mb-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 bg-blue-50 border border-blue-100 rounded-full px-3 py-2">
              <Checkbox id="slotEnabled" checked={isEnabled} onCheckedChange={(checked) => setIsEnabled(checked === true)} />
              <Label className="cursor-pointer" htmlFor="slotEnabled">
                Enable this slot
              </Label>
            </div>
            <p className="text-xs text-slate-500">Disabled slots stay hidden from booking until enabled.</p>
          </div>
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full px-4">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!canSubmit()} className="rounded-full px-5">
                Save
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default SlotEditModal;
