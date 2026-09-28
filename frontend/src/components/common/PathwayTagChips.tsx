import { BrandPill } from "@/components/brand";
import {
  MAX_PATHWAY_TAGS,
  PATHWAY_TAGS,
  sanitizePathwayTags,
  type PathwayTag,
} from "@/constants/pathwayTags";
import { cn } from "@/lib/utils";

type PathwayTagChipsProps = {
  selected: string[] | null | undefined;
  onChange?: (tags: PathwayTag[]) => void;
  suggestions?: PathwayTag[];
  readOnly?: boolean;
  className?: string;
};

/** Multi-select pathway chips; readOnly renders BrandPills only. */
export function PathwayTagChips({
  selected,
  onChange,
  suggestions = [],
  readOnly = false,
  className,
}: PathwayTagChipsProps) {
  const current = sanitizePathwayTags(selected);

  if (readOnly) {
    if (current.length === 0) return null;
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        {current.map((tag) => (
          <BrandPill key={tag} tone="teal">
            {tag}
          </BrandPill>
        ))}
      </div>
    );
  }

  const toggle = (tag: PathwayTag) => {
    if (!onChange) return;
    const next = new Set(current);
    if (next.has(tag)) next.delete(tag);
    else if (next.size < MAX_PATHWAY_TAGS) next.add(tag);
    onChange(sanitizePathwayTags(Array.from(next)));
  };

  const acceptSuggestion = (tag: PathwayTag) => {
    if (!onChange || current.includes(tag) || current.length >= MAX_PATHWAY_TAGS) return;
    onChange(sanitizePathwayTags([...current, tag]));
  };

  const pendingSuggestions = suggestions.filter((tag) => !current.includes(tag));

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap gap-2">
        {PATHWAY_TAGS.map((tag) => {
          const isOn = current.includes(tag);
          const atLimit = !isOn && current.length >= MAX_PATHWAY_TAGS;
          return (
            <button
              key={tag}
              type="button"
              disabled={atLimit}
              onClick={() => toggle(tag)}
              className={cn(
                "rounded-[4px] px-2 py-[3px] text-[12px] font-medium leading-[13px] tracking-[-0.03em] transition-colors",
                isOn
                  ? "bg-[#E7F4F8] text-[#1599BC] ring-1 ring-[#1599BC]/40"
                  : "bg-[#F1F1E6] text-[#484D56] hover:bg-[#EAEADF]",
                atLimit && "cursor-not-allowed opacity-40"
              )}
              aria-pressed={isOn}
            >
              {tag}
            </button>
          );
        })}
      </div>
      {pendingSuggestions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
            Suggested from age / graduation — tap to add
          </p>
          <div className="flex flex-wrap gap-2">
            {pendingSuggestions.map((tag) => (
              <button
                key={`suggest-${tag}`}
                type="button"
                onClick={() => acceptSuggestion(tag)}
                className="rounded-[4px] border border-dashed border-[#CCDDF0] bg-[#E5EDF7]/60 px-2 py-[3px] text-[12px] font-medium leading-[13px] tracking-[-0.03em] text-[#0054B4]"
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <p className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#A3A6AB]">
        Up to {MAX_PATHWAY_TAGS} pathway tags ({current.length}/{MAX_PATHWAY_TAGS})
      </p>
    </div>
  );
}
