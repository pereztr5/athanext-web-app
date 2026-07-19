import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useUpsertSlotOverride } from '@/hooks/useAvailabilityOverrides';
import { CoachAvailabilitySlot, DURATION_OPTIONS, SESSION_TYPE_OPTIONS } from '@/types/availability';
import { useToast } from '@/hooks/use-toast';
import { LOCATION_OPTIONS } from '@/utils/db';

interface WeekOverrideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: CoachAvailabilitySlot | null;
  overrideDate: string | null; // YYYY-MM-DD
}

export function WeekOverrideModal({ open, onOpenChange, slot, overrideDate }: WeekOverrideModalProps) {
  const { toast } = useToast();
  const upsert = useUpsertSlotOverride();

  const [disabledForDate, setDisabledForDate] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [duration, setDuration] = useState<number | ''>('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [sessionType, setSessionType] = useState<'individual' | 'group' | ''>('');
  const [location, setLocation] = useState<'online' | 'in-person' | ''>('');

  const canSubmit = useMemo(() => {
    if (!slot || !overrideDate) return false;
    if (disabledForDate) return true;
    if (startTime && endTime && startTime >= endTime) return false;
    return true;
  }, [slot, overrideDate, disabledForDate, startTime, endTime]);

  useEffect(() => {
    if (slot) {
      setDisabledForDate(false);
      setSessionName(slot.session_name);
      setPrice(slot.price ?? '');
      setDuration(slot.duration_minutes ?? '');
      setStartTime(slot.start_time);
      setEndTime(slot.end_time);
      setSessionType(slot.session_type);
      setLocation(slot.location);
    }
  }, [slot]);

  const handleSave = async () => {
    if (!slot || !overrideDate) return;

    try {
      const payload: any = {
        slot_id: slot.id,
        override_date: overrideDate,
      };

      if (disabledForDate) {
        payload.is_enabled = false;
      } else {
        // Send all attributes to make the override explicit for that day
        payload.session_name = sessionName;
        payload.price = typeof price === 'number' ? price : Number(price);
        payload.duration_minutes = typeof duration === 'number' ? duration : Number(duration);
        payload.start_time = startTime;
        payload.end_time = endTime;
        payload.session_type = sessionType || null;
        payload.location = location || null;
        payload.is_enabled = true;
      }

      await upsert.mutateAsync(payload);
      toast({ title: 'Saved', description: 'Override saved for this date.' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message || 'Could not save override', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Week-specific edit{overrideDate ? ` — ${overrideDate}` : ''}</DialogTitle>
        </DialogHeader>
        {!slot ? (
          <div className="text-sm text-muted-foreground">No slot selected.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="disableSlot" checked={disabledForDate} onCheckedChange={(v) => setDisabledForDate(Boolean(v))} />
              <Label htmlFor="disableSlot">Disable this slot for this date</Label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 opacity-100 transition-opacity" style={{ opacity: disabledForDate ? 0.5 : 1 }}>
              <div>
                <Label>Session name</Label>
                <Input value={sessionName} onChange={(e) => setSessionName(e.target.value)} disabled={disabledForDate} />
              </div>
              <div>
                <Label>Price</Label>
                <Input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))} disabled={disabledForDate} />
              </div>
              <div>
                <Label>Duration</Label>
                <Select value={duration === '' ? '' : String(duration)} onValueChange={(v) => setDuration(Number(v))} disabled={disabledForDate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((d) => (
                      <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Session type</Label>
                <Select value={sessionType || ''} onValueChange={(v) => setSessionType(v as any)} disabled={disabledForDate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start time</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={disabledForDate} />
              </div>
              <div>
                <Label>End time</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={disabledForDate} />
              </div>
              <div>
                <Label>Location</Label>
                <Select value={location || ''} onValueChange={(v) => setLocation(v as any)} disabled={disabledForDate}>
                  <SelectTrigger>
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

            {!disabledForDate && startTime && endTime && startTime >= endTime && (
              <div className="text-sm text-red-600">Start time must be before end time.</div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!canSubmit || upsert.isPending}>
                {upsert.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default WeekOverrideModal;
