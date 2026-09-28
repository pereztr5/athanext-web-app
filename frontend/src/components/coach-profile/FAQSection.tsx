import { useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useFAQItems } from "@/hooks/useFAQItems";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CoachProfileCard, CoachProfileCardHeader, CoachProfileButton } from "./CoachProfileCard";

export interface CoachFaqItem {
  id: string;
  question: string;
  answer: string;
}

export function normalizeCoachFaqs(value: unknown): CoachFaqItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const question = typeof row.question === "string" ? row.question.trim() : "";
      if (!question) return null;
      return {
        id: typeof row.id === "string" && row.id ? row.id : `faq-${index}`,
        question,
        answer: typeof row.answer === "string" ? row.answer : "",
      };
    })
    .filter((item): item is CoachFaqItem => Boolean(item));
}

interface FAQSectionProps {
  type?: string;
  language?: string;
  /** Coach-authored FAQs. When non-empty, these replace platform defaults. */
  coachFaqs?: CoachFaqItem[] | null;
  isEditMode?: boolean;
  onChange?: (faqs: CoachFaqItem[]) => void;
}

function newFaqId() {
  return `faq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function FAQSection({
  type = "general",
  language = "en",
  coachFaqs,
  isEditMode = false,
  onChange,
}: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { data: platformFaqs = [], isLoading: loading, error } = useFAQItems(type);

  const ownedFaqs = Array.isArray(coachFaqs) ? coachFaqs : [];
  const usingOwned = ownedFaqs.length > 0;

  const displayItems: CoachFaqItem[] = usingOwned
    ? ownedFaqs
    : platformFaqs.map((faq) => ({
        id: faq.id,
        question:
          faq.question[language] ||
          faq.question["en"] ||
          Object.values(faq.question)[0] ||
          "",
        answer:
          faq.answer[language] ||
          faq.answer["en"] ||
          Object.values(faq.answer)[0] ||
          "",
      }));

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const updateFaq = (index: number, patch: Partial<CoachFaqItem>) => {
    if (!onChange) return;
    const base =
      ownedFaqs.length > 0
        ? ownedFaqs
        : displayItems.map((item) => ({ ...item, id: item.id.startsWith("faq-") ? item.id : newFaqId() }));
    const next = base.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange(next);
  };

  const addFaq = () => {
    if (!onChange) return;
    const base =
      ownedFaqs.length > 0
        ? ownedFaqs
        : displayItems.map((item) => ({
            ...item,
            id: item.id.startsWith("faq-") ? item.id : newFaqId(),
          }));
    onChange([...base, { id: newFaqId(), question: "", answer: "" }]);
  };

  const removeFaq = (index: number) => {
    if (!onChange) return;
    const base =
      ownedFaqs.length > 0
        ? ownedFaqs
        : displayItems.map((item) => ({
            ...item,
            id: item.id.startsWith("faq-") ? item.id : newFaqId(),
          }));
    onChange(base.filter((_, i) => i !== index));
  };

  if (isEditMode && onChange) {
    const editable = ownedFaqs.length > 0 ? ownedFaqs : [];
    return (
      <CoachProfileCard>
        <CoachProfileCardHeader
          title="FAQ"
          actions={
            <CoachProfileButton variant="primary" onClick={addFaq}>
              <Plus className="mr-1 size-3.5" strokeWidth={1.5} />
              Add
            </CoachProfileButton>
          }
        />
        {editable.length === 0 ? (
          <div className="space-y-3">
            <p className="text-[13px] leading-[18px] text-[#767980]">
              Platform FAQs show by default. Add your own questions to replace them on your
              profile.
            </p>
            {displayItems.length > 0 ? (
              <div className="flex flex-col gap-2 rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] p-3">
                <p className="text-[12px] font-medium text-[#484D56]">Currently showing</p>
                {displayItems.slice(0, 5).map((faq) => (
                  <p key={faq.id} className="text-[12px] text-[#767980]">
                    • {faq.question}
                  </p>
                ))}
                <CoachProfileButton
                  onClick={() =>
                    onChange(
                      displayItems.map((item) => ({
                        id: newFaqId(),
                        question: item.question,
                        answer: item.answer,
                      }))
                    )
                  }
                >
                  Start from these
                </CoachProfileButton>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {editable.map((faq, index) => (
              <div
                key={faq.id}
                className="flex flex-col gap-2 rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] p-3"
              >
                <div className="flex items-start gap-2">
                  <Input
                    value={faq.question}
                    onChange={(e) => updateFaq(index, { question: e.target.value })}
                    placeholder="Question"
                    className="border-[#EAEADF] bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => removeFaq(index)}
                    className="mt-1 shrink-0 rounded-[6px] p-2 text-[#767980] hover:bg-[#EAEADF] hover:text-[#1A202C]"
                    aria-label="Remove FAQ"
                  >
                    <Trash2 className="size-4" strokeWidth={1.5} />
                  </button>
                </div>
                <Textarea
                  value={faq.answer}
                  onChange={(e) => updateFaq(index, { answer: e.target.value })}
                  placeholder="Answer"
                  className="min-h-[64px] border-[#EAEADF] bg-white"
                />
              </div>
            ))}
            <p className="text-[12px] text-[#767980]">
              Saved with <span className="font-medium text-[#484D56]">Save changes</span> at
              the top.
            </p>
          </div>
        )}
      </CoachProfileCard>
    );
  }

  if (loading && !usingOwned) {
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

  if ((error && !usingOwned) || displayItems.length === 0) {
    return (
      <CoachProfileCard>
        <CoachProfileCardHeader title="FAQ" />
        <p
          className={cn(
            "text-[14px] leading-[18px] tracking-[-0.03em]",
            error && !usingOwned ? "text-destructive" : "text-[#A3A6AB]"
          )}
        >
          {error && !usingOwned
            ? "Couldn't load FAQs. Please try again later."
            : "No FAQs yet."}
        </p>
      </CoachProfileCard>
    );
  }

  return (
    <CoachProfileCard>
      <CoachProfileCardHeader title="FAQ" />
      <div className="flex flex-col gap-[10px]">
        {displayItems.map((faq, index) => {
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
                  {faq.question}
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-[#1A202C] transition-transform",
                    open && "rotate-180"
                  )}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </button>
              {open && faq.answer ? (
                <p className="mt-2 text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
                  {faq.answer}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </CoachProfileCard>
  );
}
