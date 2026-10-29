import { CoachBioEditor } from "@/components/coach-profile/CoachBioEditor";
import { formatRichTextForRender } from "@/utils/richText";
import "@/styles/richText.css";
import { CoachProfileCard, CoachProfileCardHeader } from "./CoachProfileCard";
import { cn } from "@/lib/utils";
import { bioText } from "@/components/schedule/styles";

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
          className={bioText}
          dangerouslySetInnerHTML={{ __html: formattedBio }}
        />
      ) : (
        <p className="text-body-m text-dark-300">No biography added yet.</p>
      )}
    </CoachProfileCard>
  );
}
