import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Carousel } from "@/components/coach-profile";
import { CoachVerificationBadge } from "@/components/CoachVerificationBadge";
import { Calendar, MapPin, MessageCircle } from "lucide-react";
import footballCover from "@/assets/images/footballs.png";

interface AthleteHeaderProps {
  athlete: {
    name: string;
    position: string;
    school: string;
    tags: string[];
    classOf: number;
    contact: { location: string };
    summary: string;
    heroImages?: string[];
  };
  sportTheme: {
    buttonClass: string;
    badgeClass: string;
  };
  onBook: () => void;
  onMessage: () => void;
}

export const AthleteHeader = ({
  athlete,
  sportTheme,
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
    <Card className="border-0 shadow-lg">
      <CardContent className="p-0">
        <Carousel photos={photos} altTextPrefix={athlete.name} />
        <div className="flex flex-col gap-4 px-4 pb-6 pt-4 md:px-6">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-primary/30 to-primary/10 text-2xl font-bold text-primary">
              {initials}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold text-slate-900">{athlete.name}</h1>
                <CoachVerificationBadge className="h-5 w-5" />
              </div>
              <p className="text-sm text-muted-foreground">
                {athlete.position} • {athlete.school}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {athlete.tags.map((tag, i) => (
                  <Badge key={`${tag}-${i}`} className={`text-xs ${sportTheme.badgeClass} border`}>
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Class of {athlete.classOf}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {athlete.contact.location}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button className={`${sportTheme.buttonClass} px-8 text-white`} onClick={onBook}>
                  Actively Recruiting
                </Button>
                <Button variant="outline" className="px-6" onClick={onMessage}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Send Message
                </Button>
              </div>
            </div>
          </div>
          {/* Placeholder until copy is finalized */}
          {/* <p className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">{athlete.summary}</p> */}
        </div>
      </CardContent>
    </Card>
  );
};
