import { useState, useEffect, useCallback } from "react";
import { appointmentsAPI } from "@/api";
import { useToast } from "@/hooks/use-toast";

export interface Appointment {
  id: string;
  user_id: string;
  coach_id: string;
  date: string;
  time: string;
  duration_minutes: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  created_at: string;
  coach_name?: string;
  athlete_name?: string;
}

export const useAppointments = (userId?: string, coachId?: string) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      
      let response;
      if (coachId) {
        // Fetch appointments for coach
        response = await appointmentsAPI.getCoachAppointments(coachId);
      } else {
        // Fetch appointments for current user (athlete)
        response = await appointmentsAPI.getMyAppointments();
      }

      if (response.error) {
        throw response.error;
      }

      setAppointments(response.data || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast({
        title: "Error",
        description: "Failed to load appointments",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [coachId, toast]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const cancelAppointment = async (appointmentId: string) => {
    try {
      const response = await appointmentsAPI.cancelAppointment(appointmentId);
      
      if (response.error) {
        throw response.error;
      }

      toast({
        title: "Success",
        description: "Appointment cancelled successfully"
      });

      await fetchAppointments();
      return { success: true };
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      toast({
        title: "Error",
        description: "Failed to cancel appointment",
        variant: "destructive"
      });
      return { success: false };
    }
  };

  const upcomingAppointments = appointments.filter(
    apt => apt.status === 'scheduled' && new Date(`${apt.date}T${apt.time}`) > new Date()
  );

  const pastAppointments = appointments.filter(
    apt => apt.status === 'completed' || 
    (apt.status === 'scheduled' && new Date(`${apt.date}T${apt.time}`) <= new Date())
  );

  return {
    appointments,
    upcomingAppointments,
    pastAppointments,
    loading,
    cancelAppointment,
    refreshAppointments: fetchAppointments
  };
};
