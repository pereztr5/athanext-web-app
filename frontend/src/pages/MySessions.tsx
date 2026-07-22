import type { ReactNode } from "react";
import { memo, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CalendarClock,
  ChevronDown,
  Clock,
  Clock4,
  Filter,
  MapPin,
  PlayCircle,
  Search,
  Users,
  Home as HomeIcon,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { capitalizeFirst, cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useMySessions } from "@/hooks/useMySessions";
import { useAthleteAvatarsByNames } from "@/hooks/useAthleteAvatars";
import { useCoachAvatarsByIds } from "@/hooks/useCoachAvatars";
import { useToast } from "@/hooks/use-toast";
import { useFeeConfig } from "@/hooks/useFeeConfig";
import { useProfile } from "@/contexts/ProfileContext";
import { useSportPillars } from "@/hooks/useSportPillars";
import { RateCoachDialog } from "@/components/reviews/RateCoachDialog";
import { SessionsSkeleton } from "@/components/my-session/SessionsSkeleton";
import {
  upsertSlotFeedback,
  getExistingFeedback,
  getSubmittedFeedbackIds,
  getCoachSubmittedSessionIds,
} from "@/api/sessions";
import { ERROR_CODES } from "@/constants/errorCodes";
import type { SessionFilters, SessionUIModel } from "@/types/sessions-api";
import type { UISession } from "@/types/my-sessions";
import {
  formatSessionDate,
  formatSessionPrice,
  formatSessionTime,
  formatISOTime,
  getAvatarUrlFromName,
  getInitialsFromName,
  getStartMeta,
  formatLocationDisplay,
} from "@/utils/sessionFormatting";
import { PROFILE_TYPE } from "@/utils/db";
import { ROUTES } from "@/routes";
import type { Enums } from "@/integrations/supabase/types";
import { resolvePillarIcon } from "@/utils/pillarIcons";

type UserRole = typeof PROFILE_TYPE.coach | typeof PROFILE_TYPE.athlete | null;


const MAX_ATHLETE_PILLS = 5;

const AthleteList = memo(({ athletes, totalAthletes }: { athletes: { id: string; name: string; avatar?: string | null }[]; totalAthletes: number }) => {
  const visibleAthletes = athletes.slice(0, MAX_ATHLETE_PILLS);
  const remainingCount = Math.max(totalAthletes - visibleAthletes.length, 0);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {visibleAthletes.map((athlete) => (
        <div
          key={athlete.id}
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-sm"
        >
          <Avatar className="h-8 w-8 border">
            <AvatarImage src={athlete.avatar ?? getAvatarUrlFromName(athlete.name)} alt={athlete.name} />
            <AvatarFallback className="bg-slate-100 text-slate-700 text-xs">
              {getInitialsFromName(athlete.name)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium text-slate-700 pr-1">{athlete.name}</span>
        </div>
      ))}
      {remainingCount > 0 && (
        <Badge variant="outline" className="rounded-full border-dashed text-xs">
          +{remainingCount} more
        </Badge>
      )}
    </div>
  );
});

AthleteList.displayName = "AthleteList";

const calculatePlatformFee = (
  rate: number | null | undefined,
  platformFeePerc = 0,
  stripeFeePerc = 0
) => {
  const baseRate = Number(rate) || 0;
  const totalFeePerc = (platformFeePerc || 0) + (stripeFeePerc || 0);
  const platformFee = baseRate * (totalFeePerc / 100);
  const totalRate = baseRate + platformFee;
  return { baseRate, platformFee, totalRate };
};

const SessionCard = ({
  session,
  now,
  onSelect,
  role,
  resolvePillarIcon,
  submittedSessionIds,
  onFeedbackNavigate,
  platformFeePerc = 0,
  stripeFeePerc = 0,
}: {
  session: UISession;
  now: Date;
  onSelect: (session: UISession) => void;
  role: UserRole;
  resolvePillarIcon: (pillarName?: string | null) => typeof AlertCircle;
  submittedSessionIds: Set<string>;
  onFeedbackNavigate: (slotId: string, session?: UISession) => void;
  platformFeePerc?: number;
  stripeFeePerc?: number;
}) => {
  const startMeta = session.computedStatus === "upcoming" ? getStartMeta(session.start, now) : null;
  const isUrgent = Boolean(startMeta?.isUrgent && startMeta.countdown);
  const isInProgress = session.computedStatus === "in-progress";
  const statusBadge =
    session.computedStatus === "in-progress"
      ? { label: "Session in progress", color: "bg-emerald-50 text-emerald-700 border-emerald-200" }
      : session.computedStatus === "completed"
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

  const hasSubmittedFeedback = (session: UISession): boolean => {
    // Server flags are source of truth: coach uses session-level, athlete uses slot-level
    return role === PROFILE_TYPE.coach ? Boolean(session.hasSessionFeedback) : Boolean(session.hasSlotFeedback);
  };
  const feedbackSubmitted = hasSubmittedFeedback(session);
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
          <div className="rounded-xl bg-emerald-100/80 border border-emerald-200 text-emerald-800 px-4 py-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            <span className="text-sm font-medium">Session in progress</span>
          </div>
        )}
        <div className="flex flex-col lg:grid lg:grid-cols-[1.3fr_1.1fr_auto] lg:items-start lg:gap-6 gap-5">
          <div className="space-y-3">
            <div className="flex items-center flex-wrap gap-2">
              <p className="text-lg font-semibold text-slate-900">{capitalizeFirst(session.title)}</p>
              <Badge variant="outline" className="rounded-full bg-slate-100 text-slate-700">
                {capitalizeFirst(session.type)}
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
                  <div>{formatSessionDate(session.dateOnly)}</div>
                  <div>{session.timeRange}</div>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Users className={cn("h-4 w-4", palette.icon)} />
              <div className="space-y-2 w-full">
                {role === PROFILE_TYPE.coach ? (
                  <>
                    <div className="text-xs text-muted-foreground">
                      Athletes ({session.totalAthletes})
                    </div>
                    <AthleteList athletes={session.athletes} totalAthletes={session.totalAthletes} />
                  </>
                ) : (
                  <>
                    <div className="text-xs text-muted-foreground">Coach</div>
                    {session.coachName && (
                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                        <Avatar className="h-6 w-6 border border-slate-200">
                          <AvatarImage
                            src={session.coachAvatar ?? getAvatarUrlFromName(session.coachName || "Coach")}
                            alt={session.coachName}
                          />
                          <AvatarFallback className="bg-slate-100 text-slate-700 text-[10px]">
                            {getInitialsFromName(session.coachName || "Coach")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-slate-900">{session.coachName}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className={cn("h-4 w-4", palette.icon)} />
              <div className="space-y-0.5">
                <span className="text-xs text-muted-foreground">Location Type</span>
                <div className="text-sm text-slate-800">{formatLocationDisplay(session.location)}</div>
              </div>
            </div>
            {session.pillarSlot && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                {(() => {
                  const PillarIcon = resolvePillarIcon(session.pillarSlot);
                  return <PillarIcon className={cn("h-4 w-4", palette.icon)} />;
                })()}
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">Pillar</span>
                  <div className="text-sm text-slate-800">{session.pillarSlot}</div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col items-start lg:items-end gap-3 min-w-[180px]">
            <div
              className={cn(
                "rounded-xl px-4 py-3 text-right border shadow-sm",
                palette.rateBg
              )}
            >
              {role === PROFILE_TYPE.athlete ? (
                <div className="space-y-1">
                  <p className={cn("text-xs", palette.rateText)}>Rate (per athlete)</p>
                  <p className={cn("text-lg font-semibold", palette.rateText)}>
                    {formatSessionPrice(calculatePlatformFee(session.rate, platformFeePerc, stripeFeePerc).totalRate, session.currency)}
                  </p>
                </div>
              ) : (
                <>
                  <p className={cn("text-xs", palette.rateText)}>
                    Rate
                  </p>
                  <p className={cn("text-lg font-semibold", palette.rateText)}>
                    {formatSessionPrice(session.rate, session.currency)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">per Athlete</p>
                </>
              )}
            </div>
          <div className="flex flex-col gap-2">
              <Button
                className={cn(
                  "rounded-full h-10 min-w-[160px] px-5 text-sm font-semibold flex items-center justify-center",
                  palette.button
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(session);
                }}
            >
              View Details
            </Button>

          </div>
        </div>
      </div>
      </CardContent>
    </Card>
  );
};

const PastDraftCard = ({
  session,
  onSelect,
  onPastNavigate,
  onFeedbackNavigate,
  role,
  resolvePillarIcon,
  hasFeedbackSubmitted,
  platformFeePerc = 0,
  stripeFeePerc = 0,
}: {
  session: UISession;
  onSelect: (session: UISession) => void;
  onPastNavigate: (session: UISession) => void;
  onFeedbackNavigate: (slotId: string, session?: UISession) => void;
  role: 'coach' | 'athlete' | null;
  resolvePillarIcon: (pillarName?: string | null) => typeof AlertCircle;
  hasFeedbackSubmitted: boolean;
  platformFeePerc?: number;
  stripeFeePerc?: number;
}) => {
  const badgeColor = session.computedStatus === "completed"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-emerald-50 text-emerald-700 border-emerald-200";
  return (
    <Card
      className="border border-slate-200 rounded-2xl cursor-pointer shadow-none"
      onClick={() => {
        if (session.computedStatus === "past" || session.computedStatus === "completed") {
          if (role === PROFILE_TYPE.coach) {
            onPastNavigate(session);
          } else {
            onSelect(session);
          }
        } else {
          onSelect(session);
        }
      }}
    >
      <CardContent className="py-4 px-5">
        <div className="flex flex-col md:flex-row md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold text-slate-900">{capitalizeFirst(session.title)}</p>
              <Badge variant="outline" className="rounded-full bg-slate-100 text-slate-700">
                {capitalizeFirst(session.type)}
              </Badge>
              <Badge className={cn("rounded-full border", badgeColor)}>
                {session.computedStatus === "completed" ? "Completed" : "Past"}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                <span>
                  {formatSessionDate(session.dateOnly)} • {session.timeRange}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{formatLocationDisplay(session.location)}</span>
              </div>
              {session.pillarSlot && (
                <div className="flex items-center gap-2">
                  {(() => {
                    const PillarIcon = resolvePillarIcon(session.pillarSlot);
                    return <PillarIcon className="h-4 w-4" />;
                  })()}
                  <span>{session.pillarSlot}</span>
                </div>
              )}
              {role === PROFILE_TYPE.coach && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>
                    {session.totalAthletes} {session.totalAthletes === 1 ? "Athlete" : "Athletes"}
                  </span>
                </div>
              )}
            </div>
            {role === PROFILE_TYPE.coach && (
              <AthleteList athletes={session.athletes} totalAthletes={session.totalAthletes} />
            )}
            {role === PROFILE_TYPE.athlete && session.coachName && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-400" />
                  <span className="text-xs text-muted-foreground">Coach</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                  <Avatar className="h-6 w-6 border border-slate-200">
                    <AvatarImage
                      src={session.coachAvatar ?? getAvatarUrlFromName(session.coachName || "Coach")}
                      alt={session.coachName}
                    />
                    <AvatarFallback className="bg-slate-100 text-slate-700 text-[10px]">
                      {getInitialsFromName(session.coachName || "Coach")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-slate-900">{session.coachName}</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col items-start md:items-end gap-2 min-w-[140px]">
            {role === PROFILE_TYPE.athlete ? (
              <div className="text-right space-y-1">
                <p className="text-xs text-muted-foreground">Total per Athlete</p>
                <p className="text-sm font-semibold text-slate-800">
                  {formatSessionPrice(calculatePlatformFee(session.rate, platformFeePerc, stripeFeePerc).totalRate, session.currency)}
                </p>
              </div>
            ) : (
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-800">
                  {formatSessionPrice(session.rate, session.currency)}
                  <span className="text-xs text-muted-foreground">/Athlete</span>
                </p>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {(session.computedStatus === "past" || session.computedStatus === "completed") ? (
                <>
                  <Button
                    className="rounded-full h-10 min-w-[160px] px-4 flex items-center justify-center text-white gap-2 bg-primary"
                    variant="outline"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (role === PROFILE_TYPE.coach) {
                        onPastNavigate(session);
                      } else {
                        onSelect(session);
                      }
                    }}
                  >
                    View Details
                  </Button>
                  <Button
                    className={cn(
                      "rounded-full h-10 min-w-[160px] px-4 flex items-center justify-center gap-2",
                      hasFeedbackSubmitted && "bg-green-50 border-green-200 text-green-700"
                    )}
                    variant="outline"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (session.id) {
                        onFeedbackNavigate(session.id, session);
                      }
                    }}
                  >
                    {hasFeedbackSubmitted ? (
                      <>
                        <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        View Feedback
                      </>
                    ) : (
                      "Add Feedback"
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  className="rounded-full h-10 min-w-[160px] px-4 flex items-center justify-center gap-2"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(session);
                  }}
                >
                  View Details
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const MySessions = () => {
  const navigate = useNavigate();
  const { userProfile, loading: authLoading, initialCheckComplete } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<SessionFilters>({
    search: "",
    date: "",
    type: "all",
    status: "all",
    locationType: "all",
    pillar: "all",
  });
  const [now, setNow] = useState(() => new Date());
  const [selectedSession, setSelectedSession] = useState<UISession | null>(null);
  const [upcomingOpen, setUpcomingOpen] = useState(true);
  const [pastOpen, setPastOpen] = useState(true);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [rateSession, setRateSession] = useState<UISession | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [coachComment, setCoachComment] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [submittedSessionIds, setSubmittedSessionIds] = useState<Set<string>>(new Set());
  const [existingFeedback, setExistingFeedback] = useState<{ rating: number; comment: string | null; created_at: string } | null>(null);
  const [isLoadingExistingFeedback, setIsLoadingExistingFeedback] = useState(false);
  const { platformFeePerc, stripeFeePerc } = useFeeConfig();

  const { toast } = useToast();

  const { role: persona } = useRole();
  const athleteProfileId = userProfile?.athlete_id || userProfile?.id || null;
  const coachProfileId = userProfile?.coach_id || null;
  const role = useMemo<UserRole>(() => {
    if (persona === PROFILE_TYPE.coach) return PROFILE_TYPE.coach;
    if (persona === PROFILE_TYPE.athlete || persona === PROFILE_TYPE.parent) return PROFILE_TYPE.athlete;
    return null;
  }, [persona]);

  const sessionSport = useMemo<Enums<'sport_type'> | undefined>(() => {
    const sportValue = (profile?.data as any)?.sport || (profile?.userProfile as any)?.sport;
    if (!sportValue) return undefined;
    const normalized = sportValue.toString().toLowerCase();
    if (normalized.includes("row")) return "rowing";
    if (["soccer", "football", "scoccer"].some((s) => normalized.includes(s))) return "soccer";
    return undefined;
  }, [profile?.data, profile?.userProfile]);

  const { sportPillars } = useSportPillars({ sport: sessionSport, autoFetch: !!sessionSport });

  const resolvePillarIconForSession = useMemo(
    () => (pillarName?: string | null) => resolvePillarIcon(pillarName, sessionSport, sportPillars) ?? AlertCircle,
    [sessionSport, sportPillars]
  );

  const { grouped, filterSessions, isLoading, error } = useMySessions(role ?? undefined);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Fetch existing feedback when dialog opens
  useEffect(() => {
    const fetchExistingFeedback = async () => {
      if (rateDialogOpen && rateSession?.bookingId && athleteProfileId) {
        setIsLoadingExistingFeedback(true);
        setExistingFeedback(null);
        
        const { data, error } = await getExistingFeedback(
          rateSession.bookingId,
          athleteProfileId,
          rateSession.coachId
        );
        
        if (error) {
          console.error('Error fetching existing feedback:', error);
        } else if (data) {
          // Pre-fill form with existing feedback
          setExistingFeedback(data);
          setRating(data.rating);
          setCoachComment(data.comment || "");
          // Mark this session as already submitted
          setSubmittedSessionIds((prev) => {
            const next = new Set(prev);
            if (rateSession.id) next.add(rateSession.id);
            if (rateSession.slotId) next.add(rateSession.slotId);
            if (rateSession.bookingId) next.add(rateSession.bookingId);
            return next;
          });
        } else {
          // No existing feedback, reset form
          setRating(0);
          setCoachComment("");
        }
        
        setIsLoadingExistingFeedback(false);
      } else if (!rateDialogOpen) {
        // Reset when dialog closes
        setExistingFeedback(null);
        setIsLoadingExistingFeedback(false);
      }
    };

    fetchExistingFeedback();
  }, [rateDialogOpen, rateSession?.bookingId, rateSession?.id, athleteProfileId]);

  // Preload submitted feedback status so buttons show "Feedback Submitted" without opening dialog
  useEffect(() => {
    const fetchSubmittedFeedback = async () => {
      if (role === PROFILE_TYPE.athlete) {
        if (!athleteProfileId) return;
        const result = await getSubmittedFeedbackIds(athleteProfileId);
        if (result.data) {
          const submittedIds = new Set<string>();
          result.data.forEach((entry) => {
            if (entry.slot_id) {
              submittedIds.add(entry.slot_id);
            }
            if (entry.booking_id) {
              submittedIds.add(entry.booking_id);
            }
          });
          setSubmittedSessionIds(submittedIds);
        } else if (result.error) {
          console.error("Failed to preload submitted feedback ids:", result.error);
        }
        return;
      }

      if (role === PROFILE_TYPE.coach) {
        const coachIdentifier = userProfile?.coach_id || userProfile?.id;
        if (!coachIdentifier) return;

        const sessionFeedbackResult = await getCoachSubmittedSessionIds(coachIdentifier);
        const submittedIds = new Set<string>();

        if (sessionFeedbackResult.data) {
          sessionFeedbackResult.data.forEach((entry) => {
            if (entry.slot_id) {
              submittedIds.add(entry.slot_id);
              // Also add to safeguard if session id equals slot id
              submittedIds.add(entry.slot_id);
            }
          });
        } else if (sessionFeedbackResult.error) {
          console.error("Failed to preload coach session feedback ids:", sessionFeedbackResult.error);
        }

        setSubmittedSessionIds(submittedIds);
        return;
      }

      // Default fallback: clear when persona not resolved
      setSubmittedSessionIds(new Set());
    };

    fetchSubmittedFeedback();
  }, [role, athleteProfileId, userProfile?.coach_id]);

  const { mutate: submitCoachFeedback, isPending: isSubmittingCoachFeedback } = useMutation({
    mutationFn: async () => {
      if (!rateSession || !athleteProfileId) return;
      
      // For athlete feedback, we need the booking_id
      // The booking_id should be populated from the RPC response
      if (!rateSession.bookingId) {
        console.error('❌ Missing bookingId in rateSession:', rateSession);
        throw new Error('Missing booking ID - this session may not have been properly loaded. Please refresh and try again.');
      }
      
      const result = await upsertSlotFeedback([
        {
          booking_id: rateSession.bookingId,
          slot_id: rateSession.id,
          athlete_id: athleteProfileId,
          coach_id: rateSession.coachId,
          rating,
          comment: coachComment || null,
        },
      ]);

      if (result.error) {
        // Surface a clearer message for common RLS/permission errors
        const msg =
          result.error.code === String(ERROR_CODES.RLS_PERMISSION_DENIED) ||
          (result.error.message && result.error.message.toLowerCase().includes('row-level security'))
            ? 'You do not have permission to submit feedback for this booking.'
            : result.error.message || 'Failed to submit feedback.';
        throw new Error(msg);
      }

      return result;
    },
    onSuccess: () => {
      toast({
        title: "Feedback Submitted",
        description: (
          <div className="space-y-1 text-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-emerald-600 text-base">✓</span>
              <span className="font-semibold text-slate-900">Thank you for your feedback.</span>
            </div>
            <p className="text-sm">Your coach will review it to improve future sessions.</p>
          </div>
        ),
        duration: 5000,
      });
      // Track this session as having submitted feedback
      if (rateSession?.id) {
        setSubmittedSessionIds((prev) => {
          const next = new Set(prev);
          if (rateSession.id) next.add(rateSession.id);
          if (rateSession.slotId) next.add(rateSession.slotId);
          if (rateSession.bookingId) next.add(rateSession.bookingId);
          if (rateSession.occurrenceId) next.add(rateSession.occurrenceId);
          return next;
        });
      }
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      setFeedbackSubmitted(true);
      // Close dialog after a brief delay to show the state
      setTimeout(() => {
        setRateDialogOpen(false);
        setFeedbackSubmitted(false);
      }, 1500);
    },
    onError: (error: Error) => {
      toast({
        title: "Error Submitting Feedback",
        description: error.message || "Failed to submit your feedback. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmitCoachFeedback = () => {
    if (!rateSession || !userProfile?.id) return;
    if (rating < 1) {
      toast({
        title: "Rating Required",
        description: "Please select at least 1 star before submitting.",
        duration: 4000,
      });
      return;
    }
    submitCoachFeedback();
  };

  // Navigation handler for feedback
  const handleFeedbackNavigate = (slotId: string, session?: UISession) => {
    
    if (!slotId) return;
    if (role === PROFILE_TYPE.athlete && session) {
      setRateSession(session);
      setRating(0);
      setHoverRating(null);
      setCoachComment("");
      setRateDialogOpen(true);
      return;
    }

    
    navigate(`/coach-session-feedback?slotId=${slotId}`);
  };

  const handlePastNavigate = (session: UISession) => {
    if (role === PROFILE_TYPE.coach) {
      const slotIdentifier = session.slotId || session.id;
      if (!slotIdentifier) {
        toast({
          title: "Missing session details",
          description: "We couldn't find the slot ID for this session.",
          variant: "destructive",
        });
        return;
      }
      navigate(`/coach-session-feedback?slotId=${slotIdentifier}`);
      return;
    }
    setSelectedSession(session);
  };

  // Extract unique pillars from all sessions
  const uniquePillars = useMemo(() => {
    const allSessions = [
      ...(grouped?.inProgress || []),
      ...(grouped?.upcoming || []),
      ...(grouped?.past || []),
    ];
    const pillars = new Set<string>();
    allSessions.forEach((session) => {
      if (session.pillarSlot) {
        pillars.add(session.pillarSlot);
      }
    });
    return Array.from(pillars).sort();
  }, [grouped]);

  const pillarOptions = useMemo(() => {
    if (role === PROFILE_TYPE.athlete) {
      const sportOptions = (sportPillars || [])
        .map((pillar) => pillar.title)
        .filter((title): title is string => Boolean(title));
      const uniqueSportOptions = Array.from(new Set(sportOptions));
      return uniqueSportOptions.length > 0 ? uniqueSportOptions : uniquePillars;
    }
    return uniquePillars;
  }, [role, sportPillars, uniquePillars]);

  const filteredSessions = useMemo(() => filterSessions(filters), [filterSessions, filters]);
  const searchPlaceholder = role === PROFILE_TYPE.athlete
    ? "Search Sessions or Coaches..."
    : "Search Sessions or Athletes...";

  const filteredGrouped = useMemo(() => {
    return {
      inProgress: filteredSessions.filter((s) => s.computedStatus === "in-progress"),
      upcoming: filteredSessions.filter((s) => s.computedStatus === "upcoming"),
      past: filteredSessions.filter((s) => s.computedStatus === "past"),
      completed: filteredSessions.filter((s) => s.computedStatus === "completed"),
      canceled: filteredSessions.filter((s) => s.computedStatus === "canceled"),
    };
  }, [filteredSessions]);

  const sortByStartAsc = (sessions: SessionUIModel[]) =>
    [...sessions].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );

  const sortedInProgress = useMemo(() => sortByStartAsc(filteredGrouped.inProgress), [filteredGrouped.inProgress]);
  const sortedUpcoming = useMemo(() => sortByStartAsc(filteredGrouped.upcoming), [filteredGrouped.upcoming]);
  const sortedPastCompleted = useMemo(
    () => [...filteredGrouped.past, ...filteredGrouped.completed],
    [filteredGrouped.past, filteredGrouped.completed]
  );

  const withDefaults = (
    sessions: SessionUIModel[],
    avatarMapByName?: Record<string, string | null>,
    coachAvatarMapById?: Record<string, string | null>
  ): UISession[] =>
    sessions.map((s) => {
      // Convert athlete names to athlete objects
      const athleteNames = s.athleteNames ?? [];
      const athletes = athleteNames.map((name, index) => ({
        id: `athlete-${index}`, // Since we don't have IDs from RPC, use index-based IDs
        name,
        avatar: (avatarMapByName && avatarMapByName[name]) || getAvatarUrlFromName(name),
      }));
      const totalAthletes = s.athleteCount ?? athleteNames.length;
      const coachAvatar = (coachAvatarMapById && coachAvatarMapById[s.coachId]) || null;
      return { ...s, athletes, totalAthletes, coachAvatar };
    });

  // Collect all athlete names for batch avatar fetching by name
  const allAthleteNames = useMemo(() => {
    const names = new Set<string>();
    [...filteredGrouped.inProgress, ...filteredGrouped.upcoming, ...filteredGrouped.past, ...filteredGrouped.completed].forEach((session) => {
      (session.athleteNames ?? []).forEach((n) => names.add(n));
    });
    return Array.from(names);
  }, [filteredGrouped]);

  const allCoachIds = useMemo(() => {
    const ids = new Set<string>();
    [...filteredGrouped.inProgress, ...filteredGrouped.upcoming, ...filteredGrouped.past, ...filteredGrouped.completed].forEach((session) => {
      if (session.coachId) {
        ids.add(session.coachId);
      }
    });
    return Array.from(ids);
  }, [filteredGrouped]);

  const { data: avatarMapByName = {} } = useAthleteAvatarsByNames(allAthleteNames.length ? allAthleteNames : undefined);
  const { data: coachAvatarMapById = {} } = useCoachAvatarsByIds(allCoachIds.length ? allCoachIds : undefined);

  const inProgressSessions = withDefaults(sortedInProgress, avatarMapByName, coachAvatarMapById);
  const upcomingSessions = withDefaults(sortedUpcoming, avatarMapByName, coachAvatarMapById);
  const pastCompletedSessions = withDefaults(sortedPastCompleted, avatarMapByName, coachAvatarMapById);

  const selectedSessionSafe = useMemo(() => {
    if (!selectedSession) return null;
    // Convert athlete names to athlete objects
    const athleteNames = selectedSession.athleteNames ?? [];
    const athletes = athleteNames.map((name, index) => ({
      id: `athlete-${index}`,
      name,
      avatar: (avatarMapByName && avatarMapByName[name]) || getAvatarUrlFromName(name),
    }));
    const totalAthletes = selectedSession.athleteCount ?? athleteNames.length;
    const coachAvatar = (coachAvatarMapById && coachAvatarMapById[selectedSession.coachId]) || null;
    return { ...selectedSession, athletes, totalAthletes, coachAvatar };
  }, [selectedSession, avatarMapByName, coachAvatarMapById]);

  const selectedSessionHeader = useMemo(() => {
    if (!selectedSessionSafe) {
      return {
        title: "Session Details",
        description: "Review your session details",
      };
    }

    const startMs = new Date(selectedSessionSafe.start).getTime();
    const diffMs = startMs - now.getTime();
    const minutesToStart = diffMs / (60 * 1000);

    if (selectedSessionSafe.computedStatus === "completed" || selectedSessionSafe.computedStatus === "past") {
      return {
        title: "Session Completed",
        description: "This session has ended",
      };
    }

    if (selectedSessionSafe.computedStatus === "in-progress") {
      return {
        title: "Session In Progress",
        description: "Your session is currently in progress",
      };
    }

    if (selectedSessionSafe.computedStatus === "upcoming") {
      if (minutesToStart <= 15) {
        return {
          title: "Session Starting Now!",
          description: "Your session is ready to begin",
        };
      }
      if (minutesToStart <= 30) {
        return {
          title: "Session Starting Soon",
          description: `Starts in ${Math.ceil(minutesToStart)} minutes`,
        };
      }
      const meta = getStartMeta(selectedSessionSafe.start, now);
      return {
        title: "Upcoming Session",
        description: meta?.startsIn ? `Starts in ${meta.startsIn}` : "Your session is scheduled",
      };
    }

    return {
      title: "Session Details",
      description: "Review your session details",
    };
  }, [selectedSessionSafe, now]);


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
    const colorMap = {
      emerald: "text-emerald-700",
      blue: "text-blue-700",
      slate: "text-slate-600",
    };
    return (
      <div className="flex items-center gap-2">
        <span className={cn("h-5 w-5", colorMap[color])}>{icon}</span>
        <p className={cn("text-base font-semibold", colorMap[color])}>{title}</p>
        <span className={cn("text-sm font-semibold", colorMap[color])}>{count}</span>
      </div>
    );
  };

  const hasSubmittedFeedback = (session: UISession) => {
    // Server flags are source of truth: coach uses session-level, athlete uses slot-level
    return role === PROFILE_TYPE.coach ? Boolean(session.hasSessionFeedback) : Boolean(session.hasSlotFeedback);
  };

  // Redirect only if initial check is complete AND no userProfile AND no loading
  useEffect(() => {
    if (initialCheckComplete && !authLoading && !userProfile) {
      navigate('/auth');
    }
  }, [initialCheckComplete, authLoading, userProfile, navigate]);

  // Show skeleton while auth or data is loading
  if (authLoading || isLoading) {
    return <SessionsSkeleton />;
  }

  // Render null if redirecting (brief moment before navigation)
  if (!userProfile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-40 px-4 lg:px-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-full gap-2"
              onClick={() => {
                if (window.history.length > 2) {
                  navigate(-1);
                } else {
                  navigate(ROUTES.HOME);
                }
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
            <Button
              variant="outline"
              className="rounded-full gap-2"
              onClick={() => navigate(ROUTES.HOME)}
            >
              <HomeIcon />
              <span>Home</span>
            </Button>
          </div>
          <div className="space-y-1 text-left sm:text-right">
            <h1 className="text-3xl font-semibold text-slate-900">My Sessions</h1>
            <p className="text-sm text-muted-foreground">
              Review and provide feedback for your sessions.
            </p>
          </div>
        </div>

        <Card className="shadow-[0_14px_40px_rgba(15,23,42,0.08)] border border-slate-200 rounded-2xl">
          <CardHeader className="pb-3 flex-row items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base text-slate-700">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Search Input - Full Width */}
              <div className="w-full">
                <label className="text-xs font-medium text-muted-foreground block mb-1">Search</label>
                <div className="relative">
                  <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder={searchPlaceholder}
                    className="pl-9 rounded-xl w-full"
                    value={filters.search}
                    onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                  />
                </div>
              </div>

              {/* Filter Row - All Other Filters */}
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Date</label>
                  <Input
                    type="date"
                    className="rounded-xl w-full"
                    value={filters.date}
                    onChange={(event) => setFilters((prev) => ({ ...prev, date: event.target.value }))}
                  />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Session Type</label>
                  <select
                    value={filters.type}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, type: event.target.value as SessionFilters["type"] }))
                    }
                    className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="all">All Types</option>
                    <option value="group">Group</option>
                    <option value="individual">Individual</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Session Status</label>
                  <select
                    value={filters.status}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, status: event.target.value as SessionFilters["status"] }))
                    }
                    className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="all">All Sessions</option>
                    <option value="in-progress">In Progress</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="past">Past</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Location Type</label>
                  <select
                    value={filters.locationType}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        locationType: event.target.value as SessionFilters["locationType"],
                      }))
                    }
                    className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="all">All Locations</option>
                    <option value="in-person">In Person</option>
                    <option value="online">Online</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Pillar</label>
                  <select
                    value={filters.pillar}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        pillar: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="all">All Pillars</option>
                    {pillarOptions.map((pillar) => (
                      <option key={pillar} value={pillar}>
                        {pillar}
                      </option>
                    ))}
                  </select>
                </div>
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
                    <SessionCard
                      key={session.id}
                      session={session}
                      now={now}
                      onSelect={setSelectedSession}
                      role={role}
                      resolvePillarIcon={resolvePillarIconForSession}
                      submittedSessionIds={submittedSessionIds}
                      onFeedbackNavigate={handleFeedbackNavigate}
                      platformFeePerc={platformFeePerc}
                      stripeFeePerc={stripeFeePerc}
                    />
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
          <Collapsible open={upcomingOpen} onOpenChange={setUpcomingOpen}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between group hover:opacity-80 transition-opacity">
                <SectionHeader
                  icon={<Clock4 className="h-5 w-5" />}
                  title="Upcoming Sessions"
                  count={upcomingSessions.length}
                  color="blue"
                />
                <ChevronDown className={cn(
                  "h-5 w-5 text-slate-600 transition-transform",
                  upcomingOpen && "transform rotate-180"
                )} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-3 mt-3">
                {upcomingSessions.length ? (
                  upcomingSessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      now={now}
                      onSelect={setSelectedSession}
                      role={role}
                      resolvePillarIcon={resolvePillarIconForSession}
                      submittedSessionIds={submittedSessionIds}
                      onFeedbackNavigate={handleFeedbackNavigate}
                      platformFeePerc={platformFeePerc}
                      stripeFeePerc={stripeFeePerc}
                    />
              ))
            ) : (
                  <div className="text-sm text-muted-foreground flex items-center gap-2 bg-white p-4 rounded-xl border">
                    <AlertCircle className="h-4 w-4" />
                    No upcoming sessions.
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
        <div className="space-y-3">
          <Collapsible open={pastOpen} onOpenChange={setPastOpen}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between group hover:opacity-80 transition-opacity">
                <SectionHeader
                  icon={<AlertCircle className="h-5 w-5" />}
                  title="Past & Completed Sessions"
                  count={pastCompletedSessions.length}
                  color="slate"
                />
                <ChevronDown className={cn(
                  "h-5 w-5 text-slate-600 transition-transform",
                  pastOpen && "transform rotate-180"
                )} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-3 mt-3">
                {pastCompletedSessions.length ? (
                  pastCompletedSessions.map((session) => (
                    <PastDraftCard
                      key={session.id}
                      session={session}
                      onSelect={setSelectedSession}
                      onPastNavigate={handlePastNavigate}
                      onFeedbackNavigate={handleFeedbackNavigate}
                      role={role}
                      resolvePillarIcon={resolvePillarIconForSession}
                      hasFeedbackSubmitted={hasSubmittedFeedback(session)}
                      platformFeePerc={platformFeePerc}
                      stripeFeePerc={stripeFeePerc}
                    />
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground flex items-center gap-2 bg-white p-4 rounded-xl border">
                    <AlertCircle className="h-4 w-4" />
                    No past or draft sessions.
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="h-12 lg:h-16" aria-hidden="true" />
      </div>

      <Dialog
        open={Boolean(selectedSessionSafe)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSession(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl p-0 overflow-hidden [&>button]:text-white [&>button[data-state=open]]:text-white">
          {selectedSessionSafe && (
            <>
              <div className="bg-[#0d7ff2] text-white px-6 py-5 flex items-start gap-3">
                <Clock className="w-6 h-6 mt-1" />
                <div>
                  <DialogTitle className="text-xl font-semibold leading-tight">
                    {selectedSessionHeader.title}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-white/90 mt-1">
                    {selectedSessionHeader.description}
                  </DialogDescription>
                </div>
              </div>
              <div className="p-6 space-y-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-semibold text-slate-900">{capitalizeFirst(selectedSessionSafe.title)}</h3>
                    <Badge
                      variant="outline"
                      className="rounded-full bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1"
                    >
                      <Users className="w-4 h-4" />
                      {selectedSessionSafe.type === "group" ? "Group Session" : "Individual Session"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-blue-600 mt-1" />
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Date &amp; Time</p>
                        <p className="text-sm text-slate-800">
                          {formatSessionDate(selectedSessionSafe.dateOnly)} • {formatISOTime(selectedSessionSafe.start)} - {formatISOTime(selectedSessionSafe.end)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-blue-600 mt-1" />
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Location Type</p>
                        <p className="text-sm text-slate-800">
                          {formatLocationDisplay(selectedSessionSafe.location)}
                        </p>
                      </div>
                    </div>
                    {selectedSessionSafe.pillarSlot && (
                      <div className="flex items-start gap-3 md:col-span-2">
                        {(() => {
                          const PillarIcon = resolvePillarIconForSession(selectedSessionSafe.pillarSlot);
                          return <PillarIcon className="w-5 h-5 text-blue-600 mt-1" />;
                        })()}
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Pillar</p>
                          <p className="text-sm text-slate-800">{selectedSessionSafe.pillarSlot}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                  {role === PROFILE_TYPE.coach ? (
                    <>
                      <p className="text-xs font-semibold text-slate-600">
                        ATHLETES ({selectedSessionSafe.totalAthletes})
                      </p>
                      <div className={selectedSessionSafe.athletes.length > 4 ? "max-h-40 overflow-y-auto pr-1" : ""}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {selectedSessionSafe.athletes.map((athlete) => (
                            <div
                              key={athlete.id}
                              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                            >
                              <Avatar className="h-9 w-9">
                                {athlete.avatar ? (
                                  <AvatarImage src={athlete.avatar} alt={athlete.name} />
                                ) : (
                                  <AvatarFallback className="bg-slate-100 text-slate-700 text-xs">
                                    {getInitialsFromName(athlete.name)}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <p className="text-sm text-slate-800">{athlete.name}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-slate-600">COACH</p>
                      {selectedSessionSafe.coachName && (
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedSessionSafe.coachId) {
                              navigate(`/coach/${selectedSessionSafe.coachId}`);
                            }
                          }}
                          className="flex w-full items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-left transition hover:border-blue-300 hover:bg-blue-100"
                        >
                          <Avatar className="h-9 w-9 border border-blue-200">
                            <AvatarImage
                              src={selectedSessionSafe.coachAvatar ?? getAvatarUrlFromName(selectedSessionSafe.coachName || "Coach")}
                              alt={selectedSessionSafe.coachName}
                            />
                            <AvatarFallback className="bg-gradient-to-br from-blue-400 to-blue-600 text-white text-sm font-semibold">
                              {getInitialsFromName(selectedSessionSafe.coachName || "Coach")}
                            </AvatarFallback>
                          </Avatar>
                          <p className="text-sm text-slate-800">{selectedSessionSafe.coachName}</p>
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="rounded-xl border border-green-200 bg-green-50 p-5 space-y-2">
                  {role === PROFILE_TYPE.athlete ? (
                    <>
                      <p className="text-xs font-semibold text-green-700">SESSION RATE</p>
                      <p className="text-xl font-semibold text-green-700">
                        {formatSessionPrice(
                          calculatePlatformFee(selectedSessionSafe.rate, platformFeePerc, stripeFeePerc).totalRate,
                          selectedSessionSafe.currency
                        )} per Athlete
                      </p>
                      <p className="text-sm text-green-700/80">
                        Total: {formatSessionPrice(
                          calculatePlatformFee(selectedSessionSafe.rate, platformFeePerc, stripeFeePerc).totalRate * selectedSessionSafe.totalAthletes,
                          selectedSessionSafe.currency
                        )} for {selectedSessionSafe.totalAthletes}{" "}
                        {selectedSessionSafe.totalAthletes === 1 ? "Athlete" : "Athletes"}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-green-700">SESSION RATE</p>
                      <p className="text-xl font-semibold text-green-700">
                        {formatSessionPrice(selectedSessionSafe.rate, selectedSessionSafe.currency)} per Athlete
                      </p>
                      <p className="text-sm text-green-700/80">
                        Total: {formatSessionPrice(
                          selectedSessionSafe.rate * selectedSessionSafe.totalAthletes,
                          selectedSessionSafe.currency
                        )} for {selectedSessionSafe.totalAthletes}{" "}
                        {selectedSessionSafe.totalAthletes === 1 ? "Athlete" : "Athletes"}
                      </p>
                    </>
                  )}
                </div>

                <div className="text-center">
                  <Button
                    variant="outline"
                    className="rounded-full px-6 w-full"
                    onClick={() => setSelectedSession(null)}
                  >
                    Close
                  </Button>
                  <p className="text-xs text-muted-foreground mt-3">
                    Make sure you're ready at the location with all necessary equipment
                  </p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Athlete Rate Coach Dialog */}
      <RateCoachDialog
        open={rateDialogOpen}
        session={rateSession ? {
          id: rateSession.id,
          athleteId: userProfile?.id || "",
          title: rateSession.title,
          status: rateSession.computedStatus === "in-progress" ? "in-progress" : rateSession.computedStatus === "upcoming" ? "upcoming" : "past",
          type: rateSession.type === "group" ? "Group" : "Individual",
          start: rateSession.start,
          end: rateSession.end,
          location: rateSession.location,
          locationType: rateSession.location === "online" ? "Online" : "In-Person",
          coach: rateSession.coachName || rateSession.coachId || "Coach",
          coachAvatar: rateSession.coachAvatar,
          rate: rateSession.rate,
          sportPillars: rateSession.pillarSlot ? [rateSession.pillarSlot] : [],
        } : null}
        coachSport="soccer"
        rating={rating}
        hoverRating={hoverRating}
        comment={coachComment}
        isSubmitting={isSubmittingCoachFeedback}
        isSubmitted={feedbackSubmitted}
        existingFeedback={existingFeedback}
        isLoadingFeedback={isLoadingExistingFeedback}
        onSubmit={handleSubmitCoachFeedback}
        onCancel={() => setRateDialogOpen(false)}
        onRatingChange={setRating}
        onHoverChange={setHoverRating}
        onHoverLeave={() => setHoverRating(null)}
        onCommentChange={setCoachComment}
        formatDate={(iso) => formatSessionDate(iso.split("T")[0])}
        formatTime={formatISOTime}
      />
    </div>
  );
};

export default MySessions;
