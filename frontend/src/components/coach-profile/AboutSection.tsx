import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

import { CoachBioEditor } from "@/components/coach-profile/CoachBioEditor";
import { formatRichTextForRender } from "@/utils/richText";
import "@/styles/richText.css";

interface AboutSectionProps {
  coachName: string;
  bio?: string;
  iconColor: string;
  isEditMode?: boolean;
  onBioChange?: (bio: string) => void;
}

export function AboutSection({ coachName, bio, iconColor, isEditMode = false, onBioChange }: AboutSectionProps) {
  const firstName = coachName?.split(' ')[0] || 'Coach';
  const formattedBio = formatRichTextForRender(bio);

  // const defaultBio = `${coachName} is a dedicated professional coach with extensive experience in their field. They are committed to helping athletes reach their full potential through personalized training programs and expert guidance.`;

  return (
    <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className={`h-5 w-5 ${iconColor}`} />
          About Coach {firstName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEditMode ? (
          <CoachBioEditor
            value={bio ?? ""}
            onChange={onBioChange}
            placeholder="Tell athletes about yourself, your experience, and your coaching philosophy..."
          />
        ) : formattedBio ? (
          <div
            className="rich-text-content text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: formattedBio }}
          />
        ) : (
          <p className="text-muted-foreground leading-relaxed">
            No biography added yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
