import type { ReactNode } from "react";
import { memo, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";

import { BrandPill } from "@/components/brand";
import { Button } from "@/components/ui/button";
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
import { parseISODateLocal } from "@/utils/dateHelpers";
import { PROFILE_TYPE } from "@/utils/db";
import type { Enums } from "@/integrations/supabase/types";
import { resolvePillarIcon } from "@/utils/pillarIcons";

type UserRole = typeof PROFILE_TYPE.coach | typeof PROFILE_TYPE.athlete | null;

/**
 * "Thu, Mar 12" for dates in the reference year, "Thu, Mar 12, 2027" otherwise.
 * Accepts a YYYY-MM-DD date or an ISO datetime.
 */
const formatWeekdayDate = (dateOrIso: string, reference: Date = new Date()): string => {
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
const AVATAR_TONES = ["bg-[#E5EDF7] text-[#0054B4]", "bg-[#E7F4F8] text-[#1599BC]"];

const labelClass = "text-[12px] font-medium leading-[13px] tracking-[-0.03em] text-[#767980]";
const primaryActionClass =
  "inline-flex h-[30px] items-center justify-center whitespace-nowrap rounded-[8px] border border-[#6698D2] bg-[#0054B4] px-4 text-[14px] font-medium tracking-[-0.03em] text-[#F1F1E6] transition-colors hover:bg-[#0054B4]/90";
const secondaryActionClass =
  "inline-flex h-[30px] items-center justify-center whitespace-nowrap rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] px-4 text-[14px] font-medium tracking-[-0.03em] text-[#1A202C] transition-colors hover:bg-[#EAEADF]";

const CardField = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-1.5">
    <span className={labelClass}>{label}</span>
    <span className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#1A202C]">{value}</span>
  </div>
);

const PersonPill = ({ name, avatar, toneIndex = 0 }: { name: string; avatar?: string | null; toneIndex?: number }) => {
  const photo = realPhoto(avatar);
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-[4px] bg-[#F1F1E6] py-[3px] pl-[3px] pr-2 text-[12px] font-medium leading-[13px] tracking-[-0.03em] text-[#484D56]">
      <span
        className={cn(
          "inline-flex size-[22px] shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-medium",
          AVATAR_TONES[toneIndex % AVATAR_TONES.length]
        )}
      >
        {photo ? <img src={photo} alt="" className="size-full object-cover" /> : getInitialsFromName(name)}
      </span>
      <span className="truncate">{name}</span>
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

const SessionTypePill = ({ type }: { type: UISession["type"] }) => (
  <BrandPill tone={type === "group" ? "teal" : "blue"}>{type === "group" ? "Group" : "Individual"}</BrandPill>
);

const sessionNeedsPayment = (session: UISession) =>
  session.dbStatus === "pending_payment" ||
  session.paymentStatus === "unpaid" ||
  session.paymentStatus === "requires_action";

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
  waived = false
) => {
  // Same total create-booking-payment sends to Stripe (platform fee waived for existing clients).
  const p = computeSessionPrice(Number(rate) || 0, platformFeePerc || 0, stripeFeePerc || 0, waived);
  return { baseRate: p.base, platformFee: p.platformFee + p.stripeFee, totalRate: p.total };
};

const sessionPriceLabel = (
  session: UISession,
  role: UserRole,
  platformFeePerc: number,
  stripeFeePerc: number,
  waived = false
) =>
  formatWholePrice(
    role === PROFILE_TYPE.athlete
      ? calculatePlatformFee(session.rate, platformFeePerc, stripeFeePerc, waived).totalRate
      : session.rate,
    session.currency
  );

const PriceBlock = ({ price }: { price: string }) => (
  <div className="flex flex-col items-start gap-1.5 md:items-end">
    <span className="text-[32px] font-bold leading-[30px] tracking-[-0.03em] text-[#1A202C]">{price}</span>
    <span className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">per athlete</span>
  </div>
);

const cardShellClass =
  "grid w-full grid-cols-1 gap-5 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] pb-[25px] pt-[30px] text-left font-sans text-[#1A202C] md:grid-cols-[1fr_auto] md:gap-x-6";
const cardAsideClass = "flex flex-row flex-wrap items-end justify-between gap-5 md:flex-col md:items-end";

const SessionTitleRow = ({ session, children }: { session: UISession; children?: ReactNode }) => (
  <div className="flex flex-wrap items-center gap-2">
    <span className="text-[20px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">
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
  const startMeta = session.computedStatus === "upcoming" ? getStartMeta(session.start, now) : null;
  const statusLabel =
    session.computedStatus === "in-progress"
      ? "In progress"
      : startMeta?.startsIn
        ? `Starts in ${startMeta.startsIn}`
        : null;
  const price = sessionPriceLabel(session, role, platformFeePerc, stripeFeePerc, waived);
  const showPay = canPay && Boolean(onPay);

  return (
    <button type="button" onClick={() => onSelect(session)} className={cardShellClass}>
      <div className="flex min-w-0 flex-col gap-5">
        <SessionTitleRow session={session}>
          {statusLabel ? <BrandPill tone="amber">{statusLabel}</BrandPill> : null}
          {role !== PROFILE_TYPE.coach && sessionNeedsPayment(session) ? (
            <BrandPill tone="amber">Awaiting payment</BrandPill>
          ) : null}
          {role === PROFILE_TYPE.athlete && waived ? <BrandPill tone="green">No service fee</BrandPill> : null}
        </SessionTitleRow>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <CardField label="Date" value={formatWeekdayDate(session.dateOnly, now)} />
          <CardField label="Time" value={formatTimeSpan(session.start, session.end)} />
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
  onPastNavigate,
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
  onPastNavigate: (session: UISession) => void;
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
  const price = sessionPriceLabel(session, role, platformFeePerc, stripeFeePerc, waived);
  const showPay = canPay && Boolean(onPay);
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
    <div className={cn(cardShellClass, "cursor-pointer")} onClick={openDetails}>
      <div className="flex min-w-0 flex-col gap-5">
        <SessionTitleRow session={session}>
          {sessionNeedsPayment(session) ? <BrandPill tone="amber">Awaiting payment</BrandPill> : null}
        </SessionTitleRow>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <CardField label="Date" value={formatWeekdayDate(session.dateOnly)} />
          <CardField label="Time" value={formatTimeSpan(session.start, session.end)} />
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
              {hasFeedbackSubmitted ? "Edit feedback" : "Add feedback"}
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
  <div className="flex items-center gap-[10px] rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] pb-[25px] pt-[30px]">
    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-[#F4F4EB] text-[#A3A6AB]">
      <Info className="size-4" strokeWidth={1.5} aria-hidden="true" />
    </span>
    <p className="text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-[#767980]">{children}</p>
  </div>
);

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
}) => (
  <section className="flex flex-col gap-[14px]">
    <div className="flex items-center gap-[10px]">
      <span className={cn("inline-flex size-8 items-center justify-center rounded-[8px]", iconBg)} aria-hidden="true">
        {icon}
      </span>
      <h2 className="text-[20px] font-medium leading-[24px] tracking-[-0.05em] text-[#1A202C]">{title}</h2>
      <span className="text-[16px] font-medium leading-[18px] tracking-[-0.03em] text-[#767980]">{count}</span>
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
  const [existingFeedback, setExistingFeedback] = useState<{
    rating: number | null;
    comment: string | null;
    created_at: string;
    feedback_to_athlete: string | null;
    athlete_rated_at: string | null;
    edit_count: number | null;
  } | null>(null);
  const [isLoadingExistingFeedback, setIsLoadingExistingFeedback] = useState(false);
  const { platformFeePerc, stripeFeePerc } = useFeeConfig();

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

  // Preload submitted feedback status so buttons show "Feedback Submitted" without opening dialog
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
        title: "Error Submitting Feedback",
        description: error.message || "Failed to submit your feedback. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmitCoachFeedback = () => {
    if (!rateSession || !userProfile?.id) return;
    if ((existingFeedback?.edit_count ?? 0) >= 1 && existingFeedback?.athlete_rated_at) {
      toast({
        title: "Feedback locked",
        description: "This rating is locked after one edit. Contact support for further changes.",
        duration: 4000,
      });
      return;
    }
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
    if (persona === PROFILE_TYPE.parent) return;
    if (persona === PROFILE_TYPE.athlete && session) {
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

  const fieldLabel = "text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#767980]";
  const selectClass = (isPlaceholder: boolean) =>
    cn(
      "w-full appearance-none rounded-[8px] border border-[#EAEADF] bg-[#F1F1E6] px-[10px] py-[9px] pr-8 text-[14px] font-normal leading-[18px] tracking-[-0.42px] outline-none",
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
            Review your sessions and leave feedback
          </p>
        </div>

        <div className="flex flex-col gap-5 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] py-[30px]">
          <div className="flex items-center gap-[5px]">
            <Filter className="size-4 text-[#1A202C]" strokeWidth={1.5} />
            <h2 className="text-[20px] font-medium leading-[18px] tracking-[-1px] text-[#1A202C]">Filters</h2>
          </div>
          <div className="flex items-center gap-[10px] rounded-[8px] border border-[#EAEADF] bg-[#F1F1E6] px-[10px] py-[9px] focus-within:ring-2 focus-within:ring-[#6698D2]">
            <Search className="size-4 shrink-0 text-[#A3A6AB]" strokeWidth={1.5} />
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
                <Calendar className="pointer-events-none absolute right-[10px] top-1/2 size-4 -translate-y-1/2 text-[#A3A6AB]" strokeWidth={1.5} />
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
                <ChevronDown className="pointer-events-none absolute right-[10px] top-1/2 size-4 -translate-y-1/2 text-[#767980]" strokeWidth={1.5} />
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
                  <option value="in-progress">In progress</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="past">Past</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-[10px] top-1/2 size-4 -translate-y-1/2 text-[#767980]" strokeWidth={1.5} />
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
                  <option value="in-person">In person</option>
                  <option value="online">Online</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-[10px] top-1/2 size-4 -translate-y-1/2 text-[#767980]" strokeWidth={1.5} />
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
                <ChevronDown className="pointer-events-none absolute right-[10px] top-1/2 size-4 -translate-y-1/2 text-[#767980]" strokeWidth={1.5} />
              </div>
            </div>
          </div>
        </div>

        <SessionGroup
          iconBg="bg-[#E5EDF7] text-[#0054B4]"
          icon={<PlayCircle className="size-4" strokeWidth={1.5} />}
          title="In progress sessions"
          count={inProgressSessions.length}
          empty="No sessions in progress"
        >
          {inProgressSessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              now={now}
              onSelect={setSelectedSession}
              role={role}
              platformFeePerc={platformFeePerc}
              stripeFeePerc={stripeFeePerc}
              waived={waivedCoachIds.has(session.coachId)}
              canPay={persona === PROFILE_TYPE.athlete && sessionNeedsPayment(session)}
              paying={payingBookingId === session.bookingId}
              onPay={() => void handlePay(session)}
            />
          ))}
        </SessionGroup>

        <SessionGroup
          iconBg="bg-[#E7F4F8] text-[#1599BC]"
          icon={<CalendarCheck className="size-4" strokeWidth={1.5} />}
          title="Upcoming sessions"
          count={upcomingSessions.length}
          empty="No upcoming sessions"
        >
          {upcomingSessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              now={now}
              onSelect={setSelectedSession}
              role={role}
              platformFeePerc={platformFeePerc}
              stripeFeePerc={stripeFeePerc}
              waived={waivedCoachIds.has(session.coachId)}
              canPay={persona === PROFILE_TYPE.athlete && sessionNeedsPayment(session)}
              paying={payingBookingId === session.bookingId}
              onPay={() => void handlePay(session)}
            />
          ))}
        </SessionGroup>

        <SessionGroup
          iconBg="bg-[#F4F4EB] text-[#767980]"
          icon={<History className="size-4" strokeWidth={1.5} />}
          title="Previous sessions"
          count={pastCompletedSessions.length}
          empty="No previous sessions"
        >
          {pastCompletedSessions.map((session) => (
            <PastDraftCard
              key={session.id}
              session={session}
              onSelect={setSelectedSession}
              onPastNavigate={handlePastNavigate}
              onFeedbackNavigate={handleFeedbackNavigate}
              role={role}
              hasFeedbackSubmitted={hasSubmittedFeedback(session)}
              showFeedbackAction={role === PROFILE_TYPE.coach || persona === PROFILE_TYPE.athlete}
              platformFeePerc={platformFeePerc}
              stripeFeePerc={stripeFeePerc}
              waived={waivedCoachIds.has(session.coachId)}
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
        <DialogContent className="max-h-[90vh] max-w-2xl gap-0 overflow-y-auto p-0 font-sans tracking-[-0.03em] text-[#1A202C] [&>button]:right-[13px] [&>button]:top-[11px] [&>button]:text-[#767980] [&>button]:opacity-100 [&>button:hover]:text-[#1A202C] sm:[&>button]:right-[17px] sm:[&>button]:top-[19px] [&>button_svg]:stroke-[1.5]">
          {selectedSessionSafe && (() => {
            const isAthleteView = role === PROFILE_TYPE.athlete;
            const perAthleteRate = isAthleteView
              ? calculatePlatformFee(
                  selectedSessionSafe.rate,
                  platformFeePerc,
                  stripeFeePerc,
                  waivedCoachIds.has(selectedSessionSafe.coachId)
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
              { label: "Date", value: formatWeekdayDate(selectedSessionSafe.dateOnly, now) || "-" },
              { label: "Time", value: formatTimeSpan(selectedSessionSafe.start, selectedSessionSafe.end) || "-" },
              { label: "Location", value: formatLocationSentence(selectedSessionSafe.location) || "-" },
              { label: "Total", value: totalLabel },
            ];
            if (selectedSessionSafe.pillarSlot) {
              details.push({
                label: "Pillar",
                value: (
                  <span className="inline-flex items-center gap-1.5">
                    {PillarIcon ? <PillarIcon className="size-4 text-[#767980]" strokeWidth={1.5} aria-hidden="true" /> : null}
                    {selectedSessionSafe.pillarSlot}
                  </span>
                ),
              });
            }
            const canOpenCoach = !isAthleteView ? false : Boolean(selectedSessionSafe.coachName && selectedSessionSafe.coachId);

            return (
              <>
                <div className="flex flex-col gap-1.5 px-[25px] py-5 pr-14 text-left">
                  <DialogTitle className="text-[24px] font-semibold leading-[30px] tracking-[-0.05em] text-[#1A202C]">
                    {selectedSessionHeader.title}
                  </DialogTitle>
                  <DialogDescription className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
                    {selectedSessionHeader.description}
                  </DialogDescription>
                </div>
                <div className="h-px bg-[#EAEADF]" />

                <div className="flex flex-col gap-5 px-[25px] py-5">
                  {/* Session summary */}
                  <div className="flex items-start justify-between gap-5">
                    <div className="flex min-w-0 flex-col gap-2.5">
                      <p className="text-[20px] font-medium leading-[24px] tracking-[-0.05em]">
                        {capitalizeFirst(selectedSessionSafe.title)}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <SessionTypePill type={selectedSessionSafe.type} />
                        {selectedSessionSafe.computedStatus === "in-progress" ? (
                          <BrandPill tone="amber">In progress</BrandPill>
                        ) : null}
                        {isAthleteView && sessionNeedsPayment(selectedSessionSafe) ? (
                          <BrandPill tone="amber">Awaiting payment</BrandPill>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-none flex-col items-end gap-1.5 text-right">
                      <p className="text-[32px] font-bold leading-[30px]">
                        {formatWholePrice(perAthleteRate, selectedSessionSafe.currency)}
                      </p>
                      <p className="text-[12px] leading-[14px] text-[#767980]">per athlete</p>
                    </div>
                  </div>

                  {/* Details */}
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-[8px] bg-[#F4F4EB] px-5 py-4 sm:grid-cols-2">
                    {details.map((item) => (
                      <div key={item.label} className="flex flex-col gap-1.5">
                        <dt className={labelClass}>{item.label}</dt>
                        <dd className="text-[14px] leading-[18px] text-[#1A202C]">{item.value}</dd>
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

                  <p className="text-[12px] leading-[14px] text-[#767980]">
                    Be ready at the location with the equipment you need.
                  </p>
                </div>

                <div className="h-px bg-[#EAEADF]" />
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
        formatDate={(iso) => formatWeekdayDate(iso, now)}
      />
    </div>
  );
};

export default MySessions;
