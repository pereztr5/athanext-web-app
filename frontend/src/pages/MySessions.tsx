import type { ReactNode } from "react";
import { Children, memo, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertCircle,
  Calendar,
  CalendarCheck,
  ChevronDown,
  Filter,
  History,
  Info,
  MapPin,
  PlayCircle,
  Search,
} from "@/components/icons";

import { BrandPill } from "@/components/brand";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useMyReferrals } from "@/hooks/useReferrals";
import { computeSessionPrice } from "@/utils/referralHelpers";
import { useSportPillars } from "@/hooks/useSportPillars";
import { RateCoachDialog } from "@/components/reviews/RateCoachDialog";
import { SessionsSkeleton } from "@/components/my-session/SessionsSkeleton";
import { AthleteSessionsList, sessionListTitle } from "@/components/my-session/AthleteSessionsList";
import { CoachSessionCard, CoachSessionSection } from "@/components/my-session/CoachSessionCard";
import { useOccurrenceInfo, type CoachCardKind } from "@/components/my-session/coachSessions";
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
  formatLocationSentence,
  formatTimeSpan,
  formatWholePrice,
  getAvatarUrlFromName,
  getInitialsFromName,
  getStartMeta,
} from "@/utils/sessionFormatting";
import { getZonedISODate, parseISODateLocal } from "@/utils/dateHelpers";
import { PROFILE_TYPE } from "@/utils/db";
import type { Enums } from "@/integrations/supabase/types";
import { resolvePillarIcon } from "@/utils/pillarIcons";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { formatDateInZone, timeZoneAbbreviation } from "@/utils/viewerTime";
import { sportFromText } from "@/utils/coachSport";

type UserRole = typeof PROFILE_TYPE.coach | typeof PROFILE_TYPE.athlete | null;

/**
 * "Thu, Mar 12" for dates in the reference year, "Thu, Mar 12, 2027" otherwise.
 * Accepts a YYYY-MM-DD date or an ISO datetime.
 */
const formatWeekdayDate = (dateOrIso: string, reference: Date = new Date(), timeZone?: string): string => {
  // Session instants are shown on the viewer's calendar day (ATH-22).
  if (timeZone && dateOrIso.includes("T")) {
    const instant = new Date(dateOrIso);
    const sameYear = formatDateInZone(instant, timeZone, { year: "numeric" }) === String(reference.getFullYear());
    return formatDateInZone(instant, timeZone, {
      weekday: "short",
      month: "short",
      day: "numeric",
      ...(sameYear ? {} : { year: "numeric" as const }),
    });
  }
  const date = parseISODateLocal(dateOrIso.split("T")[0]);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== reference.getFullYear() ? { year: "numeric" as const } : {}),
  });
};

/** A real uploaded photo, or null for missing/generated (dicebear) avatars. */
const realPhoto = (url?: string | null) => (url && !url.includes("dicebear.com") ? url : null);

const MAX_ATHLETE_PILLS = 2;
const AVATAR_TONES = ["bg-primary-50 text-primary", "bg-secondary-50 text-secondary-700"];

const labelClass = "text-label-xsm text-dark-300";
const primaryActionClass = buttonVariants({ variant: "default", size: "sm" });
const secondaryActionClass = buttonVariants({ variant: "secondary", size: "sm" });

const CardField = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-1.5">
    <span className={labelClass}>{label}</span>
    <span className="text-body-m text-dark">{value}</span>
  </div>
);

const PersonPill = ({
  name,
  label,
  avatar,
  toneIndex = 0,
}: {
  name: string;
  label?: string;
  avatar?: string | null;
  toneIndex?: number;
}) => {
  const photo = realPhoto(avatar);
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-pill border border-light-525 bg-light py-[3px] pl-[3px] pr-2 text-label-xsm text-dark-400">
      <span
        className={cn(
          "inline-flex size-[22px] shrink-0 items-center justify-center overflow-hidden rounded-full text-label-xsm",
          AVATAR_TONES[toneIndex % AVATAR_TONES.length]
        )}
      >
        {photo ? <img src={photo} alt="" className="size-full object-cover" /> : getInitialsFromName(name)}
      </span>
      <span className="truncate">{label ?? name}</span>
    </span>
  );
};

const AthleteList = memo(({ athletes, totalAthletes: rawTotal }: { athletes: { id: string; name: string; avatar?: string | null }[]; totalAthletes: number }) => {
  // The API can send the count as a string, so normalise it before comparing.
  const totalAthletes = Number(rawTotal) || 0;
  const visibleAthletes = athletes.slice(0, MAX_ATHLETE_PILLS);
  const remainingCount = Math.max(totalAthletes - visibleAthletes.length, 0);

  return (
    <div className="flex flex-col gap-2">
      <span className={labelClass}>
        {totalAthletes} {totalAthletes === 1 ? "athlete" : "athletes"}
      </span>
      {visibleAthletes.length > 0 || remainingCount > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {visibleAthletes.map((athlete, index) => (
            <PersonPill key={athlete.id} name={athlete.name} avatar={athlete.avatar} toneIndex={index} />
          ))}
          {remainingCount > 0 ? <BrandPill tone="neutral">+{remainingCount}</BrandPill> : null}
        </div>
      ) : null}
    </div>
  );
});

AthleteList.displayName = "AthleteList";

const CoachBlock = ({ name, avatar }: { name: string; avatar?: string | null }) => (
  <div className="flex flex-col gap-2">
    <span className={labelClass}>Coach</span>
    <div className="flex">
      <PersonPill name={name} avatar={avatar} />
    </div>
  </div>
);

/** Group sessions for athletes (ATH-97): families never see other athletes' names, only a note. */
const SessionRoster = () => (
  <div className="flex flex-col gap-2">
    <span className={labelClass}>Who's coming</span>
    <p className="text-caption text-dark-300">You're booked. Only your coach sees who else is coming.</p>
  </div>
);

const SessionTypePill = ({ type }: { type: UISession["type"] }) => (
  <BrandPill tone={type === "group" ? "teal" : "blue"}>{type === "group" ? "Group" : "Individual"}</BrandPill>
);

/** Waiting for the coach to accept or decline (ATH-49); no payment yet. */
const sessionIsRequested = (session: UISession) => session.dbStatus === "requested";

const sessionNeedsPayment = (session: UISession) =>
  !sessionIsRequested(session) &&
  (session.dbStatus === "pending_payment" ||
    session.paymentStatus === "unpaid" ||
    session.paymentStatus === "requires_action");

const BookingStatePill = ({ session }: { session: UISession }) =>
  sessionIsRequested(session) ? (
    <BrandPill tone="blue">Awaiting coach</BrandPill>
  ) : sessionNeedsPayment(session) ? (
    <BrandPill tone="amber">Awaiting payment</BrandPill>
  ) : null;

/** Rendered inside a card-level <button>, so it's a span with button semantics. */
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
    className={cn(primaryActionClass, "cursor-pointer", paying && "cursor-default opacity-60")}
  >
    {paying ? "Starting payment…" : "Pay now"}
  </span>
);

const calculatePlatformFee = (
  rate: number | null | undefined,
  platformFeePerc = 0,
  stripeFeePerc = 0,
  waived = false,
  stripeFeeFixed = 0,
) => {
  // Same total create-booking-payment sends to Stripe (platform fee waived for existing clients).
  const p = computeSessionPrice(Number(rate) || 0, platformFeePerc || 0, stripeFeePerc || 0, waived, stripeFeeFixed || 0);
  return { baseRate: p.base, platformFee: p.platformFee + p.stripeFee, totalRate: p.total };
};

const sessionPriceLabel = (
  session: UISession,
  role: UserRole,
  platformFeePerc: number,
  stripeFeePerc: number,
  waived = false,
  stripeFeeFixed = 0,
) =>
  formatWholePrice(
    role === PROFILE_TYPE.athlete
      ? calculatePlatformFee(session.rate, platformFeePerc, stripeFeePerc, waived, stripeFeeFixed).totalRate
      : session.rate,
    session.currency
  );

const PriceBlock = ({ price }: { price: string }) => (
  <div className="flex flex-col items-start gap-1.5 md:items-end">
    <span className="text-stat tabular-nums text-dark">{price}</span>
    <span className="text-caption text-dark-300">per athlete</span>
  </div>
);

const cardShellClass =
  "grid w-full grid-cols-1 gap-5 rounded-card border border-light-525 bg-light-300 px-[18px] pb-5 pt-[22px] text-left font-sans md:px-[25px] md:pb-[25px] md:pt-[30px] text-dark md:grid-cols-[1fr_auto] md:gap-x-6";
const cardAsideClass = "flex flex-row flex-wrap items-end justify-between gap-5 md:flex-col md:items-end";

const STARTS_IN_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

const SessionTitleRow = ({ session, children }: { session: UISession; children?: ReactNode }) => (
  <div className="flex flex-wrap items-center gap-2">
    <span className="text-card-title text-dark">
      {capitalizeFirst(session.title)}
    </span>
    <SessionTypePill type={session.type} />
    {children}
  </div>
);

const SessionCard = ({
  session,
  now,
  onSelect,
  role,
  platformFeePerc = 0,
  stripeFeePerc = 0,
  waived = false,
  canPay = false,
  paying = false,
  onPay,
}: {
  session: UISession;
  now: Date;
  onSelect: (session: UISession) => void;
  role: UserRole;
  platformFeePerc?: number;
  stripeFeePerc?: number;
  waived?: boolean;
  canPay?: boolean;
  paying?: boolean;
  onPay?: () => void;
}) => {
  const timeZone = useViewerTimeZone();
  const startMeta = session.computedStatus === "upcoming" ? getStartMeta(session.start, now) : null;
  // "Starts in" only for sessions 3 days out or less (ATH-81).
  const soon = new Date(session.start).getTime() - now.getTime() <= STARTS_IN_WINDOW_MS;
  const statusLabel =
    session.computedStatus === "in-progress"
      ? "In progress"
      : startMeta?.startsIn && soon
        ? `Starts in ${startMeta.startsIn}`
        : null;
  const price = sessionPriceLabel(session, role, platformFeePerc, stripeFeePerc, waived);
  const showPay = canPay && Boolean(onPay);

  return (
    <button type="button" onClick={() => onSelect(session)} className={cardShellClass}>
      <div className="flex min-w-0 flex-col gap-5">
        <SessionTitleRow session={session}>
          {statusLabel ? <BrandPill tone="amber">{statusLabel}</BrandPill> : null}
          {role !== PROFILE_TYPE.coach ? <BookingStatePill session={session} /> : null}
          {role === PROFILE_TYPE.athlete && waived ? <BrandPill tone="green">No service fee</BrandPill> : null}
        </SessionTitleRow>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <CardField label="Date" value={formatWeekdayDate(session.start, now, timeZone)} />
          <CardField label="Time" value={formatTimeSpan(session.start, session.end, timeZone, true)} />
          {session.location ? <CardField label="Location" value={formatLocationSentence(session.location)} /> : null}
        </div>
        {role === PROFILE_TYPE.coach ? (
          <AthleteList athletes={session.athletes ?? []} totalAthletes={session.totalAthletes ?? session.athletes?.length ?? 0} />
        ) : session.coachName ? (
          <CoachBlock name={session.coachName} avatar={session.coachAvatar} />
        ) : null}
      </div>
      <div className={cardAsideClass}>
        <PriceBlock price={price} />
        <div className="flex flex-wrap items-center gap-[10px] md:justify-end">
          {showPay && onPay ? <PayNowAction paying={paying} onPay={onPay} /> : null}
          <span className={showPay ? secondaryActionClass : primaryActionClass}>View details</span>
        </div>
      </div>
    </button>
  );
};

const PastDraftCard = ({
  session,
  onSelect,
  onFeedbackNavigate,
  role,
  hasFeedbackSubmitted,
  showFeedbackAction,
  platformFeePerc = 0,
  stripeFeePerc = 0,
  waived = false,
  canPay = false,
  paying = false,
  onPay,
}: {
  session: UISession;
  onSelect: (session: UISession) => void;
  onFeedbackNavigate: (slotId: string, session?: UISession) => void;
  role: 'coach' | 'athlete' | null;
  hasFeedbackSubmitted: boolean;
  showFeedbackAction: boolean;
  platformFeePerc?: number;
  stripeFeePerc?: number;
  waived?: boolean;
  canPay?: boolean;
  paying?: boolean;
  onPay?: () => void;
}) => {
  const timeZone = useViewerTimeZone();
  const price = sessionPriceLabel(session, role, platformFeePerc, stripeFeePerc, waived);
  const showPay = canPay && Boolean(onPay);
  // Coaches open the session page for every session; it has Add or Edit feedback (ATH-80).
  const openDetails = () => onSelect(session);

  return (
    <div className={cn(cardShellClass, "cursor-pointer")} onClick={openDetails}>
      <div className="flex min-w-0 flex-col gap-5">
        <SessionTitleRow session={session}>
          <BookingStatePill session={session} />
        </SessionTitleRow>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <CardField label="Date" value={formatWeekdayDate(session.start, new Date(), timeZone)} />
          <CardField label="Time" value={formatTimeSpan(session.start, session.end, timeZone, true)} />
          {session.location ? <CardField label="Location" value={formatLocationSentence(session.location)} /> : null}
          {session.pillarSlot ? <CardField label="Pillar" value={session.pillarSlot} /> : null}
        </div>
        {role === PROFILE_TYPE.coach ? (
          <AthleteList athletes={session.athletes ?? []} totalAthletes={session.totalAthletes ?? session.athletes?.length ?? 0} />
        ) : null}
        {role === PROFILE_TYPE.athlete && session.coachName ? (
          <CoachBlock name={session.coachName} avatar={session.coachAvatar} />
        ) : null}
      </div>
      <div className={cardAsideClass}>
        <PriceBlock price={price} />
        <div className="flex flex-wrap items-center gap-[10px] md:justify-end">
          {showPay && onPay ? <PayNowAction paying={paying} onPay={onPay} /> : null}
          {showFeedbackAction && (session.computedStatus === "past" || session.computedStatus === "completed") ? (
            <button
              type="button"
              className={secondaryActionClass}
              onClick={(event) => {
                event.stopPropagation();
                if (session.id) {
                  onFeedbackNavigate(session.id, session);
                }
              }}
            >
              {hasFeedbackSubmitted ? (role === PROFILE_TYPE.coach ? "Edit feedback" : "View feedback") : "Add feedback"}
            </button>
          ) : null}
          <button
            type="button"
            className={showPay ? secondaryActionClass : primaryActionClass}
            onClick={(event) => {
              event.stopPropagation();
              openDetails();
            }}
          >
            View details
          </button>
        </div>
      </div>
    </div>
  );
};

const EmptySessionNote = ({ children }: { children: string }) => (
  <div className="flex items-center gap-3 rounded-card border border-light-525 bg-light-300 px-[18px] pb-5 pt-[22px] md:px-[25px] md:pb-[25px] md:pt-[30px]">
    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-control border border-light-525 bg-light-400 text-dark-300">
      <Info className="size-4" strokeWidth={1.5} aria-hidden="true" />
    </span>
    <p className="text-body-m text-dark-300">{children}</p>
  </div>
);

const PAGE = 5;

const SessionGroup = ({
  iconBg,
  icon,
  title,
  count,
  empty,
  children,
}: {
  iconBg: string;
  icon: ReactNode;
  title: string;
  count: number;
  empty: string;
  children: ReactNode;
}) => {
  const [limit, setLimit] = useState(PAGE);
  const items = Children.toArray(children);
  return (
  <section className="flex flex-col gap-3">
    <div className="flex items-center gap-2.5">
      <span className={cn("inline-flex size-8 items-center justify-center rounded-control", iconBg)} aria-hidden="true">
        {icon}
      </span>
      <h2 className="text-card-title text-dark">{title}</h2>
      <span className="text-subtitle text-dark-300">{count}</span>
    </div>
    {count > 0 ? <div className="flex flex-col gap-3">{items.slice(0, limit)}</div> : <EmptySessionNote>{empty}</EmptySessionNote>}
    {items.length > limit ? (
      <button
        type="button"
        className="self-start text-label-sm text-primary hover:underline"
        onClick={() => setLimit((l) => l + PAGE)}
      >
        Show {Math.min(PAGE, items.length - limit)} more
      </button>
    ) : null}
  </section>
  );
};

const MySessions = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const timeZone = useViewerTimeZone();
  const { userProfile, userName, loading: authLoading } = useAuth();
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
  const [existingFeedback, setExistingFeedback] = useState<{
    rating: number | null;
    comment: string | null;
    created_at: string;
    feedback_to_athlete: string | null;
    athlete_rated_at: string | null;
    edit_count: number | null;
  } | null>(null);
  const [isLoadingExistingFeedback, setIsLoadingExistingFeedback] = useState(false);
  const { platformFeePerc, stripeFeePerc, stripeFeeFixed } = useFeeConfig();

  const { toast } = useToast();
  const [payingBookingId, setPayingBookingId] = useState<string | null>(null);

  const { role: persona } = useRole();
  // Coaches this athlete is a confirmed existing client of: no platform fee.
  const { data: myReferrals = [] } = useMyReferrals(
    persona === PROFILE_TYPE.athlete ? userProfile?.athlete_id ?? undefined : undefined
  );
  const waivedCoachIds = useMemo(
    () => new Set(myReferrals.filter((r) => r.status === "confirmed").map((r) => r.coach_id)),
    [myReferrals]
  );
  const athleteProfileId = userProfile?.athlete_id || userProfile?.id || null;
  const coachProfileId = userProfile?.coach_id || null;
  const role = useMemo<UserRole>(() => {
    if (persona === PROFILE_TYPE.coach) return PROFILE_TYPE.coach;
    if (persona === PROFILE_TYPE.athlete || persona === PROFILE_TYPE.parent) return PROFILE_TYPE.athlete;
    return null;
  }, [persona]);

  const sessionSport = useMemo<Enums<'sport_type'> | undefined>(() => {
    return sportFromText((profile?.data as any)?.sport || (profile?.userProfile as any)?.sport);
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

  // The coach's summary for the session (ATH-82), shown with their note in the rating dialog.
  const coachSummaryQuery = useQuery({
    queryKey: ["session-summary", rateSession?.slotId],
    enabled: rateDialogOpen && Boolean(rateSession?.slotId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_feedback_v2")
        .select("summary")
        .eq("slot_id", rateSession!.slotId!)
        .maybeSingle();
      if (error) throw error;
      return data?.summary ?? null;
    },
  });

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
          setExistingFeedback(data);
          if (data.athlete_rated_at) {
            setRating(data.rating ?? 0);
            setCoachComment(data.comment || "");
            setSubmittedSessionIds((prev) => {
              const next = new Set(prev);
              if (rateSession.id) next.add(rateSession.id);
              if (rateSession.slotId) next.add(rateSession.slotId);
              if (rateSession.bookingId) next.add(rateSession.bookingId);
              return next;
            });
          } else {
            setRating(0);
            setCoachComment("");
          }
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

  // Preload submitted feedback status so buttons show "Feedback submitted" without opening dialog
  useEffect(() => {
    const fetchSubmittedFeedback = async () => {
      if (persona === PROFILE_TYPE.athlete) {
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
  }, [role, persona, athleteProfileId, userProfile?.coach_id]);

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
        title: "Feedback submitted",
        description: "Thanks. Your coach will use it to shape future sessions.",
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
        title: "Feedback didn't send",
        description: error.message || "That didn't save. Try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmitCoachFeedback = () => {
    if (!rateSession || !userProfile?.id) return;
    if (existingFeedback?.athlete_rated_at) {
      toast({
        title: "Rating submitted",
        description: "Ratings are final once submitted.",
        duration: 4000,
      });
      return;
    }
    if (rating < 1) {
      toast({
        title: "Rating needed",
        description: "Pick at least 1 star before you submit.",
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
        title: "Payment didn't start",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
      setPayingBookingId(null);
    }
  };

  const handleFeedbackNavigate = (slotId: string, session?: UISession) => {
    
    if (!slotId) return;
    if ((persona === PROFILE_TYPE.athlete || persona === PROFILE_TYPE.parent) && session) {
      setRateSession(session);
      setRating(0);
      setHoverRating(null);
      setCoachComment("");
      setRateDialogOpen(true);
      return;
    }

    
    navigate(`/coach-session-feedback?slotId=${slotId}`);
  };

  // Every card opens the session page: the coach's (ATH-80) or the athlete's (ATH-97).
  const openSession = (session: UISession) => {
    const occurrenceId = session.occurrenceId || session.slotId;
    if (occurrenceId) {
      navigate(`/sessions/${occurrenceId}`);
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
    [...filteredGrouped.inProgress, ...filteredGrouped.upcoming, ...filteredGrouped.past, ...filteredGrouped.completed, ...filteredGrouped.canceled].forEach((session) => {
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
  // Feedback due first, then the most recent (Working Copy).
  const pastCompletedSessions = withDefaults(sortedPastCompleted, avatarMapByName, coachAvatarMapById).sort((a, b) => {
    const due = (x: UISession) => (role === PROFILE_TYPE.coach ? !x.hasSessionFeedback : !x.hasSlotFeedback) ? 0 : 1;
    return due(a) - due(b) || new Date(b.start).getTime() - new Date(a.start).getTime();
  });
  const canceledSessions = withDefaults(
    [...filteredGrouped.canceled].sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime()),
    avatarMapByName,
    coachAvatarMapById
  );

  useEffect(() => {
    const rateId = searchParams.get("rate");
    if (!rateId || rateDialogOpen) return;
    const match = [...inProgressSessions, ...upcomingSessions, ...pastCompletedSessions].find(
      (s) => s.id === rateId || s.occurrenceId === rateId || s.slotId === rateId
    );
    if (!match) return;
    handleFeedbackNavigate(match.slotId || match.id, match);
    searchParams.delete("rate");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, inProgressSessions, upcomingSessions, pastCompletedSessions, rateDialogOpen]);

  const isCoach = role === PROFILE_TYPE.coach;
  const occurrenceIds = useMemo(
    () =>
      Array.from(
        new Set(
          [...sortedInProgress, ...sortedUpcoming, ...sortedPastCompleted]
            .map((s) => s.occurrenceId)
            .filter((id): id is string => Boolean(id))
        )
      ),
    [sortedInProgress, sortedUpcoming, sortedPastCompleted]
  );
  const { data: occurrenceInfo = {} } = useOccurrenceInfo(occurrenceIds, isCoach);

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
        title: "Session details",
        description: "Review your session details",
      };
    }

    const startMs = new Date(selectedSessionSafe.start).getTime();
    const diffMs = startMs - now.getTime();
    const minutesToStart = diffMs / (60 * 1000);

    if (selectedSessionSafe.computedStatus === "completed" || selectedSessionSafe.computedStatus === "past") {
      return {
        title: "Session completed",
        description: "This session has ended",
      };
    }

    if (selectedSessionSafe.computedStatus === "in-progress") {
      return {
        title: "Session in progress",
        description: "Your session is happening now",
      };
    }

    if (selectedSessionSafe.computedStatus === "upcoming") {
      if (minutesToStart <= 15) {
        return {
          title: "Starting now",
          description: "Your session is ready to begin",
        };
      }
      if (minutesToStart <= 30) {
        return {
          title: "Starting soon",
          description: `Starts in ${Math.ceil(minutesToStart)} minutes`,
        };
      }
      const meta = getStartMeta(selectedSessionSafe.start, now);
      return {
        title: "Upcoming session",
        description: meta?.startsIn ? `Starts in ${meta.startsIn}` : "Your session is scheduled",
      };
    }

    return {
      title: "Session details",
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

  const fieldLabel = "text-caption text-dark-300";
  const selectClass = (isPlaceholder: boolean) =>
    cn(
      "w-full appearance-none rounded-control border border-dark-250 bg-light px-2.5 py-[9px] pr-8 text-body-m outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
      isPlaceholder ? "text-dark-200" : "text-dark"
    );
  const dateLabel = filters.date
    ? filters.date.split("-").reverse().join(".")
    : "dd.mm.yyyy";

  const coachLocation = (session: UISession) => {
    const place = session.occurrenceId ? occurrenceInfo[session.occurrenceId]?.place : null;
    if (session.location === "online") return "Online";
    return place || formatLocationSentence(session.location) || "-";
  };

  const tzAbbr = timeZoneAbbreviation(timeZone, now);

  const feedbackSlotId = (session: UISession) => session.slotId || session.occurrenceId || session.id;

  const renderCoachCard = (session: UISession, kind: CoachCardKind) => (
    <CoachSessionCard
      key={session.id}
      session={session}
      kind={kind}
      now={now}
      dayISO={getZonedISODate(new Date(session.start), timeZone)}
      time={formatTimeSpan(session.start, session.end, timeZone, true)}
      location={coachLocation(session)}
      info={session.occurrenceId ? occurrenceInfo[session.occurrenceId] : undefined}
      hasFeedback={hasSubmittedFeedback(session)}
      timeZone={timeZone}
      timeZoneAbbr={tzAbbr}
      onViewDetails={() => openSession(session)}
      onCheckIn={() => handleFeedbackNavigate(feedbackSlotId(session), session)}
      onFeedback={() => handleFeedbackNavigate(feedbackSlotId(session), session)}
    />
  );

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className={cn("mx-auto flex w-full flex-col gap-6", "max-w-wrapper")}>
        {isCoach ? (
          <>
            <PageHeader title="My sessions" subtitle="Check in athletes and send feedback after each session." />
            <CoachSessionSection
              icon={<PlayCircle strokeWidth={1.5} aria-hidden="true" />}
              tone="blue"
              title="In progress sessions"
              count={inProgressSessions.length}
              empty="No sessions in progress"
            >
              {inProgressSessions.map((session) => renderCoachCard(session, "now"))}
            </CoachSessionSection>
            <CoachSessionSection
              icon={<CalendarCheck strokeWidth={1.5} aria-hidden="true" />}
              tone="teal"
              title="Upcoming sessions"
              count={upcomingSessions.length}
              empty="No upcoming sessions. Create one from My schedule."
            >
              {upcomingSessions.map((session) => renderCoachCard(session, "up"))}
            </CoachSessionSection>
            <CoachSessionSection
              icon={<History strokeWidth={1.5} aria-hidden="true" />}
              tone="neutral"
              title="Previous sessions"
              count={pastCompletedSessions.length}
              empty="No previous sessions yet"
            >
              {pastCompletedSessions.map((session) => renderCoachCard(session, "past"))}
            </CoachSessionSection>
          </>
        ) : (
          <AthleteSessionsList
            upcoming={[...inProgressSessions, ...upcomingSessions]}
            past={pastCompletedSessions}
            canceled={canceledSessions}
            timeZone={timeZone}
            todayISO={getZonedISODate(new Date(), timeZone)}
            athleteFirst={(userName || "your athlete").split(" ")[0]}
            isParent={persona === PROFILE_TYPE.parent}
            onOpen={openSession}
          />
        )}
      </div>

      <Dialog
        open={Boolean(selectedSessionSafe)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSession(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl gap-0 overflow-y-auto p-0 font-sans text-dark [&>button]:right-[13px] [&>button]:top-[11px] [&>button]:text-dark-300 [&>button]:opacity-100 [&>button:hover]:text-dark sm:[&>button]:right-[17px] sm:[&>button]:top-[19px] [&>button_svg]:stroke-[1.5]">
          {selectedSessionSafe && (() => {
            const isAthleteView = role === PROFILE_TYPE.athlete;
            const perAthleteRate = isAthleteView
              ? calculatePlatformFee(
                  selectedSessionSafe.rate,
                  platformFeePerc,
                  stripeFeePerc,
                  waivedCoachIds.has(selectedSessionSafe.coachId),
                  stripeFeeFixed,
                ).totalRate
              : Number(selectedSessionSafe.rate) || 0;
            const athleteCount = Number(selectedSessionSafe.totalAthletes) || 0;
            const totalLabel = `${formatWholePrice(perAthleteRate * athleteCount, selectedSessionSafe.currency)} for ${athleteCount} ${
              athleteCount === 1 ? "athlete" : "athletes"
            }`;
            const PillarIcon = selectedSessionSafe.pillarSlot
              ? resolvePillarIconForSession(selectedSessionSafe.pillarSlot)
              : null;
            const details: { label: string; value: ReactNode }[] = [
              { label: "Date", value: formatWeekdayDate(selectedSessionSafe.start, now, timeZone) || "-" },
              { label: "Time", value: formatTimeSpan(selectedSessionSafe.start, selectedSessionSafe.end, timeZone, true) || "-" },
              { label: "Location", value: formatLocationSentence(selectedSessionSafe.location) || "-" },
              { label: "Total", value: totalLabel },
            ];
            if (selectedSessionSafe.pillarSlot) {
              details.push({
                label: "Pillar",
                value: (
                  <span className="inline-flex items-center gap-1.5">
                    {PillarIcon ? <PillarIcon className="size-4 text-dark-300" strokeWidth={1.5} aria-hidden="true" /> : null}
                    {selectedSessionSafe.pillarSlot}
                  </span>
                ),
              });
            }
            const canOpenCoach = !isAthleteView ? false : Boolean(selectedSessionSafe.coachName && selectedSessionSafe.coachId);

            return (
              <>
                <div className="flex flex-col gap-1.5 px-[25px] py-5 pr-14 text-left">
                  <DialogTitle className="text-section text-dark">
                    {selectedSessionHeader.title}
                  </DialogTitle>
                  <DialogDescription className="text-body-m text-dark-300">
                    {selectedSessionHeader.description}
                  </DialogDescription>
                </div>
                <div className="h-px bg-light-525" />

                <div className="flex flex-col gap-5 px-[25px] py-5">
                  {/* Session summary */}
                  <div className="flex items-start justify-between gap-5">
                    <div className="flex min-w-0 flex-col gap-2.5">
                      <p className="text-card-title">
                        {capitalizeFirst(selectedSessionSafe.title)}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <SessionTypePill type={selectedSessionSafe.type} />
                        {selectedSessionSafe.computedStatus === "in-progress" ? (
                          <BrandPill tone="amber">In progress</BrandPill>
                        ) : null}
                        {isAthleteView ? <BookingStatePill session={selectedSessionSafe} /> : null}
                      </div>
                    </div>
                    <div className="flex flex-none flex-col items-end gap-1.5 text-right">
                      <p className="text-stat tabular-nums">
                        {formatWholePrice(perAthleteRate, selectedSessionSafe.currency)}
                      </p>
                      <p className="text-caption text-dark-300">per athlete</p>
                    </div>
                  </div>

                  {/* Details */}
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-control border border-light-525 bg-light-400 px-5 py-4 sm:grid-cols-2">
                    {details.map((item) => (
                      <div key={item.label} className="flex flex-col gap-1.5">
                        <dt className={labelClass}>{item.label}</dt>
                        <dd className="text-body-m text-dark">{item.value}</dd>
                      </div>
                    ))}
                  </dl>

                  {/* People */}
                  {role === PROFILE_TYPE.coach ? (
                    <div className="flex flex-col gap-2">
                      <span className={labelClass}>
                        {athleteCount} {athleteCount === 1 ? "athlete" : "athletes"}
                      </span>
                      {selectedSessionSafe.athletes.length > 0 ? (
                        <div
                          className={cn(
                            "flex flex-wrap gap-1.5",
                            selectedSessionSafe.athletes.length > 12 && "max-h-40 overflow-y-auto pr-1"
                          )}
                        >
                          {selectedSessionSafe.athletes.map((athlete, index) => (
                            <PersonPill key={athlete.id} name={athlete.name} avatar={athlete.avatar} toneIndex={index} />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : selectedSessionSafe.coachName ? (
                    <CoachBlock name={selectedSessionSafe.coachName} avatar={selectedSessionSafe.coachAvatar} />
                  ) : null}
                  {/* Only confirmed bookings can see the roster; unpaid or requested ones can't. */}
                  {isAthleteView &&
                  selectedSessionSafe.type === "group" &&
                  selectedSessionSafe.occurrenceId &&
                  !sessionIsRequested(selectedSessionSafe) &&
                  !sessionNeedsPayment(selectedSessionSafe) ? (
                    <SessionRoster />
                  ) : null}

                  <p className="text-caption text-dark-300">
                    Be ready at the location with the equipment you need.
                  </p>
                </div>

                <div className="h-px bg-light-525" />
                <div className="flex flex-col-reverse gap-[10px] px-[25px] py-5 sm:flex-row sm:justify-end">
                  <Button
                    variant={canOpenCoach ? "outline" : "default"}
                    onClick={() => setSelectedSession(null)}
                  >
                    Close
                  </Button>
                  {canOpenCoach ? (
                    <Button
                      onClick={() => {
                        if (selectedSessionSafe.coachId) {
                          navigate(`/coach/${selectedSessionSafe.coachId}`);
                        }
                      }}
                    >
                      View coach profile
                    </Button>
                  ) : null}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Athlete Rate Coach Dialog */}
      <RateCoachDialog
        open={rateDialogOpen}
        session={rateSession ? {
          id: rateSession.id,
          athleteId: userProfile?.id || "",
          title: sessionListTitle(rateSession),
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
        rating={rating}
        hoverRating={hoverRating}
        comment={coachComment}
        isSubmitting={isSubmittingCoachFeedback}
        isSubmitted={feedbackSubmitted}
        existingFeedback={existingFeedback}
        coachSummary={coachSummaryQuery.data ?? null}
        isLoadingFeedback={isLoadingExistingFeedback}
        onSubmit={handleSubmitCoachFeedback}
        onCancel={() => setRateDialogOpen(false)}
        onRatingChange={setRating}
        onHoverChange={setHoverRating}
        onHoverLeave={() => setHoverRating(null)}
        onCommentChange={setCoachComment}
        formatDate={(iso) => formatWeekdayDate(iso, now, timeZone)}
      />
    </div>
  );
};

export default MySessions;
