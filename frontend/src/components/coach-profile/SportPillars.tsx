import { Medal, UtilityPole } from "lucide-react";
import type { Enums } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SportPillarsProps {
  sport?: Enums<"sport_type"> | string | null;
  pillars?: any[];
  iconColor?: string;
  pillarBg?: string;
  isLoading?: boolean;
  loadError?: string | null;
}

export function SportPillars({
  sport,
  pillars = [],
  isLoading = false,
  loadError = null,
  iconColor = "text-green-600",
  pillarBg = "bg-green-50 dark:bg-green-900/20",
}: SportPillarsProps) {


  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="col-span-2 text-sm text-muted-foreground">
          Loading sport pillars...
        </div>
      );
    }

    if (loadError) {
      return (
        <div className="col-span-2 text-sm text-muted-foreground">
          {loadError}
        </div>
      );
    }

    if (pillars?.length) {
      return pillars.map((pillar) => (
        <div
          key={pillar.id}
          className={`flex items-start gap-3 p-3 ${pillarBg} rounded-lg`}
        >
          <Medal className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold block">{pillar.name}</span>
            <span className="text-xs text-muted-foreground block">
              {pillar.description}
            </span>
            <span className="text-xs font-medium text-muted-foreground block truncate">
              {pillar.category}
            </span>
          </div>
        </div>
      ));
    }

    return (
      <div className="col-span-2 text-sm text-muted-foreground">
        {sport ? "No sport pillars available yet." : "Sport information is unavailable."}
      </div>
    );
  };

  return (
    <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UtilityPole className={`h-5 w-5 ${iconColor}`} />
          Holistic Development Pillars
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-4">
          {renderContent()}
        </div>
      </CardContent>
    </Card>
  );
}
