import { AlertTriangle, CalendarClock, Clock4, MapPin, Timer, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import AthleteList from "@/components/my-session/AthleteList";
import type { Session } from "@/types/sessions";

const getStartMeta = (iso: string, now: Date) => {
  const diffMs = new Date(iso).getTime() - now.getTime();
  if (diffMs <= 0) {
    return { isUrgent: false, countdown: null as string | null, startsIn: null as string | null };
  }
  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const isUrgent = diffMs <= 30 * 60 * 1000;
  const countdown = isUrgent ? `${minutes}m ${seconds.toString().padStart(2, "0")}s` : null;
  const startsIn = `${hours > 0 ? `${hours}h ` : ""}${remainingMinutes}m`;
  return { isUrgent, countdown, startsIn };
};

type SessionCardProps = {
  session: Session;
  now: Date;
  onSelect: (session: Session) => void;
};

const SessionCard = ({ session, now, onSelect }: SessionCardProps) => {
  const startMeta = session.status === "upcoming" ? getStartMeta(session.start, now) : null;
  const isUrgent = Boolean(startMeta?.isUrgent && startMeta.countdown);
  const isInProgress = session.status === "in-progress";
  const statusBadge =
    session.status === "in-progress"
      ? { label: "Session in progress", color: "bg-emerald-50 text-emerald-700 border-emerald-200" }
      : session.status === "draft"
      ? { label: "Draft", color: "bg-amber-50 text-amber-700 border-amber-200" }
      : session.status === "past"
      ? { label: "Completed", color: "bg-emerald-50 text-emerald-700 border-emerald-200" }
      : { label: "Upcoming", color: "bg-blue-50 text-blue-700 border-blue-200" };

  const palette = isInProgress
    ? {
        border: "border-emerald-300",
        background: "bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40",
        bar: "bg-emerald-100/80 border-emerald-200 text-emerald-800",
        icon: "text-emerald-600",
        rateBg: "bg-white/70 border-emerald-200",
        rateText: "text-emerald-700",
        button: "bg-emerald-600 hover:bg-emerald-700 shadow-[0_8px_18px_rgba(16,185,129,0.25)]",
      }
    : {
        border: isUrgent ? "border-rose-200" : "border-blue-100",
        background: isUrgent
          ? "bg-gradient-to-br from-rose-50 via-orange-50 to-white"
          : "bg-gradient-to-br from-white via-slate-50 to-blue-50/50",
        bar: isUrgent ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-blue-50 border-blue-200 text-blue-700",
        icon: isUrgent ? "text-rose-600" : "text-blue-600",
        rateBg: "bg-blue-50 border-blue-100",
        rateText: "text-blue-700",
        button: isUrgent
          ? "bg-rose-600 hover:bg-rose-700"
          : "bg-blue-600 hover:bg-blue-700 shadow-[0_8px_18px_rgba(37,99,235,0.22)]",
      };

  return (
    <Card
      className={cn(
        "rounded-2xl border transition-all cursor-pointer shadow-none",
        palette.border,
        palette.background
      )}
      onClick={() => onSelect(session)}
    >
      <CardContent className="pt-5 space-y-4">
        {isUrgent && (
          <div className={cn("flex items-center gap-2 text-sm rounded-xl px-3 py-2", palette.bar)}>
            <AlertTriangle className={cn("h-4 w-4", palette.icon)} />
            <span className="font-medium">Urgent: Session starting soon!</span>
            {startMeta?.countdown && (
              <Badge className="ml-auto bg-white text-rose-700 border-rose-200">
                {startMeta.countdown}
              </Badge>
            )}
          </div>
        )}
        {isInProgress && (
          <div className="rounded-lg bg-emerald-100/80 border border-emerald-200 text-emerald-800 px-4 py-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            <span className="text-sm font-medium">Session in progress</span>
          </div>
        )}
        <div className="flex flex-col lg:grid lg:grid-cols-[1.3fr_1.1fr_auto] lg:items-start lg:gap-6 gap-5">
          <div className="space-y-3">
            <div className="flex items-center flex-wrap gap-2">
              <p className="text-lg font-semibold text-slate-900">{session.title}</p>
              <Badge variant="outline" className="rounded-full bg-slate-100 text-slate-700">
                {session.type}
              </Badge>
              {!isInProgress && (
                <Badge className={cn("rounded-full border", statusBadge.color)}>{statusBadge.label}</Badge>
              )}
              {startMeta?.startsIn && !isUrgent && !isInProgress && (
                <Badge className="rounded-full bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
                  <Clock4 className="h-4 w-4" />
                  Starting in {startMeta.startsIn}
                </Badge>
              )}
            </div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <CalendarClock className={cn("h-4 w-4", palette.icon)} />
              <div className="space-y-0.5">
                <span className="text-xs text-muted-foreground">Date &amp; Time</span>
                <div className="text-sm text-slate-800">
                  <div>{new Date(session.start).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</div>
                  <div>
                    {new Date(session.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} -{" "}
                    {new Date(session.end).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Users className={cn("h-4 w-4", palette.icon)} />
              <div className="space-y-2 w-full">
                <div className="text-xs text-muted-foreground">Athletes ({session.totalAthletes})</div>
                <AthleteList athletes={session.athletes} totalAthletes={session.totalAthletes} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className={cn("h-4 w-4", palette.icon)} />
              <div className="space-y-0.5">
                <span className="text-xs text-muted-foreground">Location</span>
                <div className="text-sm text-slate-800">{session.location}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-3 min-w-[180px]">
            <div className={cn("rounded-xl px-4 py-3 text-right border shadow-sm", palette.rateBg)}>
              <p className={cn("text-xs", palette.rateText)}>Rate</p>
              <p className={cn("text-lg font-semibold", palette.rateText)}>${session.rate.toFixed(2)}</p>
              <p className="text-[11px] text-muted-foreground">per athlete</p>
            </div>
            <Button
              className={cn("rounded-full px-5 h-10 text-sm font-semibold", palette.button)}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(session);
              }}
            >
              View Details
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SessionCard;
