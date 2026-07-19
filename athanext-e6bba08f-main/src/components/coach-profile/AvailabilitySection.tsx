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

  return (
    <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold">Availability</CardTitle>
          {isEditMode && (
            <Button
              onClick={() => setIsAdding(!isAdding)}
              size="sm"
              variant="outline"
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isAdding && isEditMode && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/50">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Select Date
              </Label>
              <Input
                type="date"
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

            <div className="space-y-2">
              <Label>Day of Week</Label>
              <Select
                value={newSlot.day_of_week.toString()}
                onValueChange={(value) => setNewSlot({ ...newSlot, day_of_week: parseInt(value) })}
              >
                <SelectTrigger>
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

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={newSlot.start_time}
                  onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={newSlot.end_time}
                  onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={newSlot.timezone}
                onValueChange={(value) => setNewSlot({ ...newSlot, timezone: value })}
              >
                <SelectTrigger>
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

            <div className="flex gap-2">
              <Button
                onClick={handleAddSlot}
                className="flex-1"
                size="sm"
              >
                Add Slot
              </Button>
              <Button
                onClick={() => setIsAdding(false)}
                variant="outline"
                size="sm"
              >
                Cancel
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

            // Debug logging
            // console.log('Slot data:', slot);

            return (
              <div key={slot.id} className="flex justify-between items-center group">
                <div className="flex-1">
                  {slot.date ? (
                    <>
                      <span className="text-sm font-semibold text-foreground">
                        {formatDate(slot.date)} ({dayName}):
                      </span>
                      <span className="text-sm text-muted-foreground ml-2">
                        {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-semibold text-foreground">{dayName}:</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                      </span>
                    </>
                  )}
                </div>
                {isEditMode && (
                  <Button
                    onClick={() => handleDeleteSlot(slot.id)}
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              {isEditMode
                ? 'No availability slots. Click "Add" to create one.'
                : 'The coach has no available slots at this time.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
