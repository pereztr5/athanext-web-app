import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  Video,
  Users,
  Dumbbell,
  Pencil,
  MessageCircle,
  Ship,
} from "lucide-react";
import rowingIcon from "../../assets/images/colored-rowing.png";
import soccerBallIcon from "../../assets/images/colored-soccer.png";
import { SportsPoll } from "@/components/common/SportsPoll";
import { useSportPillars } from "@/hooks/useSportPillars";
import type { Enums } from "@/integrations/supabase/types";
import { useMemo } from "react";
import { useSlowLoading } from "@/hooks/useSlowLoading";

interface SportsSectionProps {
  onSportClick: (sport: string) => void;
}

export const SportsSection = ({ onSportClick }: SportsSectionProps) => {
  const { toast } = useToast();
  const { sportPillars: soccerSportPillars, loading: soccerPillarsLoading } = useSportPillars({
    sport: "soccer" as Enums<"sport_type">,
  });
  const { sportPillars: rowingSportPillars, loading: rowingPillarsLoading } = useSportPillars({
    sport: "rowing" as Enums<"sport_type">,
  });
  const isPillarsSlow = useSlowLoading(soccerPillarsLoading || rowingPillarsLoading, 8000);

  const soccerPillarTitles = useMemo(
    () =>
      (soccerSportPillars ?? [])
        .map((pillar) => pillar.title)
        .filter((title): title is string => Boolean(title && title.trim()))
        .slice(0, 6),
    [soccerSportPillars]
  );

  const rowingPillarTitles = useMemo(
    () => {
      const order = [
        "Technical Development",
        "Race Preparation",
        "Mentorship",
        "Strength + Conditioning",
        "Academic Tutoring",
        "College Recruiting",
      ];
      const titles = (rowingSportPillars ?? [])
        .map((pillar) => pillar.title)
        .filter((title): title is string => Boolean(title && title.trim()));
      const sorted = [...titles].sort((a, b) => {
        const aIndex = order.indexOf(a);
        const bIndex = order.indexOf(b);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
      return sorted.slice(0, 6);
    },
    [rowingSportPillars]
  );

  const getPillarIcon = (title: string, sport: "soccer" | "rowing") => {
    const normalized = title.toLowerCase();
    if (normalized.includes("video")) return Video;
    if (normalized.includes("mentor") || normalized.includes("leader")) return Users;
    if (normalized.includes("strength") || normalized.includes("conditioning") || normalized.includes("performance")) return Dumbbell;
    if (normalized.includes("academic") || normalized.includes("tutor")) return Pencil;
    if (normalized.includes("recruit") || normalized.includes("pathway")) return MessageCircle;
    if (sport === "rowing" && normalized.includes("technical")) return Ship;
    if (normalized.includes("race")) return Activity;
    return Activity;
  };

  const PillarsGrid = ({
    titles,
    sport,
    colorClass,
    isLoading,
  }: {
    titles: string[];
    sport: "soccer" | "rowing";
    colorClass: string;
    isLoading: boolean;
  }) => {
    const placeholders = ["", "", "", "", "", ""];
    const list = isLoading ? placeholders : titles;
    const splitIndex = Math.ceil(list.length / 2);
    const firstColumn = list.slice(0, splitIndex);
    const secondColumn = list.slice(splitIndex);

    const renderItem = (title: string, index: number) => {
      if (!title) {
        return (
          <div key={`pill-skel-${sport}-${index}`} className="flex items-center gap-2 text-sm">
            <div className={`h-4 w-4 rounded bg-slate-200/70 dark:bg-slate-700/60`} />
            <div className="h-4 w-36 rounded bg-slate-200/70 dark:bg-slate-700/60" />
          </div>
        );
      }

      const Icon = getPillarIcon(title, sport);
      return (
        <div
          key={`${sport}-${title}-${index}`}
          className="flex items-center gap-2 text-sm text-muted-foreground group-hover:text-foreground transition-colors"
        >
          <Icon className={`h-4 w-4 flex-shrink-0 ${colorClass}`} />
          <span className="sm:whitespace-nowrap">{title}</span>
        </div>
      );
    };

    return (
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 flex flex-col gap-3">{firstColumn.map(renderItem)}</div>
        <div className="flex-1 flex flex-col gap-3">{secondColumn.map(renderItem)}</div>
      </div>
    );
  };

  const handleVote = (sport: string, emoji: string) => {
    toast({
      title: `Vote Recorded! ${emoji}`,
      description: `Thanks for voting for ${sport}!`,
    });
  };

  return (
    <section id="sports-section" className="w-full h-full px-4 bg-gradient-to-br from-blue-200/50 via-slate-200/40 to-slate-300/30 dark:from-blue-700/50 dark:via-slate-800/40 dark:to-slate-700/30 py-16" aria-labelledby="sports-heading">
      <div className="w-full h-full mx-auto max-w-8xl">
        <div className="text-center mb-8 animate-fade-in">
          <h2 id="sports-heading" className="text-2xl sm:text-4xl font-bold text-black mb-4">
            Start Your Journey
          </h2>
          <p className="text-xs sm:text-lg text-black max-w-2xl mx-auto">
            We're launching with two premier sports, each offering specialized coaching programs designed by elite athletes and certified professionals.
          </p>
          {isPillarsSlow && (
            <p className="mt-3 text-xs sm:text-sm text-muted-foreground">
              This is taking longer than usual. Our servers may be busy.
            </p>
          )}
        </div>

        <div className="w-full h-full flex items-center justify-between flex-col lg:flex-row !gap-5 mx-auto flex-wrap lg:justify-center">
          {/* Soccer Card */}
          <Card
            className="w-full max-w-[27rem] group cursor-pointer transition-all duration-500 hover:shadow-xl hover:-translate-y-3 border-2 hover:border-green-700/50 bg-gradient-to-tl from-green-50 via-sky-50/50 to-white dark:from-blue-950/30 dark:via-sky-950/20 dark:to-cyan-950/30 animate-fade-in hover-scale flex flex-col"
            onClick={() => onSportClick("soccer")}
            role="button"
            tabIndex={0}
            aria-label="Explore soccer coaching programs"
            onKeyDown={(e) => e.key === 'Enter' && onSportClick("soccer")}
          >
            <CardHeader className="text-center pb-4 flex-shrink-0">
              <div className="mx-auto p-3 rounded-full bg-[#4CAF5026]">
                <img src={soccerBallIcon} alt="Soccer ball" />
              </div>
              <CardTitle className="text-2xl font-bold text-foreground transition-colors">Soccer Development</CardTitle>
              <CardDescription className="text-muted-foreground">
                Master the beautiful game with coaching from professional players and elite trainers
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center flex-grow flex flex-col justify-between">
              <PillarsGrid
                titles={soccerPillarTitles}
                sport="soccer"
                colorClass="text-[#1B8A3B]"
                isLoading={soccerPillarsLoading}
              />
              <Badge variant="secondary" className="w-fit mx-auto group-hover:bg-green-600 group-hover:text-primary-foreground transition-colors">Available Now</Badge>
            </CardContent>
          </Card>

          {/* Rowing Card */}
          <Card
            className=" w-full max-w-[27rem] group cursor-pointer transition-all duration-500 hover:shadow-xl hover:-translate-y-3 border-2 hover:border-blue-700/50 bg-gradient-to-tl from-[#78C8FF4D] via-primary-50 to-white dark:from-primary-950/30 dark:via-sky-950/20 dark:to-cyan-950/30 animate-fade-in hover-scale flex flex-col"
            onClick={() => onSportClick("rowing")}
            role="button"
            tabIndex={0}
            aria-label="Explore rowing coaching programs"
            onKeyDown={(e) => e.key === 'Enter' && onSportClick("rowing")}
            style={{ animationDelay: '0.1s' }}
          >
            <CardHeader className="text-center pb-4 flex-shrink-0">
              <div className="mx-auto p-3 bg-[#0A4D8C1A] rounded-full">
                <img src={rowingIcon} alt="Rowing icon" className="mx-auto" />
              </div>
              <CardTitle className="text-2xl font-bold text-foreground group-hover:text-primary-500 transition-colors">Rowing Development</CardTitle>
              <CardDescription className="text-muted-foreground">
                Perfect your stroke and race strategy with Olympic-level coaching expertise
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center flex-grow flex flex-col justify-between">
              <PillarsGrid
                titles={rowingPillarTitles}
                sport="rowing"
                colorClass="text-[#0A4D8C]"
                isLoading={rowingPillarsLoading}
              />
              <Badge variant="secondary" className="w-fit mx-auto group-hover:bg-primary group-hover:text-white transition-colors">Available Now</Badge>
            </CardContent>
          </Card>

          {/* Sports Poll Card */}
          <div className="w-full max-w-[27rem] self-stretch mx-auto lg:mx-0">
            <SportsPoll />
          </div>
        </div>
      </div>
    </section>
  );
};
