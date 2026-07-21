import type { ApiResponse, ApiError } from './client';
import { supabase } from '@/integrations/supabase/client';
import type {
  AboutValue,
  TeamMember,
  AboutHeroSection,
  AboutMissionVisionSection,
  AboutStoryStat,
  AboutStory,
  AboutData,
} from '@/types/about';
export type {
  AboutValue,
  TeamMember,
  AboutHeroSection,
  AboutMissionVisionSection,
  AboutStoryStat,
  AboutStory,
  AboutData,
};
import { ABOUT_PAGE_DATA } from '@/utils/db';

/**
 * Fallback/Demo About Data
 * Used when:
 * 1. Tables don't exist yet in Supabase (Temporary)
 * 2. API fails to fetch data
 * 3. No data returned from database
 *
 * This data is now imported from utils/db.js as ABOUT_PAGE_DATA
 */

const DEMO_ABOUT_DATA = ABOUT_PAGE_DATA;

/**
 * Main endpoint: Fetch all About page data in one call
 *
 * HOW IT WORKS:
 * 1. First, tries to fetch from Supabase tables (if they exist)
 * 2. If tables don't exist or query fails, uses fallback demo data
 * 3. When adding the tables, simply restart and it will use real data
 * 4. Page NEVER crashes - always shows content
 *
 * IMPORTANT: This function is designed to work immediately
 *
 * @returns Promise<ApiResponse<AboutData>>
 */
export async function getAboutPageData(): Promise<ApiResponse<AboutData>> {
  try {
    // Try to fetch from Supabase tables
    let storyData = DEMO_ABOUT_DATA.story;
    let valuesData = DEMO_ABOUT_DATA.values;
    let teamData = DEMO_ABOUT_DATA.team;

    try {
      // Attempt to fetch story from about_story table
      const storyResult = await (supabase as any)
        .from('about_story')
        .select('*')
        .eq('is_active', true)
        .single();

      if (storyResult && storyResult.data && !storyResult.error) {
        // Story found in database
        const dbStory = storyResult.data;
        
        // Parse paragraphs - can be string or array
        let paragraphs: string[] = [];
        if (dbStory.paragraphs) {
          if (typeof dbStory.paragraphs === 'string') {
            paragraphs = dbStory.paragraphs.split('\n').filter((p: string) => p.trim());
          } else if (Array.isArray(dbStory.paragraphs)) {
            paragraphs = dbStory.paragraphs;
          }
        }
        
        // Parse stats - can be JSON string or array
        let stats: AboutStoryStat[] = [];
        if (dbStory.stats) {
          if (typeof dbStory.stats === 'string') {
            try {
              stats = JSON.parse(dbStory.stats);
            } catch (e) {
              console.error('[About API] Failed to parse stats JSON:', e);
              stats = [];
            }
          } else if (Array.isArray(dbStory.stats)) {
            stats = dbStory.stats;
          }
        }
        
        storyData = {
          id: dbStory.id,
          brand_name: dbStory.brand_name || 'AthaNext',
          title: dbStory.title || 'Our Story',
          tagline: dbStory.tagline || '',
          description: dbStory.description || '',
          paragraphs,
          image_url: dbStory.image_url,
          stats,
        };
      }
    } catch (err) {
      // Table doesn't exist or no data - that's OK, use fallback
    }

    // Fetch values and team members from about_items table
    try {
      const itemsResult = await (supabase as any)
        .from('about_items')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (itemsResult && itemsResult.data && !itemsResult.error) {
        // Parse team members
        const teamMembers = itemsResult.data
          .filter((item: any) => item.item_type === 'team_member')
          .map((item: any) => {
            let metadata = {};
            try {
              metadata = typeof item.metadata === 'string' 
                ? JSON.parse(item.metadata) 
                : item.metadata || {};
            } catch (e) {
              console.error('[About API] Failed to parse team member metadata:', e);
            }

            return {
              id: item.id,
              title: item.title,
              description: item.description,
              image_url: item.image_url,
              position: (metadata as any).position || '',
            };
          });

        if (teamMembers.length > 0) {
          teamData = teamMembers;
        }

        // Parse values
        const values = itemsResult.data
          .filter((item: any) => item.item_type === 'value')
          .map((item: any) => {
            let metadata = {};
            try {
              metadata = typeof item.metadata === 'string' 
                ? JSON.parse(item.metadata) 
                : item.metadata || {};
            } catch (e) {
              console.error('[About API] Failed to parse value metadata:', e);
            }

            return {
              id: item.id,
              title: item.title,
              description: item.description,
              icon_name: (metadata as any).icon_name || 'Circle',
            };
          });

        if (values.length > 0) {
          valuesData = values;
        }
      }
    } catch (err) {
      // Table doesn't exist or no data - that's OK, use fallback
    }

    // Return data with fetched or fallback story
    const result: AboutData = {
      ...DEMO_ABOUT_DATA,
      story: storyData,
      values: valuesData,
      team: teamData,
    };

    return {
      data: result,
      error: null,
    };
  } catch (error) {
    // Network error or other unexpected issue
    console.error('[About API] Error fetching about data:', error);

    // Always return fallback data so page doesn't crash
    return {
      data: DEMO_ABOUT_DATA,
      error: null, // Don't show error to user - we have fallback
    };
  }
}
