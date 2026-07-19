/**
 * Contact form data types
 */
export interface ContactFormData {
  fullName: string;
  email: string;
  subject: string;
  message: string;
}

/**
 * Database contact submission record
 */
export interface ContactSubmission {
  id: string;
  full_name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'in_progress' | 'resolved' | 'spam';
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Contact information types
 */
export interface ContactMethod {
  icon: 'email' | 'phone' | 'location';
  title: string;
  value: string;
  description: string;
  link?: string;
}
