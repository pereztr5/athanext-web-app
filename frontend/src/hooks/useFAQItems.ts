import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface FAQItem {
  id: string;
  type: string;
  question: Record<string, string>;
  answer: Record<string, string>;
  position: number;
}

export const useFAQItems = (type: string = 'general') => {
  return useQuery({
    queryKey: ['faq-items', type],
    queryFn: async (): Promise<FAQItem[]> => {
      const { data, error } = await supabase
        .from('faq_items')
        .select('*')
        .eq('type', type)
        .order('position', { ascending: true });

      if (error) throw error;

      return (data as any) || [];
    },
    staleTime: Infinity,
  });
};
