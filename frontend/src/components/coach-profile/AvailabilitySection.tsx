import { useState } from "react";
import { Plus, Trash2, Calendar } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface WeeklySlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone?: string;
  date?: string; // Add date field for specific date slots
}

interface AvailabilitySectionProps {
  weeklyAvailability?: WeeklySlot[];
  isEditMode?: boolean;
  coachId?: string;
  onAddSlot?: (slot: Omit<WeeklySlot, 'id'>) => void;
  onDeleteSlot?: (slotId: string) => void;
}

export function AvailabilitySection({
  weeklyAvailability = [],
  isEditMode = false,
  coachId,
  onAddSlot,
  onDeleteSlot
}: AvailabilitySectionProps) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const [isAdding, setIsAdding] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [newSlot, setNewSlot] = useState({
    day_of_week: 1, // Monday
    start_time: '09:00',
    end_time: '17:00',
    timezone: 'America/New_York'
  });

  // Format time from "09:00:00" to "09:00"
  const formatTime = (time: string) => {
    return time.slice(0, 5);
  };

  const handleAddSlot = () => {
    if (!coachId) return;

    onAddSlot?.({
      day_of_week: newSlot.day_of_week,
      start_time: `${newSlot.start_time}:00`,
      end_time: `${newSlot.end_time}:00`,
      timezone: newSlot.timezone
    });

    setIsAdding(false);
    setNewSlot({
      day_of_week: 1,
      start_time: '09:00',
      end_time: '17:00',
      timezone: 'America/New_York'
    });
    setSelectedDate('');
  };

  const handleDeleteSlot = (slotId: string) => {
    if (!confirm('Are you sure you want to delete this availability slot?')) return;
    onDeleteSlot?.(slotId);
  };

  const labelClass = "text-caption text-dark-300";
  const fieldClass =
    "h-[38px] rounded-control border border-dark-250 bg-light px-[10px] text-body-m text-dark focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-primary focus-visible:ring-0 focus-visible:ring-offset-0";
  const primaryClass = "";
  const secondaryClass = "";

  return (
    <Card className="rounded-card border border-light-525 bg-light-300">
      <CardHeader className="px-[25px] pb-5 pt-[30px]">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-card-title text-dark">
            <Calendar className="size-5 flex-none text-primary" strokeWidth={1.5} aria-hidden="true" />
            Availability
          </CardTitle>
          {isEditMode && (
            <Button
              onClick={() => setIsAdding(!isAdding)}
              size="sm"
              variant="outline"
              className={`${secondaryClass} gap-[5px]`}
            >
              <Plus className="size-4" strokeWidth={1.5} />
              Add
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-[25px] pb-[25px]">
        {isAdding && isEditMode && (
          <div className="flex flex-col gap-3 rounded-control bg-light-400 p-[15px]">
            <div className="flex flex-col gap-[5px]">
              <Label className={labelClass}>Select date</Label>
              <Input
                type="date"
                className={fieldClass}
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  if (e.target.value) {
                    const date = new Date(e.target.value);
                    const dayOfWeek = date.getDay();
                    setNewSlot({ ...newSlot, day_of_week: dayOfWeek });
                  }
                }}
              />
            </div>

            <div className="flex flex-col gap-[5px]">
              <Label className={labelClass}>Day of week</Label>
              <Select
                value={newSlot.day_of_week.toString()}
                onValueChange={(value) => setNewSlot({ ...newSlot, day_of_week: parseInt(value) })}
              >
                <SelectTrigger className={fieldClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dayNames.map((day, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-[5px]">
                <Label className={labelClass}>Start time</Label>
                <Input
                  type="time"
                  className={fieldClass}
                  value={newSlot.start_time}
                  onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-[5px]">
                <Label className={labelClass}>End time</Label>
                <Input
                  type="time"
                  className={fieldClass}
                  value={newSlot.end_time}
                  onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-col gap-[5px]">
              <Label className={labelClass}>Timezone</Label>
              <Select
                value={newSlot.timezone}
                onValueChange={(value) => setNewSlot({ ...newSlot, timezone: value })}
              >
                <SelectTrigger className={fieldClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                  <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setIsAdding(false)}
                variant="outline"
                size="sm"
                className={secondaryClass}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddSlot}
                size="sm"
                className={primaryClass}
              >
                Add slot
              </Button>
            </div>
          </div>
        )}

        {weeklyAvailability.length > 0 ? (
          weeklyAvailability.map((slot) => {
            const dayName = dayNames[slot.day_of_week];
            const formatDate = (dateStr: string) => {
              const date = new Date(dateStr);
              return new Intl.DateTimeFormat('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              }).format(date);
            };

            return (
              <div
                key={slot.id}
                className="group flex items-center justify-between gap-3 border-t border-light-525 py-3 first:border-t-0 first:pt-0"
              >
                <div className="flex-1 text-body-m">
                  <span className="font-medium text-dark">
                    {slot.date ? `${formatDate(slot.date)} (${dayName})` : dayName}
                  </span>
                  <span className="ml-2 text-dark-300">
                    {formatTime(slot.start_time)} to {formatTime(slot.end_time)}
                  </span>
                </div>
                {isEditMode && (
                  <button
                    type="button"
                    onClick={() => handleDeleteSlot(slot.id)}
                    aria-label="Delete slot"
                    className="inline-flex size-4 items-center justify-center text-dark-300 opacity-0 transition-opacity hover:text-dark focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="size-4" strokeWidth={1.5} />
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <div className="rounded-control bg-light-400 px-5 py-6 text-center">
            <p className="text-body-m text-dark-300">
              {isEditMode
                ? 'No availability slots. Select "Add" to create one.'
                : 'The coach has no available slots at this time.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
