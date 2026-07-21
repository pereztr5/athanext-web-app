import { useState } from "react";
import { useFAQItems } from "@/hooks/useFAQItems";
import { ChevronDown, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FAQSectionProps {
  type?: string;
  language?: string;
}

export function FAQSection({ type = 'general', language = 'en' }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { data: faqs = [], isLoading: loading, error } = useFAQItems(type);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  if (loading) {
    return (
      <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg">FAQ</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || faqs.length === 0) {
    return (
      <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg">FAQ</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            {error ? 'Failed to load FAQs' : 'No FAQs available at this time.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg">FAQ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {faqs.map((faq, index) => (
          <div key={faq.id} className="border-b last:border-b-0 pb-3 last:pb-0">
            <button
              onClick={() => toggleFAQ(index)}
              className="flex items-start justify-between w-full text-left group"
            >
              <span className="text-sm font-medium pr-2">
                {faq.question[language] || faq.question['en'] || Object.values(faq.question)[0]}
              </span>
              <ChevronDown 
                className={`h-4 w-4 flex-shrink-0 transition-transform ${
                  openIndex === index ? 'rotate-180' : ''
                }`}
              />
            </button>
            {openIndex === index && (
              <p className="text-sm text-muted-foreground mt-2">
                {faq.answer[language] || faq.answer['en'] || Object.values(faq.answer)[0]}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
