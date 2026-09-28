import { CoachBioEditor } from "@/components/coach-profile/CoachBioEditor";
import { formatRichTextForRender } from "@/utils/richText";
import "@/styles/richText.css";
import { CoachProfileCard, CoachProfileCardHeader } from "./CoachProfileCard";

interface AboutSectionProps {
  coachName: string;
  bio?: string;
  /** @deprecated no longer used by the brand-kit card */
  iconColor?: string;
  isEditMode?: boolean;
  onBioChange?: (bio: string) => void;
}

export function AboutSection({ coachName, bio, isEditMode = false, onBioChange }: AboutSectionProps) {
  const firstName = coachName?.split(" ")[0] || "coach";
  const formattedBio = formatRichTextForRender(bio);

  return (
    <CoachProfileCard className="gap-6">
      <CoachProfileCardHeader title={`About ${firstName}`} />
      {isEditMode ? (
        <CoachBioEditor
          value={bio ?? ""}
          onChange={onBioChange}
          placeholder="Tell athletes about yourself, your experience and your coaching approach"
        />
      ) : formattedBio ? (
        <div
          className="rich-text-content text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-[#484D56]"
          dangerouslySetInnerHTML={{ __html: formattedBio }}
        />
      ) : (
        <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#A3A6AB]">No biography added yet.</p>
      )}
    </CoachProfileCard>
  );
}
