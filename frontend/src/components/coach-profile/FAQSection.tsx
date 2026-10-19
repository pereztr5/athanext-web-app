import { useState } from "react";
import { ChevronDown, Plus, Trash2 } from "@/components/icons";
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
            <p className="text-paragraph text-dark-300">
              Platform FAQs show by default. Add your own questions to replace them on your
              profile.
            </p>
            {displayItems.length > 0 ? (
              <div className="flex flex-col gap-2 rounded-control border border-light-525 bg-light-400 p-3">
                <p className="text-label-xsm text-dark-400">Currently showing</p>
                {displayItems.slice(0, 5).map((faq) => (
                  <p key={faq.id} className="text-caption text-dark-300">
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
                className="flex flex-col gap-2 rounded-control border border-light-525 bg-light-400 p-3"
              >
                <div className="flex items-start gap-2">
                  <Input
                    value={faq.question}
                    onChange={(e) => updateFaq(index, { question: e.target.value })}
                    placeholder="Question"
                    className="border-dark-250 bg-light"
                  />
                  <button
                    type="button"
                    onClick={() => removeFaq(index)}
                    className="mt-1 shrink-0 rounded-control p-2 text-dark-300 hover:bg-light-400 hover:text-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    aria-label="Remove FAQ"
                  >
                    <Trash2 className="size-4" strokeWidth={1.5} />
                  </button>
                </div>
                <Textarea
                  value={faq.answer}
                  onChange={(e) => updateFaq(index, { answer: e.target.value })}
                  placeholder="Answer"
                  className="min-h-[64px] border-dark-250 bg-light"
                />
              </div>
            ))}
            <p className="text-caption text-dark-300">
              Saved with <span className="font-medium text-dark-400">Save changes</span> at
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
            <Skeleton key={i} className="h-[14px] w-full rounded-pill" />
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
            "text-body-m",
            error && !usingOwned ? "text-error-700" : "text-dark-300"
          )}
        >
          {error && !usingOwned
            ? "Couldn't load FAQs. Try again later."
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
                className="flex w-full items-center justify-between gap-2 rounded-control text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span className="text-label-sm text-dark">
                  {faq.question}
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-dark transition-transform",
                    open && "rotate-180"
                  )}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </button>
              {open && faq.answer ? (
                <p className="mt-2 text-paragraph-sm text-dark-300">
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
