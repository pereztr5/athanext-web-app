import type { ReactNode } from "react";
import { memo, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  CalendarCheck,
  ChevronDown,
  Clock,
  Filter,
  History,
  Info,
  MapPin,
  PlayCircle,
  Search,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { startOccurrenceCheckout } from "@/api/bookings";
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
          className="flex items-center gap-2 rounded-[4px] border border-[#EAEADF] bg-[#F1F1E6] py-[3px] pl-[3px] pr-2"
        >
          <Avatar className="h-[22px] w-[22px] rounded-[3px]">
            <AvatarImage src={athlete.avatar ?? getAvatarUrlFromName(athlete.name)} alt={athlete.name} />
            <AvatarFallback className="rounded-[3px] bg-[#C1C1B8] text-[10px] font-medium text-[#484D56]">
              {getInitialsFromName(athlete.name)}
            </AvatarFallback>
          </Avatar>
          <span className="text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#484D56]">{athlete.name}</span>
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

const sessionNeedsPayment = (session: UISession) =>
  session.dbStatus === "pending_payment" ||
  session.paymentStatus === "unpaid" ||
  session.paymentStatus === "requires_action";

const PayNowAction = ({
  paying,
  onPay,
}: {
  paying: boolean;
  onPay: () => void;
}) => (
  <span
    role="button"
    tabIndex={0}
    aria-disabled={paying}
    onClick={(event) => {
      event.stopPropagation();
      if (!paying) onPay();
    }}
    onKeyDown={(event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      if (!paying) onPay();
    }}
    className="inline-flex cursor-pointer items-center justify-center rounded-[8px] border border-[#E4D7A2] bg-[#F8F1D8] px-4 py-2 text-[16px] font-medium leading-[18px] tracking-[-0.48px] text-[#7A5B00]"
  >
    {paying ? "Starting payment…" : "Pay now"}
  </span>
);

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
  canPay = false,
  paying = false,
  onPay,
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
  canPay?: boolean;
  paying?: boolean;
  onPay?: () => void;
}) => {
  const startMeta = session.computedStatus === "upcoming" ? getStartMeta(session.start, now) : null;
  const personLabel =
    role === PROFILE_TYPE.coach
      ? session.athleteNamesDisplay && session.athleteNamesDisplay !== "No athletes"
        ? session.athleteNamesDisplay
        : ""
      : session.coachName || "";
  const placeLabel = formatLocationDisplay(session.location);
  const timingLabel = startMeta?.startsIn
    ? `${placeLabel} · Starting in ${startMeta.startsIn}`
    : placeLabel;
  const price = formatSessionPrice(
    role === PROFILE_TYPE.athlete
      ? calculatePlatformFee(session.rate, platformFeePerc, stripeFeePerc).totalRate
      : session.rate,
    session.currency
  );
  const typeChipClass = cn(
    "inline-flex h-7 items-center rounded-[4px] border px-2 py-1 text-[14px] font-medium capitalize leading-[18px] tracking-[-0.42px]",
    session.type === "group"
      ? "border-[#D0EBF2] bg-[#E7F4F8] text-[#1599BC]"
      : "border-[#CCDDF0] bg-[#E5EDF7] text-[#0054B4]"
  );

  if (role === PROFILE_TYPE.coach) {
    const coachDate = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(`${session.dateOnly}T12:00:00`));
    const athlete = session.athletes[0];
    const photo = athlete?.avatar && !athlete.avatar.includes("dicebear.com") ? athlete.avatar : null;

    return (
      <button
        type="button"
        onClick={() => onSelect(session)}
        className="flex w-full flex-col gap-4 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] py-6 text-left md:h-[136px] md:flex-row md:items-center md:gap-0 md:py-0"
      >
        <div className="flex w-full shrink-0 flex-col gap-2 md:w-[180px]">
          <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#1A202C]">
            {capitalizeFirst(session.title)}
          </p>
          <span className={cn(typeChipClass, "w-fit")}>{session.type}</span>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-[5px] md:w-[266px]">
          <p className="text-[16px] font-medium leading-[18px] tracking-[-0.8px] text-[#1A202C]">{coachDate}</p>
          <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#767980]">
            {session.timeRange.replace(" - ", " – ")}
          </p>
        </div>
        <div className="w-full shrink-0 md:w-[145px]">
          {athlete ? (
            <span className="inline-flex items-center gap-[5px] rounded-[4px] border border-[#EAEADF] bg-[#F1F1E6] py-[3px] pl-[3px] pr-2">
              <span className="inline-flex size-[22px] items-center justify-center overflow-hidden rounded-[3px] bg-[#C1C1B8] text-[9px] font-medium text-[#484D56]">
                {photo ? (
                  <img src={photo} alt="" className="size-full object-cover" />
                ) : (
                  getInitialsFromName(athlete.name)
                )}
              </span>
              <span className="truncate text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#484D56]">
                {athlete.name}
              </span>
            </span>
          ) : null}
        </div>
        <div className="w-full shrink-0 md:w-[240px]">
          <p className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">{timingLabel}</p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-[9px] md:ml-auto md:items-end">
          <div className="md:text-right">
            <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#1A202C]">{price}</p>
            <p className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">per athlete</p>
          </div>
          <span className="inline-flex items-center justify-center rounded-[8px] border border-[#6698D2] bg-[#0054B4] px-4 py-2 text-[16px] font-medium leading-[18px] tracking-[-0.48px] text-[#F1F1E6]">
            View Details
          </span>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(session)}
      className="flex w-full flex-col gap-4 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] py-[30px] text-left md:flex-row md:items-end md:justify-between"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-[5px]">
          <p className="text-[16px] font-medium leading-[18px] tracking-[-0.48px] text-[#1A202C]">
            {capitalizeFirst(session.title)}
          </p>
          <span
            className={cn(
              "inline-flex items-center rounded-[4px] border px-2 py-1 text-[14px] font-medium capitalize leading-[18px] tracking-[-0.42px]",
              session.type === "group"
                ? "border-[#D0EBF2] bg-[#E7F4F8] text-[#1599BC]"
                : "border-[#CCDDF0] bg-[#E5EDF7] text-[#0054B4]"
            )}
          >
            {session.type}
          </span>
        </div>
        <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#1A202C]">
          {formatSessionDate(session.dateOnly)}
        </p>
        <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#767980]">
          {session.timeRange}
        </p>
        {personLabel ? (
          <p className="text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#484D56]">
            {personLabel}
          </p>
        ) : null}
        <p className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">{timingLabel}</p>
        {sessionNeedsPayment(session) ? (
          <p className="text-[12px] font-medium leading-[14px] tracking-[-0.36px] text-[#7A5B00]">Awaiting payment</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-start gap-[10px] md:items-end">
        <div className="md:text-right">
          <p className="text-[16px] font-medium leading-[18px] tracking-[-0.48px] text-[#1A202C]">{price}</p>
          <p className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">per athlete</p>
        </div>
        {canPay && onPay ? <PayNowAction paying={paying} onPay={onPay} /> : null}
        <span className="inline-flex items-center justify-center rounded-[8px] border border-[#6698D2] bg-[#0054B4] px-4 py-2 text-[16px] font-medium leading-[18px] tracking-[-0.48px] text-[#F1F1E6]">
          View details
        </span>
      </div>
    </button>
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
  canPay = false,
  paying = false,
  onPay,
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
  canPay?: boolean;
  paying?: boolean;
  onPay?: () => void;
}) => {
  const price = formatSessionPrice(
    role === PROFILE_TYPE.athlete
      ? calculatePlatformFee(session.rate, platformFeePerc, stripeFeePerc).totalRate
      : session.rate,
    session.currency
  );
  const openDetails = () => {
    if (session.computedStatus === "past" || session.computedStatus === "completed") {
      if (role === PROFILE_TYPE.coach) {
        onPastNavigate(session);
        return;
      }
    }
    onSelect(session);
  };

  return (
    <Card
      className="cursor-pointer rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] shadow-none"
      onClick={openDetails}
    >
      <CardContent className="px-[25px] py-[30px]">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-[5px]">
              <p className="text-[16px] font-medium leading-[18px] tracking-[-0.48px] text-[#1A202C]">
                {capitalizeFirst(session.title)}
              </p>
              <span
                className={cn(
                  "inline-flex items-center rounded-[4px] border px-2 py-1 text-[14px] font-medium capitalize leading-[18px] tracking-[-0.42px]",
                  session.type === "group"
                    ? "border-[#D0EBF2] bg-[#E7F4F8] text-[#1599BC]"
                    : "border-[#CCDDF0] bg-[#E5EDF7] text-[#0054B4]"
                )}
              >
                {session.type}
              </span>
            </div>
            <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#1A202C]">
              {formatSessionDate(session.dateOnly)}
            </p>
            <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#767980]">
              {session.timeRange}
              {session.location ? ` · ${formatLocationDisplay(session.location)}` : ""}
              {session.pillarSlot ? ` · ${session.pillarSlot}` : ""}
            </p>
            {role === PROFILE_TYPE.coach ? (
              <p className="text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#484D56]">
                {session.totalAthletes} {session.totalAthletes === 1 ? "athlete" : "athletes"}
              </p>
            ) : null}
            {role === PROFILE_TYPE.coach ? (
              <AthleteList athletes={session.athletes} totalAthletes={session.totalAthletes} />
            ) : null}
            {sessionNeedsPayment(session) ? (
              <p className="text-[12px] font-medium leading-[14px] tracking-[-0.36px] text-[#7A5B00]">Awaiting payment</p>
            ) : null}
            {role === PROFILE_TYPE.athlete && session.coachName ? (
              <div className="inline-flex w-fit items-center gap-2 rounded-[4px] border border-[#EAEADF] bg-[#F1F1E6] py-[3px] pl-[3px] pr-2">
                <Avatar className="h-[22px] w-[22px] rounded-[3px]">
                  <AvatarImage
                    src={session.coachAvatar ?? getAvatarUrlFromName(session.coachName || "Coach")}
                    alt={session.coachName}
                  />
                  <AvatarFallback className="rounded-[3px] bg-[#C1C1B8] text-[10px] font-medium text-[#484D56]">
                    {getInitialsFromName(session.coachName || "Coach")}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#484D56]">
                  {session.coachName}
                </span>
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-start gap-[10px] md:items-end">
            <div className="md:text-right">
              <p className="text-[16px] font-medium leading-[18px] tracking-[-0.48px] text-[#1A202C]">{price}</p>
              <p className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">per athlete</p>
            </div>
            <div className="flex flex-col gap-2">
              {canPay && onPay ? <PayNowAction paying={paying} onPay={onPay} /> : null}
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-[8px] border border-[#6698D2] bg-[#0054B4] px-4 py-2 text-[16px] font-medium leading-[18px] tracking-[-0.48px] text-[#F1F1E6]"
                onClick={(event) => {
                  event.stopPropagation();
                  openDetails();
                }}
              >
                View details
              </button>
              {(session.computedStatus === "past" || session.computedStatus === "completed") ? (
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-[8px] border border-[#EAEADF] bg-[#F1F1E6] px-4 py-2 text-[16px] font-medium leading-[18px] tracking-[-0.48px] text-[#1A202C]",
                    hasFeedbackSubmitted && "border-[#D0EBF2] bg-[#E7F4F8] text-[#1599BC]"
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (session.id) {
                      onFeedbackNavigate(session.id, session);
                    }
                  }}
                >
                  {hasFeedbackSubmitted ? "View feedback" : "Add feedback"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const EmptySessionNote = ({ children }: { children: string }) => (
  <div className="flex items-center gap-[10px] rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] py-[30px]">
    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[#F4F4EB] text-[#A3A6AB]">
      <Info className="size-4" strokeWidth={1.75} />
    </span>
    <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#A3A6AB]">{children}</p>
  </div>
);

const SessionGroup = ({
  iconBg,
  icon,
  title,
  titleClass,
  count,
  countClass,
  empty,
  children,
}: {
  iconBg: string;
  icon: ReactNode;
  title: string;
  titleClass: string;
  count: number;
  countClass: string;
  empty: string;
  children: ReactNode;
}) => (
  <section className="flex flex-col gap-[14px]">
    <div className="flex items-center gap-[10px]">
      <span className={cn("inline-flex size-8 items-center justify-center rounded-[10px]", iconBg)}>{icon}</span>
      <h2 className={cn("text-[20px] font-medium leading-[18px] tracking-[-1px]", titleClass)}>{title}</h2>
      <p className={cn("text-[16px] font-medium leading-none tracking-[-0.8px]", countClass)}>{count}</p>
    </div>
    {count > 0 ? <div className="flex flex-col gap-[14px]">{children}</div> : <EmptySessionNote>{empty}</EmptySessionNote>}
  </section>
);

const MySessions = () => {
  const navigate = useNavigate();
  const { userProfile, loading: authLoading } = useAuth();
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
  const [payingBookingId, setPayingBookingId] = useState<string | null>(null);

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
  const handlePay = async (session: UISession) => {
    const occurrenceId = session.occurrenceId || session.id;
    if (persona !== PROFILE_TYPE.athlete || !athleteProfileId || !occurrenceId) return;
    setPayingBookingId(session.bookingId);
    try {
      await startOccurrenceCheckout(occurrenceId, athleteProfileId);
    } catch (error) {
      toast({
        title: "Payment",
        description: error instanceof Error ? error.message : "Could not start payment.",
        variant: "destructive",
      });
      setPayingBookingId(null);
    }
  };

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


  const hasSubmittedFeedback = (session: UISession) => {
    // Server flags are source of truth: coach uses session-level, athlete uses slot-level
    return role === PROFILE_TYPE.coach ? Boolean(session.hasSessionFeedback) : Boolean(session.hasSlotFeedback);
  };


  // Show skeleton while auth or data is loading
  if (authLoading || isLoading) {
    return <SessionsSkeleton />;
  }

  // Render null if redirecting (brief moment before navigation)
  if (!userProfile) {
    return null;
  }

  const fieldLabel = "text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#767980]";
  const selectClass = (isPlaceholder: boolean) =>
    cn(
      "w-full appearance-none rounded-[8px] border-0 bg-[#F1F1E6] p-[10px] pr-8 text-[14px] font-normal leading-[18px] tracking-[-0.42px] outline-none",
      isPlaceholder ? "text-[#A3A6AB]" : "text-[#1A202C]"
    );
  const dateLabel = filters.date
    ? filters.date.split("-").reverse().join(".")
    : "dd.mm.yyyy";

  return (
    <div className="overflow-x-hidden px-4 pb-16 md:px-10">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
        <div className="flex flex-col gap-[10px]">
          <h1 className="text-[32px] font-bold leading-[28px] tracking-[-1.6px] text-[#1A202C]">
            My sessions
          </h1>
          <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#767980]">
            Review and provide feedback for you sessions
          </p>
        </div>

        <div className="flex flex-col gap-5 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] py-[30px]">
          <div className="flex items-center gap-[5px]">
            <Filter className="size-4 text-[#1A202C]" strokeWidth={1.75} />
            <h2 className="text-[20px] font-medium leading-[18px] tracking-[-1px] text-[#1A202C]">Filters</h2>
          </div>
          <div className="flex items-center gap-[10px] rounded-[8px] bg-[#F1F1E6] p-[10px]">
            <Search className="size-4 shrink-0 text-[#A3A6AB]" strokeWidth={1.75} />
            <input
              value={filters.search ?? ""}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder={
                "Search sessions or coaches"
              }
              className="w-full bg-transparent text-[14px] font-normal leading-[18px] tracking-[-0.42px] text-[#1A202C] outline-none placeholder:text-[#A3A6AB]"
            />
          </div>
          <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2 lg:grid-cols-5">
            <div className="flex min-w-0 flex-col gap-[5px]">
              <label className={fieldLabel}>Date</label>
              <div className="relative">
                <div className={cn(selectClass(!filters.date), "flex items-center")}>
                  <span className="truncate">{dateLabel}</span>
                </div>
                <input
                  type="date"
                  value={filters.date ?? ""}
                  onChange={(event) => setFilters((prev) => ({ ...prev, date: event.target.value }))}
                  aria-label="Date"
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                <Calendar className="pointer-events-none absolute right-[10px] top-1/2 size-4 -translate-y-1/2 text-[#A3A6AB]" strokeWidth={1.75} />
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-[5px]">
              <label className={fieldLabel}>Type</label>
              <div className="relative">
                <select
                  value={filters.type}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, type: event.target.value as SessionFilters["type"] }))
                  }
                  className={selectClass(filters.type === "all")}
                >
                  <option value="all">All types</option>
                  <option value="group">Group</option>
                  <option value="individual">Individual</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-[10px] top-1/2 size-4 -translate-y-1/2 text-[#767980]" strokeWidth={1.75} />
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-[5px]">
              <label className={fieldLabel}>Status</label>
              <div className="relative">
                <select
                  value={filters.status}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, status: event.target.value as SessionFilters["status"] }))
                  }
                  className={selectClass(filters.status === "all")}
                >
                  <option value="all">All sessions</option>
                  <option value="in-progress">In Progress</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="past">Past</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-[10px] top-1/2 size-4 -translate-y-1/2 text-[#767980]" strokeWidth={1.75} />
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-[5px]">
              <label className={fieldLabel}>Location</label>
              <div className="relative">
                <select
                  value={filters.locationType}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      locationType: event.target.value as SessionFilters["locationType"],
                    }))
                  }
                  className={selectClass(filters.locationType === "all")}
                >
                  <option value="all">All locations</option>
                  <option value="in-person">In Person</option>
                  <option value="online">Online</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-[10px] top-1/2 size-4 -translate-y-1/2 text-[#767980]" strokeWidth={1.75} />
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-[5px]">
              <label className={fieldLabel}>Pillar</label>
              <div className="relative">
                <select
                  value={filters.pillar}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      pillar: event.target.value,
                    }))
                  }
                  className={selectClass(!filters.pillar || filters.pillar === "all")}
                >
                  <option value="all">All pillars</option>
                  {pillarOptions.map((pillar) => (
                    <option key={pillar} value={pillar}>
                      {pillar}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-[10px] top-1/2 size-4 -translate-y-1/2 text-[#767980]" strokeWidth={1.75} />
              </div>
            </div>
          </div>
        </div>

        <SessionGroup
          iconBg="bg-[#CCDDF0] text-[#0054B4]"
          icon={<PlayCircle className="size-4" strokeWidth={1.75} />}
          title="In progress sessions"
          titleClass="text-[#0054B4]"
          count={inProgressSessions.length}
          countClass="text-[#6698D2]"
          empty="No sessions in progress"
        >
          {inProgressSessions.map((session) => (
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
              canPay={persona === PROFILE_TYPE.athlete && sessionNeedsPayment(session)}
              paying={payingBookingId === session.bookingId}
              onPay={() => void handlePay(session)}
            />
          ))}
        </SessionGroup>

        <SessionGroup
          iconBg="bg-[#D0EBF2] text-[#1599BC]"
          icon={<CalendarCheck className="size-4" strokeWidth={1.75} />}
          title="Upcoming sessions"
          titleClass="text-[#1599BC]"
          count={upcomingSessions.length}
          countClass="text-[#73C2D7]"
          empty="No upcoming sessions"
        >
          {upcomingSessions.map((session) => (
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
              canPay={persona === PROFILE_TYPE.athlete && sessionNeedsPayment(session)}
              paying={payingBookingId === session.bookingId}
              onPay={() => void handlePay(session)}
            />
          ))}
        </SessionGroup>

        <SessionGroup
          iconBg="bg-[#D1D2D5] text-[#767980]"
          icon={<History className="size-4" strokeWidth={1.75} />}
          title="Previous sessions"
          titleClass="text-[#767980]"
          count={pastCompletedSessions.length}
          countClass="text-[#A3A6AB]"
          empty="No sessions in progress"
        >
          {pastCompletedSessions.map((session) => (
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
              canPay={persona === PROFILE_TYPE.athlete && sessionNeedsPayment(session)}
              paying={payingBookingId === session.bookingId}
              onPay={() => void handlePay(session)}
            />
          ))}
        </SessionGroup>
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
