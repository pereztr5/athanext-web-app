import { Button } from "@/components/ui/button";
import { BrandPill } from "@/components/brand";
import { PathwayTagChips } from "@/components/common/PathwayTagChips";
import { Carousel } from "@/components/coach-profile";
import { CoachVerificationBadge } from "@/components/coach/CoachVerificationBadge";
import { Calendar, MapPin, MessageCircle } from "lucide-react";
import footballCover from "@/assets/images/footballs.png";

interface AthleteHeaderProps {
  athlete: {
    name: string;
    position: string;
    school: string;
    tags: string[];
    pathwayTags?: string[];
    classOf: number;
    contact: { location: string };
    summary: string;
    heroImages?: string[];
  };
  /** Kept for API compatibility; the brand kit no longer uses sport-coloured chrome. */
  sportTheme: {
    buttonClass: string;
    badgeClass: string;
  };
  onBook: () => void;
  onMessage: () => void;
}

const metaClass = "flex items-center gap-1.5 text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]";

export const AthleteHeader = ({
  athlete,
  onBook,
  onMessage,
}: AthleteHeaderProps) => {
  const photos = [footballCover, ...(athlete.heroImages ?? [])];

  const initials = athlete.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <section className="flex w-full min-w-0 flex-col gap-5 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] pb-[25px] pt-[30px]">
      <Carousel photos={photos} altTextPrefix={athlete.name} />
      <div className="flex flex-col items-start gap-5 sm:flex-row">
        <div
          aria-hidden="true"
          className="flex size-20 shrink-0 items-center justify-center rounded-full border border-[#EAEADF] bg-[#E5EDF7] text-[24px] font-medium tracking-[-0.05em] text-[#0054B4]"
        >
          {initials}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-[10px]">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[32px] font-bold leading-[34px] tracking-[-0.05em] text-[#1A202C]">{athlete.name}</h1>
            <CoachVerificationBadge className="size-5" />
          </div>
          <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#484D56]">
            {[athlete.position, athlete.school].filter(Boolean).join(", ")}
          </p>
          {athlete.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {athlete.tags.map((tag, i) => (
                <BrandPill key={`${tag}-${i}`} tone="neutral">
                  {tag}
                </BrandPill>
              ))}
            </div>
          )}
          <PathwayTagChips selected={athlete.pathwayTags} readOnly />
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <span className={metaClass}>
              <Calendar className="size-4" strokeWidth={1.5} aria-hidden="true" />
              Class of {athlete.classOf}
            </span>
            <span className={metaClass}>
              <MapPin className="size-4" strokeWidth={1.5} aria-hidden="true" />
              {athlete.contact.location}
            </span>
          </div>
          <div className="flex flex-wrap gap-[10px] pt-1">
            <Button onClick={onBook}>Actively recruiting</Button>
            <Button variant="outline" className="gap-1.5" onClick={onMessage}>
              <MessageCircle className="size-4" strokeWidth={1.5} aria-hidden="true" />
              Send message
            </Button>
          </div>
        </div>
      </div>
      {/* Placeholder until copy is finalized */}
      {/* <p className="rounded-[8px] bg-[#F4F4EB] p-4 text-[14px] text-[#484D56]">{athlete.summary}</p> */}
    </section>
  );
};
