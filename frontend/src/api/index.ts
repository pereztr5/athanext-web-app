/**
 * Centralized API exports
 * Import all API endpoints from this single file
 * 
 * Usage:
 * import { coachesAPI, authAPI, appointmentsAPI } from '@/api';
 * 
 * const coaches = await coachesAPI.getPublicCoaches();
 * const response = await authAPI.signIn(credentials);
 * const appointments = await appointmentsAPI.getMyAppointments();
 */

// Core API client
export { apiClient, type ApiResponse, type ApiError } from './client';

// Configuration API
export {
  getConfigurationValue,
  getNumericConfiguration,
  getDefaultGroupCapacity,
} from './configurations';

// Sport Pillars API
export { coachesAPI, type PublicCoach, type CoachInsert, type CoachUpdate } from './endpoints/coaches';

// Auth API
export {
  authAPI,
  type SignUpData,
  type SignInData,
  type AuthResponse,
} from './endpoints/auth';

// Profiles API
export {
  profilesAPI,
  type UserProfile,
  type UserProfileUpsert,
} from './endpoints/profiles';

// User Profiles API
export {
  userProfilesAPI,
  type UserProfile as UserProfileData,
  type UserProfileInsert,
  type UserProfileUpdate,
} from './endpoints/userProfiles';

// Reviews API
export {
  reviewsAPI,
  type Review,
  type ReviewSummary,
  type SubmitReviewInput,
} from './endpoints/reviews';

// Appointments API
export {
  appointmentsAPI,
  type Appointment,
  type CreateAppointmentInput,
  type AvailableSlot,
} from './endpoints/appointments';

// Packages API
export {
  packagesAPI,
  type Package,
  type PackagePurchase,
  type PurchasePackageInput,
} from './endpoints/packages';

// Partnerships API
export {
  partnershipsAPI,
  type Partnership,
  type PartnershipInquiry,
  type SubmitInquiryInput,
} from './endpoints/partnerships';

// Votes API
export {
  votesAPI,
  type Vote,
  type VoteStats,
  type SubmitVoteInput,
} from './endpoints/votes';

// Contact Info API
export {
  contactInfoAPI,
  type ContactInfo,
} from './endpoints/contactInfo';

// Chat API
export {
  chatAPI,
  type ConversationWithParticipants,
  type MessageWithSender,
  type GetMessagesOptions,
} from './endpoints/chat';
export {
  athletesAPI,
  type AthleteProfileStats,
} from './endpoints/athletes';
export {
  athleteProfilesAPI,
  type AthleteProfile,
  type AthleteProfileInsert,
  type AthleteProfileUpdate,
} from './endpoints/athleteProfiles';
// Sessions API (coach_slot_bookings)
export {
  getMySessions,
  getCoachSessions,
  getAthleteSessions,
  cancelSession,
} from './sessions';

// Bookings API
export {
  bookingsAPI,
  type BookingConfirmationData,
  type CoachInfo,
} from './endpoints/bookings';

export type {
  CoachSlotBooking,
  SessionUIModel,
  SessionFilters,
  SessionGrouped,
  ComputedSessionStatus,
  BookingStatus,
  SessionTypeValue,
  LocationTypeValue,
  PaymentStatus,
} from '@/types/sessions-api';
