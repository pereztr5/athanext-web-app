import { useState } from "react";
import { Plus, Trash2, Calendar } from "lucide-react";
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

  const labelClass = "text-[12px] font-normal leading-[14px] tracking-[-0.03em] text-[#767980]";
  const fieldClass =
    "h-[38px] rounded-[8px] border-0 bg-[#F1F1E6] px-[10px] text-[14px] leading-[18px] tracking-[-0.03em] text-[#1A202C] shadow-none focus-visible:ring-0";
  const primaryClass =
    "h-[34px] rounded-[8px] border border-[#6698D2] bg-[#0054B4] px-4 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#F1F1E6] hover:bg-[#004390]";
  const secondaryClass =
    "h-[34px] rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] px-4 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C] hover:bg-[#EAEADF]";

  return (
    <Card className="rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] shadow-none">
      <CardHeader className="px-[25px] pb-5 pt-[30px]">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-[20px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">
            <Calendar className="size-5 flex-none text-[#0054B4]" strokeWidth={1.5} aria-hidden="true" />
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
          <div className="flex flex-col gap-3 rounded-[8px] bg-[#F4F4EB] p-[15px]">
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
                className="group flex items-center justify-between gap-3 border-t border-[#EAEADF] py-3 first:border-t-0 first:pt-0"
              >
                <div className="flex-1 text-[14px] leading-[18px] tracking-[-0.03em]">
                  <span className="font-medium text-[#1A202C]">
                    {slot.date ? `${formatDate(slot.date)} (${dayName})` : dayName}
                  </span>
                  <span className="ml-2 text-[#767980]">
                    {formatTime(slot.start_time)} to {formatTime(slot.end_time)}
                  </span>
                </div>
                {isEditMode && (
                  <button
                    type="button"
                    onClick={() => handleDeleteSlot(slot.id)}
                    aria-label="Delete slot"
                    className="inline-flex size-4 items-center justify-center text-[#767980] opacity-0 transition-opacity hover:text-[#1A202C] focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="size-4" strokeWidth={1.5} />
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <div className="rounded-[8px] bg-[#F4F4EB] px-5 py-6 text-center">
            <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
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
