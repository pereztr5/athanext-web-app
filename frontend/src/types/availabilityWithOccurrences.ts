import type { CoachAvailabilitySlot } from './availability';

export interface SlotOccurrence {
  id: string;
  weekly_slot_id: string;
  availability_id: string;
  coach_id: string;
  occurrence_date: string; // YYYY-MM-DD
  session_name: string;
  price: number;
  duration_minutes: number;
  start_time: string; // HH:mm:ss (DB) - normalize in UI as needed
  end_time: string;
  session_type: 'individual' | 'group';
  location: 'online' | 'in-person';
  pillar_slot?: string | null;
  is_enabled: boolean;
  max_bookings_per_slot: number;
  created_at: string;
  updated_at: string;
}

export interface CoachAvailabilityWithOccurrences {
  id: string;
  coach_id: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
  weekly_slots: CoachAvailabilitySlot[];
  occurrences: SlotOccurrence[];
}
