import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FAQItem {
  id: string;
  type: string;
  question: Record<string, string>;
  answer: Record<string, string>;
  position: number;
}

export const useFAQItems = (type: string = 'general') => {
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFAQs = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('faq_items' as any)
          .select('*')
          .eq('type', type)
          .order('position', { ascending: true });

        if (error) throw error;

        setFaqs((data as any) || []);
      } catch (err) {
        console.error('Error fetching FAQs:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch FAQs');
      } finally {
        setLoading(false);
      }
    };

    fetchFAQs();
  }, [type]);

  return { faqs, loading, error };
};
