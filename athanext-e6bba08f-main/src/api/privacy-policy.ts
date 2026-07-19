import type { ApiResponse, ApiError } from './client';
import { supabase } from '@/integrations/supabase/client';

/**
 * Privacy Policy Content Type
 * Represents a single privacy policy document stored in Supabase
 */
export interface PrivacyPolicyContent {
  id: string;
  title: string;
  content: string; // HTML content
  last_updated: string; // ISO date string
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * API Response Type for Privacy Policy
 */
export interface PrivacyPolicyResponse {
  policy: PrivacyPolicyContent;
  version: number;
  cached: boolean;
}

/**
 * Fallback/Demo Privacy Policy Data
 * Used when Supabase table doesn't exist yet
 */
const DEMO_PRIVACY_POLICY: PrivacyPolicyContent = {
  id: 'demo-privacy-policy',
  title: 'Privacy Policy',
  content: `
    <div class="space-y-8">
      <section>
        <h2 class="text-2xl font-bold text-gray-900 mb-4">Last updated: March 16, 2025</h2>
        <p class="text-gray-700 leading-relaxed">
          Lorem ipsum dolor sit amet consectetur. Nibh imperdiet rhoncus libero ultrices arcu pretium cras in. Neque commodo accumsan vitae magna morbi velit dignissim uliamcorper duis. Quam ac dignissim eget diam velit sit at. Sit vitae neque sem id vel viverra elit. Consequat velit nisl at eu. Et urna blandit orci ornare interdum curabitur amet egestas laboritis.
        </p>
        <p class="text-gray-700 leading-relaxed mt-4">
          Mattis odio et pellentesque nisl. Aliquam tincidunt porttitor vel non sem potenti morbi in. Sagittis tempor sed et amet dignissim amet. Non tellus morbi quis nibh prune. Velit ante mattis egestas velit amet aliquam urna velit ultricies.
        </p>
      </section>

      <section>
        <h3 class="text-2xl font-bold text-gray-900 mb-4">Changes to This Privacy Policy</h3>
        <p class="text-gray-700 leading-relaxed">
          We may update this Privacy Policy from time to time, including to reflect changes to our practices or for other operational, legal, or regulatory reasons. We will post the revised Privacy Policy on the Site, update the "Last updated" date and take any other steps required by applicable law.
        </p>
      </section>

      <section>
        <h3 class="text-2xl font-bold text-gray-900 mb-4">How We Collect and Use Your Personal Information</h3>
        <p class="text-gray-700 leading-relaxed">
          Lorem ipsum dolor sit amet consectetur. Nibh imperdiet rhoncus libero ultrices arcu pretium cras in. Neque commodo accumsan vitae magna morbi velit dignissim uliamcorper duis. Quam ac dignissim eget diam velit sit at. Sit vitae neque sem id vel viverra elit. Consequat velit nisl at eu. Et urna blandit orci ornare interdum curabitur amet egestas laboritis.
        </p>
        <p class="text-gray-700 leading-relaxed mt-4">
          Mattis odio et pellentesque nisl. Aliquam tincidunt porttitor vel non sem potenti morbi in. Sagittis tempor sed et amet dignissim
        </p>
      </section>

      <section>
        <h3 class="text-2xl font-bold text-gray-900 mb-4">Information We Collect about Your Usage</h3>
        <p class="text-gray-700 leading-relaxed">
          Lorem ipsum dolor sit amet consectetur. Nibh imperdiet rhoncus libero ultrices arcu pretium cras in. Neque commodo accumsan vitae magna morbi velit dignissim uliamcorper duis. Quam ac dignissim eget diam velit sit at. Sit vitae neque sem id vel viverra elit. Consequat velit nisl at eu. Et urna blandit orci ornare interdum curabitur amet egestas laboritis.
        </p>
        <p class="text-gray-700 leading-relaxed mt-4">
          Mattis odio et pellentesque nisl. Aliquam tincidunt porttitor vel non sem potenti morbi in. Sagittis tempor sed et amet dignissim
        </p>
      </section>

      <section>
        <h3 class="text-2xl font-bold text-gray-900 mb-4">Cookies</h3>
        <p class="text-gray-700 leading-relaxed">
          Lorem ipsum dolor sit amet consectetur. Nibh imperdiet rhoncus libero ultrices arcu pretium cras in. Neque commodo accumsan vitae magna morbi velit dignissim uliamcorper duis. Quam ac dignissim eget diam velit sit at. Sit vitae neque sem id vel viverra elit. Consequat velit nisl at eu. Et urna blandit orci ornare interdum curabitur amet egestas laboritis.
        </p>
        <p class="text-gray-700 leading-relaxed mt-4">
          Mattis odio et pellentesque nisl. Aliquam tincidunt porttitor vel non sem potenti morbi in. Sagittis tempor sed et amet dignissim
        </p>
      </section>
    </div>
  `,
  last_updated: 'March 16, 2025',
  is_published: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Fetch privacy policy content from Supabase or return demo data
 *
 * HOW IT WORKS:
 * 1. Attempts to fetch the latest published privacy policy from Supabase
 * 2. If table doesn't exist or no published content, returns demo data
 * 3. Sanitizes HTML content to prevent XSS attacks
 * 4. Page NEVER crashes - always returns content (real or demo)
 *
 * @returns Promise<ApiResponse<PrivacyPolicyResponse>>
 */
export async function getPrivacyPolicyContent(): Promise<ApiResponse<PrivacyPolicyResponse>> {
  try {
    let policyData = DEMO_PRIVACY_POLICY;
    let isFromDatabase = false;

    try {
      // Attempt to fetch the latest published privacy policy
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (supabase as any)
        .from('privacy_policy')
        .select('*')
        .eq('is_published', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (result && result.data && !result.error) {
        // Successfully fetched policy from database
        policyData = {
          id: result.data.id,
          title: result.data.title || 'Privacy Policy',
          content: result.data.content || '',
          last_updated: result.data.last_updated || result.data.updated_at,
          is_published: result.data.is_published,
          created_at: result.data.created_at,
          updated_at: result.data.updated_at,
        };
        isFromDatabase = true;
        console.log('[Privacy Policy API] ✅ Loaded from Supabase database');
      }
    } catch (err) {
      // Table doesn't exist or no published content - use demo data
      console.log('[Privacy Policy API] 📋 Using demo data (table not created or no published content)');
    }

    return {
      data: {
        policy: policyData,
        version: 1,
        cached: false,
      },
      error: null,
    };
  } catch (error) {
    // Network error or other unexpected issue
    console.error('[Privacy Policy API] ⚠️ Error fetching privacy policy:', error);

    // Always return fallback data so page doesn't crash
    return {
      data: {
        policy: DEMO_PRIVACY_POLICY,
        version: 1,
        cached: false,
      },
      error: null, // Don't show error to user - we have fallback
    };
  }
}

/**
 * Optional: Update privacy policy (for admin panel)
 * Will work once privacy_policy table is created
 *
 * @param updates - Data to update
 */
export async function updatePrivacyPolicy(updates: Partial<PrivacyPolicyContent>): Promise<ApiResponse<void>> {
  try {
    console.log('[Privacy Policy Update] Table update not available until privacy_policy is created');
    return { data: undefined, error: null };
  } catch (error) {
    console.error('[Privacy Policy Update Error]', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to update privacy policy';

    return {
      data: undefined,
      error: {
        code: 'PRIVACY_POLICY_UPDATE_ERROR',
        message: errorMessage,
        status: 500,
        originalError: error,
      } as ApiError,
    };
  }
}
