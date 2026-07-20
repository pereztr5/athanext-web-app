import { memo } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Athlete } from "@/types/sessions";

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const getAvatarForName = (name: string) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
    name
  )}&backgroundColor=edf2ff,ffe4e6,e0f2fe,fef3c7`;

type AthleteListProps = {
  athletes: Athlete[];
  totalAthletes: number;
};

const AthleteList = memo(({ athletes, totalAthletes }: AthleteListProps) => (
  <div className="flex items-center gap-2 flex-wrap">
    {athletes.map((athlete) => (
      <div
        key={athlete.id}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-sm"
      >
        <Avatar className="h-8 w-8 border">
          <AvatarImage src={athlete.avatar ?? getAvatarForName(athlete.name)} alt={athlete.name} />
          <AvatarFallback className="bg-slate-100 text-slate-700 text-xs">
            {getInitials(athlete.name)}
          </AvatarFallback>
        </Avatar>
        <span className="text-xs font-medium text-slate-700 pr-1">{athlete.name}</span>
      </div>
    ))}
    {totalAthletes > athletes.length && (
      <Badge variant="outline" className="rounded-full border-dashed text-xs">
        +{totalAthletes - athletes.length} more
      </Badge>
    )}
  </div>
));

AthleteList.displayName = "AthleteList";

export default AthleteList;
