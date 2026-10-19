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
                "rounded-pill border px-2 py-[3px] text-label-xsm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:border-light-525 disabled:bg-light-400 disabled:text-dark-200",
                isOn
                  ? "border-secondary-300 bg-secondary-100 text-secondary-700"
                  : "border-light-525 bg-light-400 text-dark-400 hover:bg-light-200"
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
          <p className="text-caption text-dark-300">
            Suggested from age and graduation year. Tap to add
          </p>
          <div className="flex flex-wrap gap-2">
            {pendingSuggestions.map((tag) => (
              <button
                key={`suggest-${tag}`}
                type="button"
                onClick={() => acceptSuggestion(tag)}
                className="rounded-pill border border-dashed border-primary-300 bg-primary-50 px-2 py-[3px] text-label-xsm text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <p className="text-caption text-dark-300">
        Up to {MAX_PATHWAY_TAGS} pathway tags ({current.length}/{MAX_PATHWAY_TAGS})
      </p>
    </div>
  );
}
