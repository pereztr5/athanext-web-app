import { Button } from "@/components/ui/button";
import { BrandPill } from "@/components/brand";
import { PathwayTagChips } from "@/components/common/PathwayTagChips";
import { Carousel } from "@/components/coach-profile";
import { CoachVerificationBadge } from "@/components/coach/CoachVerificationBadge";
import { Calendar, MapPin, MessageCircle } from "@/components/icons";
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

const metaClass = "flex items-center gap-1.5 text-body-m text-dark-300";

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
    <section className="flex w-full min-w-0 flex-col gap-5 rounded-card border border-light-525 bg-light-300 px-[25px] pb-[25px] pt-[30px]">
      <Carousel photos={photos} altTextPrefix={athlete.name} />
      <div className="flex flex-col items-start gap-5 sm:flex-row">
        <div
          aria-hidden="true"
          className="flex size-20 shrink-0 items-center justify-center rounded-full border border-light-525 bg-primary-50 text-section text-primary"
        >
          {initials}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-[10px]">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-page-title-phone md:text-page-title text-dark">{athlete.name}</h1>
            <CoachVerificationBadge className="size-5" />
          </div>
          <p className="text-body-m text-dark-300">
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
      {/* <p className="rounded-control bg-light-400 p-4 text-paragraph text-dark-300">{athlete.summary}</p> */}
    </section>
  );
};
