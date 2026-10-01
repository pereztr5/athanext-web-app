/**
 * Appointments API Endpoints
 * Handles booking and managing coaching sessions
 */

import { apiClient, type ApiResponse } from '@/api/client';

export interface Appointment {
  id: string;
  user_id: string;
  coach_id: string;
  date: string;
  time: string;
  duration_minutes: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  created_at: string;
}

export interface CreateAppointmentInput {
  coach_id: string;
  date: string;      // ISO date string
  time: string;      // HH:mm format
  duration_minutes: number;
}

export interface AvailableSlot {
  date: string;
  time: string;
}

export const appointmentsAPI = {
  /**
   * Create new appointment
   * @param data - Appointment details including coach_id, date, and time
   * @returns ApiResponse with created appointment
   */
  async createAppointment(data: CreateAppointmentInput): Promise<ApiResponse<Appointment>> {
    return apiClient.mutate(
      async (client) => client
        .from('appointments')
        .insert(data)
        .select()
        .single(),
      `Create appointment with coach: ${data.coach_id}`
    );
  },

  /**
   * Get user's appointments
   * @returns ApiResponse with user's appointments list
   */
  async getMyAppointments(): Promise<ApiResponse<Appointment[]>> {
    const user = await apiClient.getSupabaseClient().auth.getUser();
    
    if (!user.data.user) {
      return {
        data: null,
        error: {
          code: 'AUTH_ERROR',
          message: 'User not authenticated',
          status: 401,
        },
      };
    }

    return apiClient.query(
      async (client) => client
        .from('appointments')
        .select('*')
        .eq('user_id', user.data.user!.id)
        .order('date', { ascending: false }),
      'Fetch user appointments'
    );
  },

  /**
   * Get coach's appointments (for coach view)
   * @param coachId - Coach ID to fetch appointments for
   * @returns ApiResponse with coach's appointments
   */
  async getCoachAppointments(coachId: string): Promise<ApiResponse<Appointment[]>> {
    return apiClient.query(
      async (client) => client
        .from('appointments')
        .select('*')
        .eq('coach_id', coachId)
        .order('date', { ascending: false }),
      `Fetch appointments for coach: ${coachId}`
    );
  },

  /**
   * Cancel appointment
   * @param appointmentId - ID of appointment to cancel
   * @returns ApiResponse with cancellation result
   */
  async cancelAppointment(appointmentId: string): Promise<ApiResponse<null>> {
    return apiClient.mutate(
      async (client) => client
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId),
      `Cancel appointment: ${appointmentId}`
    );
  },

  /**
   * Reschedule appointment
   * @param appointmentId - ID of appointment to reschedule
   * @param newDate - New date in ISO format
   * @param newTime - New time in HH:mm format
   * @returns ApiResponse with rescheduled appointment
   */
  async rescheduleAppointment(
    appointmentId: string,
    newDate: string,
    newTime: string
  ): Promise<ApiResponse<Appointment>> {
    return apiClient.mutate(
      async (client) => client
        .from('appointments')
        .update({ date: newDate, time: newTime })
        .eq('id', appointmentId)
        .select()
        .single(),
      `Reschedule appointment: ${appointmentId}`
    );
  },

  /**
   * Get appointment by ID
   * @param appointmentId - ID of appointment to fetch
   * @returns ApiResponse with appointment details
   */
  async getAppointmentById(appointmentId: string): Promise<ApiResponse<Appointment | null>> {
    return apiClient.query(
      async (client) => client
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .single(),
      `Fetch appointment: ${appointmentId}`
    );
  },

  /**
   * Mark appointment as completed
   * @param appointmentId - ID of appointment to mark as completed
   * @returns ApiResponse with updated appointment
   */
  async completeAppointment(appointmentId: string): Promise<ApiResponse<Appointment>> {
    return apiClient.mutate(
      async (client) => client
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', appointmentId)
        .select()
        .single(),
      `Mark appointment as completed: ${appointmentId}`
    );
  },
};
