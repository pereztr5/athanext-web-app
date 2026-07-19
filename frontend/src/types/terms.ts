/**
 * Terms & Conditions Type Definitions
 * Centralized type definitions for Terms & Conditions page
 */

export interface TermsAndConditions {
  id: string;
  title: string;
  content: string; // HTML content
  last_updated: string; // ISO date string
  is_active: boolean;
  version?: string;
  created_at?: string;
  updated_at?: string;
}
