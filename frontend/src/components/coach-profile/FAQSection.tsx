import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useFAQItems } from "@/hooks/useFAQItems";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CoachProfileCard, CoachProfileCardHeader } from "./CoachProfileCard";

interface FAQSectionProps {
  type?: string;
  language?: string;
}

export function FAQSection({ type = "general", language = "en" }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { data: faqs = [], isLoading: loading, error } = useFAQItems(type);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  if (loading) {
    return (
      <CoachProfileCard>
        <CoachProfileCardHeader title="FAQ" />
        <div className="flex flex-col gap-[10px]" aria-busy="true" aria-label="Loading FAQs">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[14px] w-full rounded-[4px]" />
          ))}
        </div>
      </CoachProfileCard>
    );
  }

  if (error || faqs.length === 0) {
    return (
      <CoachProfileCard>
        <CoachProfileCardHeader title="FAQ" />
        <p className={cn("text-[14px] leading-[18px] tracking-[-0.03em]", error ? "text-destructive" : "text-[#A3A6AB]")}>
          {error ? "Couldn't load FAQs. Please try again later." : "No FAQs yet."}
        </p>
      </CoachProfileCard>
    );
  }

  return (
    <CoachProfileCard>
      <CoachProfileCardHeader title="FAQ" />
      <div className="flex flex-col gap-[10px]">
        {faqs.map((faq, index) => {
          const open = openIndex === index;
          return (
            <div key={faq.id}>
              <button
                type="button"
                onClick={() => toggleFAQ(index)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <span className="text-[12px] font-normal leading-[14px] tracking-[-0.03em] text-[#1A202C]">
                  {faq.question[language] || faq.question["en"] || Object.values(faq.question)[0]}
                </span>
                <ChevronDown
                  className={cn("size-4 shrink-0 text-[#1A202C] transition-transform", open && "rotate-180")}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </button>
              {open && (
                <p className="mt-2 text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
                  {faq.answer[language] || faq.answer["en"] || Object.values(faq.answer)[0]}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </CoachProfileCard>
  );
}
