import { CalendarClock, MapPin, Users } from "lucide-react";

import AthleteList from "@/components/my-session/AthleteList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Session } from "@/types/sessions";

type PastDraftCardProps = {
  session: Session;
  onSelect: (session: Session) => void;
  onPastNavigate: () => void;
};

const PastDraftCard = ({ session, onSelect, onPastNavigate }: PastDraftCardProps) => {
  const badgeColor =
    session.status === "draft"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";
  return (
    <Card
      className="border border-slate-200 rounded-2xl cursor-pointer shadow-none"
      onClick={() => {
        if (session.status === "past") {
          onPastNavigate();
        } else {
          onSelect(session);
        }
      }}
    >
      <CardContent className="py-4 px-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold text-slate-900">{session.title}</p>
              <Badge variant="outline" className="rounded-full bg-slate-100 text-slate-700">
                {session.type}
              </Badge>
              <Badge className={cn("rounded-full border", badgeColor)}>
                {session.status === "draft" ? "Draft" : "Completed"}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                <span>
                  {new Date(session.start).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  •{" "}
                  {new Date(session.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} -{" "}
                  {new Date(session.end).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{session.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>
                  {session.totalAthletes} {session.totalAthletes === 1 ? "athlete" : "athletes"}
                </span>
              </div>
            </div>
            <AthleteList athletes={session.athletes} totalAthletes={session.totalAthletes} />
          </div>
          <div className="flex flex-col items-start md:items-end gap-2 min-w-[140px]">
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-800">
                ${session.rate.toFixed(2)}
                <span className="text-xs text-muted-foreground">/athlete</span>
              </p>
            </div>
            <Button
              className="rounded-full px-4 h-10"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                if (session.status === "past") {
                  onPastNavigate();
                } else {
                  onSelect(session);
                }
              }}
            >
              {session.status === "draft" ? "Continue Editing" : "Add Feedback"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PastDraftCard;
