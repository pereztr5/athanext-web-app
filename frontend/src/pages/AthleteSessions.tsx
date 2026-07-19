import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CalendarClock,
  Clock4,
  Filter,
  MapPin,
  PlayCircle,
  Search,
  Timer,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ATHLETE_SESSIONS_COACH_SPORT,
  ATHLETE_SESSIONS_CURRENT_ATHLETE_ID,
  ATHLETE_SESSIONS_DATA,
  ATHLETE_SESSIONS_ROWING_PILLARS,
  ATHLETE_SESSIONS_SOCCER_PILLARS,
} from "@/utils/db";
import { getInitialsFromName } from "@/utils/sessionFormatting";
import { RateCoachDialog } from "@/components/reviews/RateCoachDialog";
import type {
  AthleteSession,
  FiltersState,
  LocationType,
  SessionStatus,
  SessionType,
} from "@/types/athlete-sessions";

const DEFAULT_FILTERS: FiltersState = {
  search: "",
  date: "",
  type: "all",
  status: "all",
  locationType: "all",
  sportPillar: "all",
};

const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatTime = (iso: string) => {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const formatDurationMinutes = (startIso: string, endIso: string) => {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const diffMs = end.getTime() - start.getTime();
  return Math.max(Math.round(diffMs / 60000), 0);
};

const getStartMeta = (iso: string, now: Date) => {
  const diffMs = new Date(iso).getTime() - now.getTime();
  if (diffMs <= 0) {
    return { isUrgent: false, startsIn: null as string | null };
  }
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const isUrgent = diffMs <= 30 * 60 * 1000;
  const startsIn = `${hours > 0 ? `${hours}h ` : ""}${remainingMinutes}m`;
  return { isUrgent, startsIn };
};

const typeBadgeStyles = (type: SessionType) =>
  type === "Group"
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-orange-50 text-orange-700 border-orange-200";

const locationBadgeStyles = (locationType: LocationType) =>
  locationType === "Online"
    ? "bg-purple-50 text-purple-700 border-purple-200"
    : "bg-emerald-50 text-emerald-700 border-emerald-200";

const COLOR_MAP = {
  emerald: "text-emerald-700",
  blue: "text-blue-700",
  slate: "text-slate-600",
} as const;

const SectionHeader = ({
  icon,
  title,
  count,
  color,
}: {
  icon: ReactNode;
  title: string;
  count: number;
  color: "emerald" | "blue" | "slate";
}) => {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-5 w-5", COLOR_MAP[color])}>{icon}</span>
      <p className={cn("text-base font-semibold", COLOR_MAP[color])}>{title}</p>
      <span className={cn("text-sm font-semibold", COLOR_MAP[color])}>{count}</span>
    </div>
  );
};

const SessionCard = ({
  session,
  now,
  onSelect,
}: {
  session: AthleteSession;
  now: Date;
  onSelect: (session: AthleteSession) => void;
}) => {
  const isInProgress = session.status === "in-progress";
  const palette = isInProgress
    ? {
        border: "border-emerald-200",
        background: "bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50",
        rateBg: "bg-white/60 border-emerald-200 text-emerald-700",
        button: "bg-emerald-600 hover:bg-emerald-700",
      }
    : {
        border: "border-blue-100",
        background: "bg-gradient-to-br from-white via-slate-50 to-blue-50/60",
        rateBg: "bg-blue-50 border-blue-100 text-blue-700",
        button: "bg-blue-600 hover:bg-blue-700",
      };

  const startMeta = session.status === "upcoming" ? getStartMeta(session.start, now) : null;

  return (
    <Card
      className={cn("rounded-2xl border transition-all cursor-pointer", palette.border, palette.background)}
      onClick={() => onSelect(session)}
    >
      <CardContent className="pt-5 space-y-4">
        {isInProgress && (
          <div className="rounded-xl bg-emerald-100/90 border border-emerald-200 text-emerald-800 px-4 py-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            <span className="text-sm font-medium">Session in progress</span>
          </div>
        )}
        {!isInProgress && startMeta?.startsIn && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 flex items-center gap-2">
            <Timer className="h-4 w-4" />
            <span className="text-sm font-medium">Starting in {startMeta.startsIn}</span>
          </div>
        )}
        <div className="flex flex-col lg:grid lg:grid-cols-[1.15fr_1fr_auto] lg:items-start lg:gap-6 gap-5">
          <div className="space-y-3">
            <div className="flex items-center flex-wrap gap-2">
              <p className="text-lg font-semibold text-slate-900">{session.title}</p>
              <Badge variant="outline" className={cn("rounded-full", typeBadgeStyles(session.type))}>
                {session.type}
              </Badge>
              <Badge variant="outline" className={cn("rounded-full", locationBadgeStyles(session.locationType))}>
                {session.locationType === "Online" ? "Online" : "In Person"}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <CalendarClock className="h-4 w-4 text-blue-600" />
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">Date &amp; Time</span>
                  <div className="text-sm text-slate-800">
                    <div>{formatDate(session.start)}</div>
                    <div>
                      {formatTime(session.start)} - {formatTime(session.end)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4 text-blue-600" />
              <div className="space-y-0.5">
                <span className="text-xs text-muted-foreground">Coach</span>
                <div className="text-sm text-slate-800">{session.coach}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start justify-center gap-3">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-xs text-muted-foreground">Location</span>
                <div className="text-sm text-slate-800">{session.location}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-3 min-w-[180px]">
            <div className={cn("rounded-xl px-4 py-3 text-right border", palette.rateBg)}>
              <p className="text-xs">Rate</p>
              <p className="text-lg font-semibold">{formatCurrency(session.rate)}</p>
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

const PastSessionCard = ({
  session,
  onSelect,
  onRate,
}: {
  session: AthleteSession;
  onSelect: (session: AthleteSession) => void;
  onRate: (session: AthleteSession) => void;
}) => (
  <Card className="border border-slate-200 rounded-2xl cursor-pointer" onClick={() => onSelect(session)}>
    <CardContent className="py-4 px-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-slate-900">{session.title}</p>
            <Badge variant="outline" className={cn("rounded-full", typeBadgeStyles(session.type))}>
              {session.type}
            </Badge>
            <Badge variant="outline" className={cn("rounded-full", locationBadgeStyles(session.locationType))}>
              {session.locationType}
            </Badge>
            {session.tags?.map((tag) => (
              <Badge key={tag} variant="outline" className="rounded-full bg-slate-100 text-slate-700">
                {tag}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              <span>
                {formatDate(session.start)} | {formatTime(session.start)} - {formatTime(session.end)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{session.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>{session.coach}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-start md:items-end gap-2 min-w-[140px]">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-800">
              {formatCurrency(session.rate)}
              <span className="text-xs text-muted-foreground">/athlete</span>
            </p>
          </div>
          <Button
            className="rounded-full px-4 h-10"
            variant="outline"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(session);
            }}
          >
            View Details
          </Button>
          <Button
            className="rounded-full px-4 h-10 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={(event) => {
              event.stopPropagation();
              onRate(session);
            }}
          >
            Rate Coach
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
);

const SessionDetailsContent = ({
  session,
  onClose,
}: {
  session: AthleteSession;
  onClose: () => void;
}) => {
  if (session.status === "past") {
    return (
      <div className="bg-slate-50">
        <div className="px-6 pt-6 pb-2 flex items-center gap-3">
          <Button variant="ghost" className="h-10 w-10 rounded-full border" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="text-2xl font-semibold text-slate-900">Session Details</p>
            <p className="text-sm text-muted-foreground">View feedback and session information</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1.2fr] gap-5">
            <Card className="border border-slate-200 rounded-2xl">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-slate-900">{session.title}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={cn("rounded-full", typeBadgeStyles(session.type))}>
                        {session.type}
                      </Badge>
                      <Badge className="rounded-full bg-emerald-50 text-emerald-700 border-emerald-200">
                        You Attended
                      </Badge>
                    </div>
                  </div>
                  <div className="rounded-xl bg-blue-600 text-white px-4 py-2 text-center min-w-[96px]">
                    <p className="text-xs">Rate</p>
                    <p className="text-lg font-semibold">{formatCurrency(session.rate)}</p>
                  </div>
                </div>
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-start gap-3 text-sm text-slate-800">
                    <CalendarClock className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Date &amp; Time</p>
                      <p className="text-muted-foreground">
                        {formatDate(session.start)} | {formatTime(session.start)} - {formatTime(session.end)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-slate-800">
                    <MapPin className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Location</p>
                      <p className="text-muted-foreground">{session.location}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-slate-800">
                    <Clock4 className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Duration</p>
                      <p className="text-muted-foreground">
                        {formatDurationMinutes(session.start, session.end)} min
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 rounded-2xl">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-blue-600 font-semibold text-lg">$</span>
                  <p className="text-lg font-semibold text-slate-900">Payment Details</p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 space-y-1">
                  <p className="text-xs text-emerald-700 font-semibold">Status</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-emerald-700">{formatCurrency(session.rate)}</span>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Paid</Badge>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Session Fee</span>
                    <span className="font-semibold">{formatCurrency(session.rate)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Payment Date</span>
                    <span className="font-semibold">{formatDate(session.end)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Method</span>
                    <span className="font-semibold">Card  ���� 4242</span>
                  </div>
                </div>
                <button type="button" className="text-blue-600 text-sm font-medium hover:underline">
                  Download Receipt
                </button>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
            <Card className="border border-slate-200 rounded-2xl">
              <CardContent className="p-5 space-y-3">
                <p className="text-lg font-semibold text-slate-900">Coach's Session Summary</p>
                <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-slate-800">
                  Fantastic session everyone! We focused heavily on shot-stopping techniques including diving,
                  positioning, and reflexes. The group showed great energy and enthusiasm. Keep up the excellent work!
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 rounded-2xl">
              <CardContent className="p-5 space-y-3">
                <p className="text-lg font-semibold text-slate-900">Your Coach</p>
                <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white">
                        {getInitialsFromName(session.coach)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{session.coach}</p>
                      <p className="text-xs text-muted-foreground">Soccer Coach</p>
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-800">
                  {`${session.coach.toLowerCase().replace(/\s+/g, ".")}@example.com`}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="text-right">
            <Button className="rounded-full" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-[#0d7ff2] text-white px-6 py-5">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl font-semibold leading-tight">{session.title}</DialogTitle>
          <DialogDescription className="text-sm text-white/90">
            Session details for you and your coach
          </DialogDescription>
        </DialogHeader>
      </div>
      <div className="p-6 space-y-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("rounded-full", typeBadgeStyles(session.type))}>
              {session.type}
            </Badge>
            <Badge variant="outline" className={cn("rounded-full", locationBadgeStyles(session.locationType))}>
              {session.locationType}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <CalendarClock className="w-5 h-5 text-blue-600 mt-1" />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Date &amp; Time</p>
                <p className="text-sm text-slate-800">
                  {formatDate(session.start)} | {formatTime(session.start)} - {formatTime(session.end)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-blue-600 mt-1" />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="text-sm text-slate-800">{session.location}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-blue-600 mt-1" />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Coach</p>
                <p className="text-sm text-slate-800">{session.coach}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock4 className="w-5 h-5 text-blue-600 mt-1" />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="text-sm text-slate-800 capitalize">{session.status.replace("-", " ")}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-green-200 bg-green-50 p-5 space-y-2">
          <p className="text-xs font-semibold text-green-700">SESSION RATE</p>
          <p className="text-xl font-semibold text-green-700">{formatCurrency(session.rate)} per athlete</p>
          <p className="text-sm text-green-700/80">This rate applies only to your booking</p>
        </div>

        <div className="text-center">
          <Button variant="outline" className="rounded-full px-6 w-full" onClick={onClose}>
            Close
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            Make sure you're ready at the location with all necessary equipment
          </p>
        </div>
      </div>
    </>
  );
};

const AthleteSessions = () => {
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [now, setNow] = useState(() => new Date());
  const [selectedSession, setSelectedSession] = useState<AthleteSession | null>(null);
  const [ratingSession, setRatingSession] = useState<AthleteSession | null>(null);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const athleteSessions = useMemo(
    () =>
      ATHLETE_SESSIONS_DATA.filter(
        (session) => session.athleteId === ATHLETE_SESSIONS_CURRENT_ATHLETE_ID
      ),
    []
  );

  const { inProgressSessions, upcomingSessions, pastSessions } = useMemo(() => {
    const searchTerm = filters.search.toLowerCase();
    const selectedDate = filters.date ? new Date(filters.date).toDateString() : null;
    const grouped = {
      "in-progress": [] as AthleteSession[],
      upcoming: [] as AthleteSession[],
      past: [] as AthleteSession[],
    };

    athleteSessions.forEach((session) => {
      const matchesSearch =
        session.title.toLowerCase().includes(searchTerm) ||
        session.location.toLowerCase().includes(searchTerm) ||
        session.coach.toLowerCase().includes(searchTerm);

      const matchesDate = selectedDate
        ? new Date(session.start).toDateString() === selectedDate
        : true;

      const matchesType = filters.type === "all" || session.type.toLowerCase() === filters.type;
      const matchesStatus = filters.status === "all" || session.status === filters.status;
      const matchesLocation =
        filters.locationType === "all" ||
        session.locationType.toLowerCase() === filters.locationType;

      const matchesPillar =
        filters.sportPillar === "all"
          ? true
          : (session.sportPillars ?? []).some(
              (pillar) => pillar.toLowerCase() === filters.sportPillar.toLowerCase()
            );

      if (matchesSearch && matchesDate && matchesType && matchesStatus && matchesLocation && matchesPillar) {
        grouped[session.status].push(session);
      }
    });

    return {
      inProgressSessions: grouped["in-progress"],
      upcomingSessions: grouped.upcoming,
      pastSessions: grouped.past,
    };
  }, [athleteSessions, filters]);

  const handleFilterChange =
    (key: keyof FiltersState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setFilters((prev) => ({ ...prev, [key]: event.target.value }));
    };

  const handleSubmitRating = async () => {
    if (!ratingSession) return;
    setIsSubmittingRating(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 350));
      setRatingSession(null);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-40 px-4 lg:px-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">My Sessions</h1>
          <p className="text-sm text-muted-foreground">
            View your upcoming sessions and feedback from coaches. Only your sessions are shown here.
          </p>
        </div>

        <Card className="border border-slate-200 rounded-2xl">
          <CardHeader className="pb-3 flex-row items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base text-slate-700">Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <div className="relative">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Search Sessions ..."
                  className="pl-9 rounded-xl"
                  value={filters.search}
                  onChange={handleFilterChange("search")}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <Input
                  type="date"
                  className="rounded-xl"
                  value={filters.date}
                  onChange={handleFilterChange("date")}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Session Type</label>
                <select
                  value={filters.type}
                  onChange={handleFilterChange("type")}
                  className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="all">All Types</option>
                  <option value="group">Group</option>
                  <option value="individual">Individual</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Session Status</label>
                <select
                  value={filters.status}
                  onChange={handleFilterChange("status")}
                  className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="all">All Sessions</option>
                  <option value="in-progress">In Progress</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="past">Past</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Location Type</label>
                <select
                  value={filters.locationType}
                  onChange={handleFilterChange("locationType")}
                  className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="all">All Locations</option>
                  <option value="in person">In Person</option>
                  <option value="online">Online</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Sport Pillar</label>
                <select
                  value={filters.sportPillar}
                  onChange={handleFilterChange("sportPillar")}
                  className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="all">All Pillars</option>
                  {(ATHLETE_SESSIONS_COACH_SPORT === "soccer"
                    ? ATHLETE_SESSIONS_SOCCER_PILLARS
                    : ATHLETE_SESSIONS_ROWING_PILLARS
                  ).map((pillar) => (
                    <option key={pillar} value={pillar.toLowerCase()}>
                      {pillar}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <SectionHeader
            icon={<PlayCircle className="h-5 w-5" />}
            title="In-Progress Sessions"
            count={inProgressSessions.length}
            color="emerald"
          />
          <div className="space-y-3">
            {inProgressSessions.length ? (
              inProgressSessions.map((session) => (
                <SessionCard key={session.id} session={session} now={now} onSelect={setSelectedSession} />
              ))
            ) : (
              <div className="text-sm text-muted-foreground flex items-center gap-2 bg-white p-4 rounded-xl border">
                <AlertCircle className="h-4 w-4" />
                No sessions in progress.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <SectionHeader
            icon={<Clock4 className="h-5 w-5" />}
            title="Upcoming Sessions"
            count={upcomingSessions.length}
            color="blue"
          />
          <div className="space-y-3">
            {upcomingSessions.length ? (
              upcomingSessions.map((session) => (
                <SessionCard key={session.id} session={session} now={now} onSelect={setSelectedSession} />
              ))
            ) : (
              <div className="text-sm text-muted-foreground flex items-center gap-2 bg-white p-4 rounded-xl border">
                <AlertCircle className="h-4 w-4" />
                No upcoming sessions.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <SectionHeader
            icon={<AlertCircle className="h-5 w-5" />}
            title="Past Sessions"
            count={pastSessions.length}
            color="slate"
          />
          <div className="space-y-3">
            {pastSessions.length ? (
              pastSessions.map((session) => (
                <PastSessionCard
                  key={session.id}
                  session={session}
                  onSelect={setSelectedSession}
                  onRate={(target) => {
                    setRatingSession(target);
                    setRating(5);
                    setHoverRating(null);
                  }}
                />
              ))
            ) : (
              <div className="text-sm text-muted-foreground flex items-center gap-2 bg-white p-4 rounded-xl border">
                <AlertCircle className="h-4 w-4" />
                No past sessions.
              </div>
            )}
          </div>
        </div>

        <div className="h-12 lg:h-16" aria-hidden="true" />
      </div>

      <Dialog open={Boolean(selectedSession)} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          {selectedSession && (
            <SessionDetailsContent session={selectedSession} onClose={() => setSelectedSession(null)} />
          )}
        </DialogContent>
      </Dialog>

      <RateCoachDialog
        open={Boolean(ratingSession)}
        session={ratingSession}
        coachSport={ATHLETE_SESSIONS_COACH_SPORT}
        rating={rating}
        hoverRating={hoverRating}
        comment={comment}
        isSubmitting={isSubmittingRating}
        onSubmit={handleSubmitRating}
        onCancel={() => {
          setRatingSession(null);
          setHoverRating(null);
        }}
        onRatingChange={(newValue) => setRating(newValue)}
        onHoverChange={(newValue) => setHoverRating(newValue)}
        onHoverLeave={() => setHoverRating(null)}
        onCommentChange={(newValue) => setComment(newValue)}
        formatDate={formatDate}
        formatTime={formatTime}
      />
    </div>
  );
};

export default AthleteSessions;
