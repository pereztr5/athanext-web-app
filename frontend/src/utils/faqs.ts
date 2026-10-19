/**
 * FAQ Fallback Data
 * Used when Supabase table doesn't exist or has no records
 * This is the default FAQ data for the "Why AthaLink" page
 */

export const DEFAULT_FAQS = [
  {
    id: '1',
    question: 'What does it cost?',
    answer:
      "Coaches set their own session rates depending on experience, availability, and specialty. You'll see the exact price before booking any session.",
    category: 'pricing',
    order: 1,
  },
  {
    id: '2',
    question: 'Can I try multiple coaches?',
    answer:
      "Yes. Many athletes combine specialists (for example, a technical skills coach and a mental performance coach) to create a well-rounded development plan.",
    category: 'coaches',
    order: 2,
  },
  {
    id: '3',
    question: 'What if I need to cancel?',
    answer:
      "Each coach sets their cancellation window, which is clearly displayed before you book. This ensures transparency and flexibility for both parties.",
    category: 'booking',
    order: 3,
  },
  {
    id: '4',
    question: 'Is AthaLink only for soccer and rowing?',
    answer:
      "We're starting with soccer and rowing to build the best possible experience, with more sports coming soon based on athlete and coach demand.",
    category: 'platform',
    order: 4,
  },
];

/**
 * FAQ Type Definition
 */
export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category?: string;
  order?: number;
  created_at?: string;
  updated_at?: string;
}
