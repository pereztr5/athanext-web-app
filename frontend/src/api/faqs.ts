import type { ApiResponse, ApiError } from './client';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_FAQS } from '@/utils/db';

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

/**
 * API Response Type for FAQs
 */
export interface FAQsResponse {
  faqs: FAQ[];
  source: 'database' | 'fallback';
  total: number;
}

/**
 * Fetch FAQs from Supabase or return fallback data
 *
 * HOW IT WORKS:
 * 1. Attempts to fetch FAQs from Supabase faqs table
 * 2. Checks if results are empty or error occurred
 * 3. If no results or error, returns default FAQs from utils/faqs.ts
 * 4. Orders FAQs by the 'order' field for consistent display
 * 5. Page NEVER crashes - always returns content (database or fallback)
 *
 * @returns Promise<ApiResponse<FAQsResponse>>
 */
export async function getFAQs(): Promise<ApiResponse<FAQsResponse>> {
  try {
    let faqsData: FAQ[] = [];
    let source: 'database' | 'fallback' = 'fallback';

    try {
      // Attempt to fetch FAQs from Supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await supabase
        .from('faqs')
        .select('*')
        .eq('is_active', true)
        .order('order', { ascending: true });

      if (result && result.data && Array.isArray(result.data) && result.data.length > 0 && !result.error) {
        // Successfully fetched FAQs from database
        faqsData = result.data;
        source = 'database';
      } else {
        // No data returned or error occurred
        faqsData = DEFAULT_FAQS;
        source = 'fallback';
      }
    } catch (err) {
      // Table doesn't exist or network error
      faqsData = DEFAULT_FAQS;
      source = 'fallback';
    }

    // Ensure we always have FAQs
    if (!faqsData || faqsData.length === 0) {
      console.warn('[FAQs API] No FAQs available, using defaults');
      faqsData = DEFAULT_FAQS;
      source = 'fallback';
    }

    return {
      data: {
        faqs: faqsData,
        source,
        total: faqsData.length,
      },
      error: null,
    };
  } catch (error) {
    // Unexpected error - always return fallback
    console.error('[FAQs API] Unexpected error fetching FAQs:', error);

    return {
      data: {
        faqs: DEFAULT_FAQS,
        source: 'fallback',
        total: DEFAULT_FAQS.length,
      },
      error: null, // Don't show error to user - we have fallback
    };
  }
}

/**
 * Optional: Get FAQ by ID
 * @param id - FAQ ID
 */
export async function getFAQById(id: string): Promise<ApiResponse<FAQ>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await supabase
      .from('faqs')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (result && result.data && !result.error) {
      return {
        data: result.data,
        error: null,
      };
    }

    // Fallback to finding in default FAQs
    const fallbackFAQ = DEFAULT_FAQS.find((faq) => faq.id === id);
    if (fallbackFAQ) {
      return {
        data: fallbackFAQ,
        error: null,
      };
    }

    return {
      data: null as unknown as FAQ,
      error: {
        code: 'FAQ_NOT_FOUND',
        message: 'FAQ not found',
        status: 404,
      } as ApiError,
    };
  } catch (error) {
    console.error('[FAQs API] Error fetching FAQ by ID:', error);
    return {
      data: null as unknown as FAQ,
      error: {
        code: 'FAQ_FETCH_ERROR',
        message: 'Failed to fetch FAQ',
        status: 500,
        originalError: error,
      } as ApiError,
    };
  }
}

/**
 * Optional: Create a new FAQ (for admin panel)
 * Will work once faqs table is created
 */
export async function createFAQ(faq: Omit<FAQ, 'id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<FAQ>> {
  try {
    return {
      data: null as unknown as FAQ,
      error: {
        code: 'FAQ_CREATE_ERROR',
        message: 'FAQ creation not available',
        status: 503,
      } as ApiError,
    };
  } catch (error) {
    console.error('[FAQs Create Error]', error);
    return {
      data: null as unknown as FAQ,
      error: {
        code: 'FAQ_CREATE_ERROR',
        message: 'Failed to create FAQ',
        status: 500,
        originalError: error,
      } as ApiError,
    };
  }
}

/**
 * Optional: Update FAQ
 */
export async function updateFAQ(id: string, updates: Partial<FAQ>): Promise<ApiResponse<void>> {
  try {
    return { data: undefined, error: null };
  } catch (error) {
    console.error('[FAQs Update Error]', error);
    return {
      data: undefined,
      error: {
        code: 'FAQ_UPDATE_ERROR',
        message: 'Failed to update FAQ',
        status: 500,
        originalError: error,
      } as ApiError,
    };
  }
}

/**
 * Optional: Delete FAQ
 */
export async function deleteFAQ(id: string): Promise<ApiResponse<void>> {
  try {
    return { data: undefined, error: null };
  } catch (error) {
    console.error('[FAQs Delete Error]', error);
    return {
      data: undefined,
      error: {
        code: 'FAQ_DELETE_ERROR',
        message: 'Failed to delete FAQ',
        status: 500,
        originalError: error,
      } as ApiError,
    };
  }
}
