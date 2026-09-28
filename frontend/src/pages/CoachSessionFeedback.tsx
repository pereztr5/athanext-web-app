import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Info,
  MapPin,
  NotebookPen,
  Search,
  SendHorizontal,
  User,
  UserCheck2,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";
import { AddWalkInAthleteDialog } from "@/components/coach/AddWalkInAthleteDialog";
import { listWalkInRoster } from "@/api/walkIn";

import { useCoachSessionFeedback, useUpsertSlotAttendance, useUpsertSlotFeedback, useUpsertSessionFeedback } from "@/hooks/useCoachSessionFeedback";
import { mapRpcRowToAthlete, buildAttendancePayload, buildFeedbackPayload, buildSessionFeedbackPayload } from "@/utils/sessionFeedbackHelpers";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/contexts/ProfileContext";
import { ROUTES } from "@/routes";

import { BrandPill, BrandStar } from "@/components/brand";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import RatingStars from "@/components/ui/RatingStars";
import {
  formatLocationSentence,
  formatSessionDate,
  formatTimeSpan,
  formatWholePrice,
} from "@/utils/sessionFormatting";

type Athlete = {
  id: string;
  name: string;
  role: string;
  age: string;
  level?: string;
  avatar?: string;
  bio?: string;
  interests?: string[];
  hometown?: string;
  school?: string;
  goals?: string;
};

const formatCurrency = (amount: number) => formatWholePrice(amount);

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** "Midfielder, 15, Intermediate": skips the "N/A" placeholder age. */
const getAthleteMeta = (athlete: Athlete) =>
  [athlete.role, athlete.age && athlete.age !== "N/A" ? athlete.age : null, athlete.level]
    .filter(Boolean)
    .join(", ");

/** "Mar 9, 2026, 4:00 to 5:00 PM" from the slot's date and HH:mm[:ss] times. */
const getSessionWhen = (date?: string | null, start?: string | null, end?: string | null) =>
  [date ? formatSessionDate(date) : null, start && end ? formatTimeSpan(start, end) : null]
    .filter(Boolean)
    .join(", ");

const labelClass = "text-[12px] font-medium leading-[13px] tracking-[-0.03em] text-[#767980]";
const fieldLabelClass = "text-[16px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]";
const bodyClass = "text-[14px] leading-[18px] tracking-[-0.03em]";
const avatarFallbackClass = "bg-[#E5EDF7] text-[14px] font-medium text-[#0054B4]";
const dialogShellClass = "gap-0 overflow-hidden p-0 font-sans tracking-[-0.03em] text-[#1A202C]";
const dialogSectionClass = "px-[25px] py-5";
const dialogTitleClass = "text-[24px] font-semibold leading-[30px] tracking-[-0.05em] text-[#1A202C]";
const dialogDescriptionClass = "text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]";
const textareaClass = "resize-none text-[14px] leading-[18px] tracking-[-0.03em]";

const Divider = () => <div className="h-px bg-[#EAEADF]" />;

const AthleteAvatar = ({ athlete, className }: { athlete: Athlete; className?: string }) => (
  <Avatar className={cn("h-10 w-10 shrink-0", className)}>
    {athlete.avatar ? <AvatarImage src={athlete.avatar} alt={athlete.name} /> : null}
    <AvatarFallback className={avatarFallbackClass}>{getInitials(athlete.name)}</AvatarFallback>
  </Avatar>
);

const SummaryRow = ({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) => (
  <div className={cn("flex items-center justify-between gap-3", bodyClass)}>
    <span className="flex items-center gap-2 text-[#767980]">
      {icon}
      {label}
    </span>
    <span className="font-medium text-[#1A202C]">{value}</span>
  </div>
);

const OverviewField = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <span className={labelClass}>{label}</span>
    <span className={cn(bodyClass, "text-[#1A202C]")}>{children}</span>
  </div>
);

const ListNote = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center gap-[10px] rounded-[8px] bg-[#F4F4EB] p-4">
    <Info className="size-4 shrink-0 text-[#A3A6AB]" strokeWidth={1.5} aria-hidden="true" />
    <p className={cn(bodyClass, "text-[#767980]")}>{children}</p>
  </div>
);

const ReadOnlyStars = ({ value }: { value: number }) => (
  <span className="flex items-center gap-1" aria-hidden="true">
    {[1, 2, 3, 4, 5].map((star) => (
      <BrandStar key={star} filled={star <= value} size={16} />
    ))}
  </span>
);

const CoachSessionFeedback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const slotId = searchParams.get('slotId');
  const { profile, loading: profileLoading } = useProfile();
  const { toast } = useToast();

  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [bookingIdMap, setBookingIdMap] = useState<Record<string, string>>({});
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const attendedAthletes = useMemo(
    () => athletes.filter((athlete) => attendance[athlete.id]),
    [attendance, athletes]
  );
  const [sessionSummary, setSessionSummary] = useState("");
  const [coachNotes, setCoachNotes] = useState("");
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackDialogAthletes, setFeedbackDialogAthletes] = useState<Athlete[]>([]);
  const [profileDialogAthlete, setProfileDialogAthlete] = useState<Athlete | null>(null);
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [athleteFeedbackMap, setAthleteFeedbackMap] = useState<Record<string, string>>({});
  const [privateFeedbackMap, setPrivateFeedbackMap] = useState<Record<string, string>>({});
  const [absentReasons, setAbsentReasons] = useState<Record<string, string>>({});
  const [pendingUnselect, setPendingUnselect] = useState<Athlete | null>(null);
  const [pendingReason, setPendingReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [sessionRating, setSessionRating] = useState<number | null>(null);
  const [sessionHoverRating, setSessionHoverRating] = useState<number | null>(null);
  const [athleteRatingMap, setAthleteRatingMap] = useState<Record<string, number | undefined>>({});
  const [athleteScoreMap, setAthleteScoreMap] = useState<Record<string, number | undefined>>({});
  const [athleteNoteMap, setAthleteNoteMap] = useState<Record<string, string>>({});
  const [athleteHoverRatingMap, setAthleteHoverRatingMap] = useState<Record<string, number | null>>({});
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [sessionFeedbackCompleted, setSessionFeedbackCompleted] = useState(false);
  const [athleteFeedbackSubmitted, setAthleteFeedbackSubmitted] = useState<Record<string, boolean>>({});
  const [athleteFeedbackLocked, setAthleteFeedbackLocked] = useState<Record<string, boolean>>({});
  const [sessionFeedbackLocked, setSessionFeedbackLocked] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [unpaidAthleteIds, setUnpaidAthleteIds] = useState<Set<string>>(new Set());

  const hasInitializedAttendance = useRef(false);

  // Backend hooks
  const { data: feedbackData, isLoading: isLoadingData, error: dataError } = useCoachSessionFeedback(slotId || undefined);
  const { mutate: upsertAttendance, isPending: isUpdatingAttendance } = useUpsertSlotAttendance(slotId || undefined);
  const { mutate: upsertFeedback, isPending: isSubmittingFeedback } = useUpsertSlotFeedback(slotId || undefined);
  const { mutate: upsertSessionFeedbackMutation, isPending: isUpdatingSessionFeedback } = useUpsertSessionFeedback(slotId || undefined);

  // Derive header/session metadata from first RPC row and profile
  const sessionHeader = useMemo(() => {
    const row: any = Array.isArray(feedbackData) && feedbackData.length > 0 ? feedbackData[0] : null;
    const coachName =
      (profile.type === "coach" && profile.data && (profile.data as any).name) ||
      (profile.userProfile && (profile.userProfile as any).name) ||
      undefined;

    return {
      coachName,
      sessionName: row?.slot_session_name || row?.session_name || "",
      locationType: row?.slot_location || row?.location || null,
      pillar: row?.pillar_slot || null,
      // price expected in cents from DB
      rateCents:
        typeof row?.slot_price === "number"
          ? Number(row.slot_price)
          : typeof row?.price === "number"
          ? Number(row.price)
          : null,
      sessionDate: row?.session_date || null,
      startTime: row?.slot_start_time || row?.start_time || null,
      endTime: row?.slot_end_time || row?.end_time || null,
    };
  }, [feedbackData, profile]);

  const totalAthletes = athletes.length;
  const attendedCount = attendedAthletes.length;
  const absentCount = Math.max(totalAthletes - attendedCount, 0);
  const [search, setSearch] = useState("");
  const ratePerAthlete = sessionHeader.rateCents ?? 0;
  const sessionTotal = attendedCount * ratePerAthlete;
  const amountAfterPlatform = sessionTotal;
  const payout = amountAfterPlatform;
  const sessionInfo = {
    title: sessionHeader.sessionName,
    date: sessionHeader.sessionDate,
    startTime: sessionHeader.startTime,
    endTime: sessionHeader.endTime,
  };

  const allSelected = attendedCount === totalAthletes;
  const filteredAthletes = useMemo(() => {
    const term = search.toLowerCase();
    if (!term) return athletes;
    return athletes.filter(
      (athlete) =>
        athlete.name.toLowerCase().includes(term) ||
        athlete.role.toLowerCase().includes(term) ||
        (athlete.level ?? "").toLowerCase().includes(term)
    );
  }, [athletes, search]);

  // Profile and slotId validation
  useEffect(() => {
    if (profileLoading) return;

    if (profile.type !== 'coach' || !profile.data) {
      toast({
        title: 'Access denied',
        description: 'Only coaches can access this page.',
        variant: 'destructive',
      });
      navigate(-1);
      return;
    }

    if (!slotId) {
      toast({
        title: 'Invalid session',
        description: 'Session ID is missing.',
        variant: 'destructive',
      });
      navigate(-1);
    }
  }, [profileLoading, profile, slotId, navigate, toast]);

  // Handle data error
  useEffect(() => {
    if (dataError) {
      toast({
        title: 'Something went wrong',
        description: 'Failed to load session data.',
        variant: 'destructive',
      });
    }
  }, [dataError, toast]);

  // Load data from backend
  useEffect(() => {
    if (!feedbackData || feedbackData.length === 0) {
      console.warn('⚠️ NO FEEDBACK DATA RETURNED for slotId:', slotId);
      return;
    }

    // Log first row to debug session metadata
    const athletesData: Athlete[] = [];
    const attendanceData: Record<string, boolean> = {};
    const absentReasonsData: Record<string, string> = {};
    const ratingsData: Record<string, number | undefined> = {};
    const feedbackData_: Record<string, string> = {};
    const privateFeedbackData: Record<string, string> = {};
    const bookingMap: Record<string, string> = {};
    const submittedMap: Record<string, boolean> = {};
    const lockedMap: Record<string, boolean> = {};

    let sessionRatingFromDB: number | null = null;
    let sessionSummaryFromDB: string | null = null;
    let coachNotesFromDB: string | null = null;
    let sessionEditCountFromDB = 0;
    const scoresData: Record<string, number> = {};
    const notesData: Record<string, string> = {};

    feedbackData.forEach((row) => {
      const athlete = mapRpcRowToAthlete(row);
      athletesData.push(athlete);
      bookingMap[athlete.id] = row.booking_id;

      const isPresent = row.attendance !== 'absent';
      attendanceData[athlete.id] = isPresent;

      if (row.reason_absent) {
        absentReasonsData[athlete.id] = row.reason_absent;
      }

      if (row.coach_rating_of_athlete) {
        ratingsData[athlete.id] = row.coach_rating_of_athlete;
      }

      if (row.rating) {
        scoresData[athlete.id] = row.rating;
      }

      if (row.comment?.trim()) {
        notesData[athlete.id] = row.comment;
      }

      if (row.feedback_to_athlete) {
        feedbackData_[athlete.id] = row.feedback_to_athlete;
      }

      if (row.coach_only_notes) {
        privateFeedbackData[athlete.id] = row.coach_only_notes;
      }

      if (
        Boolean(row.coach_rating_of_athlete) ||
        (row.feedback_to_athlete && row.feedback_to_athlete.trim()) ||
        (row.coach_only_notes && row.coach_only_notes.trim())
      ) {
        submittedMap[athlete.id] = true;
      }

      if ((row.coach_edit_count ?? 0) >= 1) {
        lockedMap[athlete.id] = true;
      }

      if (row.session_rating !== null) {
        sessionRatingFromDB = row.session_rating;
      }

      if (row.session_summary) {
        sessionSummaryFromDB = row.session_summary;
      }

      if (row.coach_notes) {
        coachNotesFromDB = row.coach_notes;
      }

      if (typeof row.session_edit_count === "number") {
        sessionEditCountFromDB = row.session_edit_count;
      }
    });

    setAthletes(athletesData);
    setBookingIdMap(bookingMap);
    setAttendance(attendanceData);
    setAbsentReasons(absentReasonsData);
    setAthleteRatingMap(ratingsData);
    setAthleteScoreMap(scoresData);
    setAthleteNoteMap(notesData);
    setAthleteFeedbackMap(feedbackData_);
    setPrivateFeedbackMap(privateFeedbackData);
    setAthleteFeedbackSubmitted(submittedMap);
    setAthleteFeedbackLocked(lockedMap);
    setSessionFeedbackLocked(sessionEditCountFromDB >= 1);

    if (sessionRatingFromDB !== null) {
      setSessionRating(sessionRatingFromDB);
      setSessionFeedbackCompleted(true);
    }

    if (sessionSummaryFromDB) {
      setSessionSummary(sessionSummaryFromDB);
    }

    if (coachNotesFromDB) {
      setCoachNotes(coachNotesFromDB);
    }
  }, [feedbackData]);

  useEffect(() => {
    if (!slotId) return;
    let cancelled = false;
    listWalkInRoster(slotId, sessionHeader.sessionDate)
      .then((result) => {
        if (cancelled) return;
        setUnpaidAthleteIds(new Set(result.athletes.filter((athlete) => athlete.requiresPayment).map((athlete) => athlete.id)));
        setAthletes((current) => {
          const known = new Set(current.map((athlete) => athlete.id));
          const added = result.athletes
            .filter((athlete) => !known.has(athlete.id))
            .map((athlete) => ({
              id: athlete.id,
              name: athlete.name,
              role: "Athlete",
              age: "N/A",
            }));
          return added.length ? [...current, ...added] : current;
        });
        setBookingIdMap((current) => {
          const next = { ...current };
          result.athletes.forEach((athlete) => {
            next[athlete.id] = athlete.bookingId;
          });
          return next;
        });
      })
      .catch(() => {
        // The public roster still loads when the walk-in list is unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, [slotId, sessionHeader.sessionDate, feedbackData]);

  const handleWalkInAdded = (result: {
    bookingId: string;
    athlete: { id: string; name: string };
    requiresPayment: boolean;
    alreadyAdded: boolean;
  }) => {
    setAthletes((current) =>
      current.some((athlete) => athlete.id === result.athlete.id)
        ? current
        : [...current, { id: result.athlete.id, name: result.athlete.name, role: "Athlete", age: "N/A" }]
    );
    setBookingIdMap((current) => ({ ...current, [result.athlete.id]: result.bookingId }));
    if (result.requiresPayment) {
      setUnpaidAthleteIds((current) => new Set(current).add(result.athlete.id));
    }
    if (slotId) {
      upsertAttendance([buildAttendancePayload(result.bookingId, slotId, result.athlete.id, "present")], {
        onSuccess: () => {
          setAttendance((current) => ({ ...current, [result.athlete.id]: true }));
        },
      });
    }
    toast({
      title: result.alreadyAdded ? "Already on this session" : "Athlete added",
      description: result.requiresPayment
        ? "They can pay from My Sessions. You can mark them present now."
        : "This session has no charge.",
    });
  };

  // Initialize default attendance (all present) if no attendance records exist
  useEffect(() => {
    if (!feedbackData || feedbackData.length === 0 || hasInitializedAttendance.current) return;
    if (!slotId) return;

    const hasAnyAttendanceRecords = feedbackData.some((row) => row.attendance !== null);

    if (!hasAnyAttendanceRecords) {
      const payload = feedbackData.map((row) =>
        buildAttendancePayload(row.booking_id, row.slot_id, row.athlete_id, 'present')
      );

      upsertAttendance(payload, {
        onSuccess: () => {
          hasInitializedAttendance.current = true;
        },
        onError: (error) => {
          toast({
            title: 'Something went wrong',
            description: 'Failed to initialize attendance.',
            variant: 'destructive',
          });
        },
      });
    } else {
      hasInitializedAttendance.current = true;
    }
  }, [feedbackData, slotId, upsertAttendance, toast]);

  const toggleAttendance = useCallback((id: string) => {
    const isPresent = attendance[id];
    if (isPresent) {
      const athlete = athletes.find((item) => item.id === id);
      if (!athlete) return;
      setPendingUnselect(athlete);
      setPendingReason(absentReasons[id] ?? "");
      setReasonError(false);
      return;
    }

    // Re-check athlete as present
    if (!slotId) return;
    const bookingId = bookingIdMap[id];
    if (!bookingId) return;

    const payload = [buildAttendancePayload(bookingId, slotId, id, 'present')];

    upsertAttendance(payload, {
      onSuccess: () => {
        setAttendance((prev) => ({
          ...prev,
          [id]: true,
        }));
        if (absentReasons[id]) {
          setAbsentReasons((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }
      },
      onError: (error) => {
        toast({
          title: 'Something went wrong',
          description: 'Failed to update attendance.',
          variant: 'destructive',
        });
      },
    });
  }, [attendance, athletes, slotId, bookingIdMap, absentReasons, upsertAttendance, toast]);

  const handleSelectAll = (checked: boolean | "indeterminate") => {
    const isChecked = checked === true;
    if (!isChecked) {
      return;
    }
    const next: Record<string, boolean> = {};
    athletes.forEach((athlete) => {
      next[athlete.id] = true;
    });
    setAttendance(next);
  };

  const openFeedbackDialog = (selected: Athlete[]) => {
    const filtered = selected.filter((athlete) => attendance[athlete.id]);
    if (!filtered.length) return;
    setFeedbackDialogAthletes(filtered);
    setFeedbackDialogOpen(true);
  };

  const openProfileDialog = (athlete: Athlete) => {
    setProfileDialogAthlete(athlete);
  };

  const closeDialogs = () => {
    setFeedbackDialogOpen(false);
    setFeedbackDialogAthletes([]);
    setProfileDialogAthlete(null);
  };

  const closeAbsentDialog = () => {
    setPendingUnselect(null);
    setPendingReason("");
    setReasonError(false);
  };


  const confirmAbsent = useCallback(() => {
    if (!pendingUnselect || !slotId) return;
    if (!pendingReason.trim()) {
      setReasonError(true);
      return;
    }

    const bookingId = bookingIdMap[pendingUnselect.id];
    if (!bookingId) {
      toast({
        title: 'Something went wrong',
        description: 'Booking information not found.',
        variant: 'destructive',
      });
      return;
    }

    const payload = [buildAttendancePayload(bookingId, slotId, pendingUnselect.id, 'absent', pendingReason.trim())];

    upsertAttendance(payload, {
      onSuccess: () => {
        setAttendance((prev) => ({
          ...prev,
          [pendingUnselect.id]: false,
        }));
        setAbsentReasons((prev) => ({
          ...prev,
          [pendingUnselect.id]: pendingReason.trim(),
        }));
        closeAbsentDialog();
      },
      onError: (error) => {
        toast({
          title: 'Something went wrong',
          description: 'Failed to save attendance.',
          variant: 'destructive',
        });
      },
    });
  }, [pendingUnselect, slotId, pendingReason, bookingIdMap, upsertAttendance, toast]);

  const handleSubmitFeedback = useCallback(() => {
    if (!slotId || feedbackDialogAthletes.length === 0) return;

    const lockedAthletes = feedbackDialogAthletes.filter((athlete) => athleteFeedbackLocked[athlete.id]);
    if (lockedAthletes.length > 0) {
      toast({
        title: "Feedback locked",
        description: "Feedback is locked after one edit. Contact support for further changes.",
        variant: "destructive",
      });
      return;
    }

    const payloadItems = feedbackDialogAthletes.map((athlete) => {
      const bookingId = bookingIdMap[athlete.id];
      if (!bookingId) {
        throw new Error(`Booking ID not found for athlete ${athlete.id}`);
      }

      return buildFeedbackPayload(bookingId, slotId, athlete.id, {
        rating: athleteRatingMap[athlete.id],
        feedbackToAthlete: athleteFeedbackMap[athlete.id],
        coachOnlyNotes: privateFeedbackMap[athlete.id],
      });
    });

    upsertFeedback(payloadItems, {
      onSuccess: () => {
        toast({
          title: 'Feedback saved',
          description: 'Your feedback is saved.',
        });
        setAthleteFeedbackSubmitted((prev) => {
          const next = { ...prev };
          feedbackDialogAthletes.forEach((athlete) => {
            next[athlete.id] = true;
          });
          return next;
        });
        // After an edit of already-submitted feedback, lock that athlete entry.
        setAthleteFeedbackLocked((prev) => {
          const next = { ...prev };
          feedbackDialogAthletes.forEach((athlete) => {
            if (athleteFeedbackSubmitted[athlete.id]) {
              next[athlete.id] = true;
            }
          });
          return next;
        });
        closeDialogs();
      },
      onError: (error) => {
        const message =
          error instanceof Error && error.message.toLowerCase().includes("locked")
            ? error.message
            : "Failed to submit feedback.";
        toast({
          title: 'Something went wrong',
          description: message,
          variant: 'destructive',
        });
      },
    });
  }, [slotId, feedbackDialogAthletes, bookingIdMap, athleteRatingMap, athleteFeedbackMap, privateFeedbackMap, athleteFeedbackLocked, athleteFeedbackSubmitted, upsertFeedback, toast]);

  const handleCompleteSession = useCallback(() => {
    if (!sessionRating || !slotId) return;

    if (sessionFeedbackLocked) {
      toast({
        title: "Feedback locked",
        description: "Session feedback is locked after one edit. Contact support for further changes.",
        variant: "destructive",
      });
      return;
    }

    const sessionPayload = buildSessionFeedbackPayload(slotId, sessionRating, sessionSummary, coachNotes);

    upsertSessionFeedbackMutation(sessionPayload, {
      onSuccess: () => {
        setCompletionDialogOpen(true);
        setSessionFeedbackCompleted(true);
        if (sessionFeedbackCompleted) {
          setSessionFeedbackLocked(true);
        }
      },
      onError: (error) => {
        const message =
          error instanceof Error && error.message.toLowerCase().includes("locked")
            ? error.message
            : "Failed to save session feedback.";
        toast({
          title: 'Something went wrong',
          description: message,
          variant: 'destructive',
        });
      },
    });
  }, [sessionRating, slotId, sessionSummary, coachNotes, sessionFeedbackLocked, sessionFeedbackCompleted, upsertSessionFeedbackMutation, toast]);

  if (isLoadingData || profileLoading) {
    return (
      <div className="px-4 pb-16 pt-6 lg:px-6" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading session</span>
        <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
          <div className="flex items-center gap-3">
            <Skeleton className="size-[34px] rounded-[8px]" />
            <div className="flex flex-col gap-[10px]">
              <Skeleton className="h-7 w-72 rounded-[6px]" />
              <Skeleton className="h-4 w-56 rounded-[6px]" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
            <div className="flex flex-col gap-6">
              <Skeleton className="h-[180px] rounded-[10px]" />
              <Skeleton className="h-[320px] rounded-[10px]" />
            </div>
            <Skeleton className="h-[360px] rounded-[10px]" />
          </div>
        </div>
      </div>
    );
  }

  const sessionWhen = getSessionWhen(sessionHeader.sessionDate, sessionHeader.startTime, sessionHeader.endTime);
  const sessionRatingShown = sessionHoverRating ?? sessionRating ?? 0;

  return (
    <div className="px-4 pb-16 pt-6 tracking-[-0.03em] text-[#1A202C] lg:px-6">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft className="size-4" strokeWidth={1.5} />
          </Button>
          <div className="flex min-w-0 flex-col gap-[10px]">
            <h1 className="text-[28px] font-bold leading-[30px] tracking-[-0.05em] text-[#1A202C] sm:text-[32px]">
              Check-in and feedback
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <BrandPill tone="neutral">{totalAthletes === 1 ? "Individual session" : "Group session"}</BrandPill>
              <p className="text-[16px] leading-[18px] tracking-[-0.03em] text-[#767980]">
                {[sessionHeader.sessionName, sessionWhen].filter(Boolean).join(", ")}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
          <div className="flex min-w-0 flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#1A202C]">Session overview</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-5 px-[25px] pb-[25px]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-[10px]">
                    <p className="text-[16px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">
                      {sessionHeader.sessionName || "Session"}
                    </p>
                    {sessionHeader.pillar ? (
                      <div>
                        <BrandPill tone="blue">{sessionHeader.pillar}</BrandPill>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-start gap-1.5 sm:items-end">
                    <span className="text-[32px] font-bold leading-[30px] tracking-[-0.03em] text-[#1A202C]">
                      {sessionHeader.rateCents !== null ? formatWholePrice(sessionHeader.rateCents) : "$0"}
                    </span>
                    <span className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">per athlete</span>
                  </div>
                </div>
                <div className="h-px bg-[#EAEADF]" />
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  {sessionHeader.coachName ? <OverviewField label="Coach">{sessionHeader.coachName}</OverviewField> : null}
                  {sessionHeader.locationType ? (
                    <OverviewField label="Location">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="size-4 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
                        {formatLocationSentence(sessionHeader.locationType)}
                      </span>
                    </OverviewField>
                  ) : null}
                  {sessionWhen ? <OverviewField label="When">{sessionWhen}</OverviewField> : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div className="flex flex-col gap-[10px]">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-[#1A202C]">Attendance</CardTitle>
                    <BrandPill tone="amber">Required</BrandPill>
                  </div>
                  <p className={cn(bodyClass, "text-[#767980]")}>Mark who attended this session.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className={cn(bodyClass, "flex cursor-pointer items-center gap-2 text-[#484D56]")}>
                    <Checkbox
                      checked={allSelected ? true : attendedCount === 0 ? false : "indeterminate"}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all athletes"
                    />
                    Select all
                  </label>
                  <BrandPill tone="blue">{attendedCount} selected</BrandPill>
                  <Button type="button" size="sm" variant="outline" onClick={() => setWalkInOpen(true)}>
                    <UserPlus className="size-4" strokeWidth={1.5} aria-hidden="true" />
                    Add athlete
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-[10px] px-[25px] pb-[25px]">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#A3A6AB]"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <Input
                    placeholder="Search athletes"
                    aria-label="Search athletes"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full pl-9"
                  />
                </div>
                {dataError ? (
                  <p className={cn(bodyClass, "text-destructive")}>
                    We couldn't load this session's athletes. Refresh the page to try again.
                  </p>
                ) : athletes.length === 0 ? (
                  <ListNote>No athletes on this session yet. Use Add athlete to add a walk-in.</ListNote>
                ) : filteredAthletes.length === 0 ? (
                  <ListNote>No athletes match your search.</ListNote>
                ) : null}
                <div className="flex max-h-[380px] flex-col gap-[10px] overflow-y-auto">
                  {filteredAthletes.map((athlete) => {
                    const isPresent = attendance[athlete.id];
                    const meta = getAthleteMeta(athlete);
                    return (
                      <button
                        key={athlete.id}
                        type="button"
                        onClick={() => {
                          if (!sessionFeedbackCompleted) {
                            toggleAttendance(athlete.id);
                          }
                        }}
                        className={cn(
                          "flex w-full flex-col gap-3 rounded-[8px] border border-[#EAEADF] px-4 py-3 text-left transition-colors sm:flex-row sm:items-center",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]",
                          isPresent ? "bg-[#F4F4EB] hover:bg-[#EAEADF]" : "bg-transparent hover:bg-[#F4F4EB]"
                        )}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <Checkbox
                            checked={isPresent}
                            onCheckedChange={() => {
                              if (!sessionFeedbackCompleted) {
                                toggleAttendance(athlete.id);
                              }
                            }}
                            onClick={(event) => event.stopPropagation()}
                            aria-label={`Mark ${athlete.name} as attended`}
                          />
                          <AthleteAvatar athlete={athlete} />
                          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-[16px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">
                                {athlete.name}
                              </p>
                              {unpaidAthleteIds.has(athlete.id) ? <BrandPill tone="amber">Awaiting payment</BrandPill> : null}
                              {!isPresent ? <BrandPill tone="muted">Absent</BrandPill> : null}
                            </div>
                            {meta ? <p className={cn(bodyClass, "truncate text-[#767980]")}>{meta}</p> : null}
                          </div>
                        </div>
                        {isPresent && (
                          <div className="flex w-full flex-wrap items-center gap-[10px] sm:w-auto sm:flex-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 sm:flex-none"
                              onClick={(event) => {
                                event.stopPropagation();
                                openFeedbackDialog([athlete]);
                              }}
                            >
                              {athleteFeedbackLocked[athlete.id]
                                ? "View feedback"
                                : athleteFeedbackSubmitted[athlete.id]
                                ? "Edit feedback"
                                : "Add feedback"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 sm:flex-none"
                              onClick={(event) => {
                                event.stopPropagation();
                                openProfileDialog(athlete);
                              }}
                            >
                              <User className="size-4" strokeWidth={1.5} aria-hidden="true" />
                              Profile
                            </Button>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <AddWalkInAthleteDialog
              open={walkInOpen}
              onOpenChange={setWalkInOpen}
              slotId={slotId || ""}
              sessionDate={sessionHeader.sessionDate}
              onAdded={handleWalkInAdded}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-[#1A202C]">Session feedback</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-5 px-[25px] pb-[25px]">
                {sessionFeedbackLocked ? (
                  <p className={cn(bodyClass, "text-[#767980]")}>
                    Session feedback is locked after one edit. Contact support if you need a further change.
                  </p>
                ) : sessionFeedbackCompleted ? (
                  <p className={cn(bodyClass, "text-[#767980]")}>
                    You can make one update to this session feedback.
                  </p>
                ) : null}
                <div className="flex flex-col gap-[10px]">
                  <div className="flex items-center gap-2">
                    <span className={fieldLabelClass}>
                      Overall rating
                    </span>
                    <BrandPill tone="amber">Required</BrandPill>
                  </div>
                  <div className="flex items-center gap-3">
                    {sessionFeedbackLocked ? (
                      <>
                        <ReadOnlyStars value={sessionRatingShown} />
                        {sessionRatingShown > 0 ? (
                          <span className="text-[16px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">
                            {sessionRatingShown} of 5
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <RatingStars
                          label="Overall session rating"
                          value={sessionRatingShown}
                          onChange={(val) => setSessionRating(val)}
                          onHover={(val) => setSessionHoverRating(val)}
                          onLeave={() => setSessionHoverRating(null)}
                        />
                        {sessionRatingShown > 0 ? (
                          <span className="text-[16px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]" aria-live="polite">
                            {sessionRatingShown} of 5
                          </span>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-[10px]">
                  <label htmlFor="session-summary" className={fieldLabelClass}>
                    Session summary
                  </label>
                  <Textarea
                    id="session-summary"
                    value={sessionSummary}
                    onChange={(event) => setSessionSummary(event.target.value)}
                    placeholder="Key focus areas and general observations"
                    readOnly={sessionFeedbackLocked}
                    disabled={sessionFeedbackLocked}
                    className={cn(textareaClass, "min-h-[140px]", sessionFeedbackLocked && "disabled:cursor-default disabled:opacity-100")}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#1A202C]">Payment summary</CardTitle>
                <p className={cn(bodyClass, "text-[#767980]")}>Based on confirmed attendance.</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 px-[25px] pb-[25px]">
                <SummaryRow label="Rate per athlete" value={formatCurrency(ratePerAthlete)} />
                <SummaryRow label="Athletes attended" value={attendedCount} />
                <div className="h-px bg-[#EAEADF]" />
                <SummaryRow label="Session total" value={formatCurrency(sessionTotal)} />
                <div className="flex items-center justify-between gap-3 rounded-[8px] bg-[#F4F4EB] p-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[16px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">Your payout</span>
                    <span className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">Paid to you as the coach</span>
                  </div>
                  <span className="text-[32px] font-bold leading-[30px] tracking-[-0.03em] text-[#1A202C]">
                    {formatCurrency(payout)}
                  </span>
                </div>
                <div className="h-px bg-[#EAEADF]" />
                <div className="flex flex-col gap-3">
                  <SummaryRow
                    label="Total athletes"
                    value={totalAthletes}
                    icon={<Users className="size-4" strokeWidth={1.5} aria-hidden="true" />}
                  />
                  <SummaryRow
                    label="Attended"
                    value={attendedCount}
                    icon={<UserCheck2 className="size-4" strokeWidth={1.5} aria-hidden="true" />}
                  />
                  <SummaryRow
                    label="Absent"
                    value={absentCount}
                    icon={<UserX className="size-4" strokeWidth={1.5} aria-hidden="true" />}
                  />
                </div>
                <div className="h-px bg-[#EAEADF]" />
                <div className="flex flex-col gap-[10px]">
                  {sessionFeedbackLocked ? (
                    <Button
                      asChild
                      size="lg"
                      className="w-full text-[16px]"
                    >
                      <Link to={ROUTES.CONTACT_US}>Contact support</Link>
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      className="w-full text-[16px] disabled:opacity-60"
                      disabled={!sessionRating || isUpdatingSessionFeedback}
                      onClick={handleCompleteSession}
                    >
                      {sessionFeedbackCompleted ? (
                        <Check className="size-4" strokeWidth={1.5} aria-hidden="true" />
                      ) : (
                        <SendHorizontal className="size-4" strokeWidth={1.5} aria-hidden="true" />
                      )}
                      {isUpdatingSessionFeedback
                        ? "Saving..."
                        : sessionFeedbackCompleted
                        ? "Update session feedback"
                        : "Complete session and send"}
                    </Button>
                  )}
                  {!sessionRating && !sessionFeedbackLocked && (
                    <p className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
                      Add an overall rating to complete the session.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog
        open={feedbackDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDialogs();
          }
        }}
      >
        <DialogContent className={cn(dialogShellClass, "sm:max-w-[720px]")}>
          <DialogHeader className={cn(dialogSectionClass, "space-y-1.5 pr-14 text-left")}>
            <DialogTitle className={dialogTitleClass}>Athlete feedback</DialogTitle>
            <DialogDescription className={dialogDescriptionClass}>
              {feedbackDialogAthletes.some((athlete) => athleteFeedbackLocked[athlete.id])
                ? "Locked feedback is read-only. Contact support for further changes."
                : "Share highlights and notes for each athlete."}
            </DialogDescription>
          </DialogHeader>
          <Divider />
          {feedbackDialogAthletes.length > 0 && (
            <div className="flex max-h-[65vh] flex-col overflow-y-auto">
              {feedbackDialogAthletes.map((athlete, index) => {
                const athleteRating = athleteRatingMap[athlete.id];
                const athleteRatingShown = athleteHoverRatingMap[athlete.id] ?? athleteRating ?? 0;
                const athleteScore = athleteScoreMap[athlete.id];
                const isLocked = Boolean(athleteFeedbackLocked[athlete.id]);
                const meta = getAthleteMeta(athlete);
                return (
                  <div key={athlete.id}>
                    <div className={cn(dialogSectionClass, "flex flex-col gap-5")}>
                      <div className="flex items-center gap-3">
                        <AthleteAvatar athlete={athlete} />
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <p className="text-[16px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">{athlete.name}</p>
                          {meta ? <p className={cn(bodyClass, "text-[#767980]")}>{meta}</p> : null}
                        </div>
                        {feedbackDialogAthletes.length > 1 ? (
                          <BrandPill tone="neutral" className="shrink-0">
                            {index + 1} of {feedbackDialogAthletes.length}
                          </BrandPill>
                        ) : null}
                      </div>

                      {isLocked ? (
                        <p className={cn(bodyClass, "text-[#767980]")}>
                          This athlete feedback is locked after one edit.
                        </p>
                      ) : null}

                      <div className="flex flex-col gap-[10px] rounded-[8px] bg-[#F4F4EB] p-4">
                        <p className="text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">From the athlete</p>
                        {athleteScore ? (
                          <div className="flex items-center gap-2">
                            <ReadOnlyStars value={athleteScore} />
                            <span className={cn(bodyClass, "text-[#484D56]")}>{athleteScore} of 5</span>
                          </div>
                        ) : (
                          <p className={cn(bodyClass, "text-[#767980]")}>No rating yet</p>
                        )}
                        <p className={cn(bodyClass, athleteNoteMap[athlete.id] ? "text-[#484D56]" : "text-[#767980]")}>
                          {athleteNoteMap[athlete.id] || "No note yet"}
                        </p>
                      </div>

                      <div className="flex flex-col gap-[10px]">
                        <p className={fieldLabelClass}>
                          Your rating of this athlete <span className="font-normal text-[#767980]">(optional)</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                          {isLocked ? (
                            <>
                              <ReadOnlyStars value={athleteRatingShown} />
                              {athleteRatingShown > 0 ? (
                                <span className="text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">
                                  {athleteRatingShown} of 5
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <RatingStars
                                size="sm"
                                label={`Rating for ${athlete.name}`}
                                value={athleteRatingShown}
                                onChange={(val) =>
                                  setAthleteRatingMap((prev) => ({ ...prev, [athlete.id]: val }))
                                }
                                onHover={(val) =>
                                  setAthleteHoverRatingMap((prev) => ({ ...prev, [athlete.id]: val }))
                                }
                                onLeave={() =>
                                  setAthleteHoverRatingMap((prev) => ({ ...prev, [athlete.id]: null }))
                                }
                              />
                              {athleteRatingShown > 0 ? (
                                <span className="text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">
                                  {athleteRatingShown} of 5
                                </span>
                              ) : null}
                              {athleteRating && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="px-2 text-[14px] text-[#767980]"
                                  onClick={() =>
                                    setAthleteRatingMap((prev) => ({ ...prev, [athlete.id]: undefined }))
                                  }
                                >
                                  Clear
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-[10px]">
                        <label htmlFor={`feedback-to-athlete-${athlete.id}`} className={fieldLabelClass}>
                          Feedback to the athlete or parent
                        </label>
                        <Textarea
                          id={`feedback-to-athlete-${athlete.id}`}
                          value={athleteFeedbackMap[athlete.id] ?? ""}
                          onChange={(event) =>
                            setAthleteFeedbackMap((prev) => ({
                              ...prev,
                              [athlete.id]: event.target.value,
                            }))
                          }
                          placeholder={`For example, ${athlete.name} commanded the box well and improved footwork`}
                          readOnly={isLocked}
                          disabled={isLocked}
                          className={cn(textareaClass, "min-h-[110px]", isLocked && "disabled:cursor-default disabled:opacity-100")}
                        />
                      </div>
                      <div className="flex flex-col gap-[10px]">
                        <label htmlFor={`coach-notes-${athlete.id}`} className={fieldLabelClass}>
                          Coach-only notes <span className="font-normal text-[#767980]">(optional)</span>
                        </label>
                        <Textarea
                          id={`coach-notes-${athlete.id}`}
                          value={privateFeedbackMap[athlete.id] ?? ""}
                          onChange={(event) =>
                            setPrivateFeedbackMap((prev) => ({
                              ...prev,
                              [athlete.id]: event.target.value,
                            }))
                          }
                          placeholder="Only you can see these notes"
                          readOnly={isLocked}
                          disabled={isLocked}
                          className={cn(textareaClass, "min-h-[90px]", isLocked && "disabled:cursor-default disabled:opacity-100")}
                        />
                      </div>
                    </div>
                    {index < feedbackDialogAthletes.length - 1 && <Divider />}
                  </div>
                );
              })}
            </div>
          )}
          <Divider />
          <div className={cn(dialogSectionClass, "flex flex-col-reverse gap-[10px] sm:flex-row sm:items-center sm:justify-between")}>
            <Button variant="ghost" className="text-[#767980]" disabled>
              <NotebookPen className="size-4" strokeWidth={1.5} aria-hidden="true" />
              Save as draft
            </Button>
            <div className="flex flex-col-reverse gap-[10px] sm:flex-row">
              <Button variant="outline" onClick={closeDialogs}>
                {feedbackDialogAthletes.some((athlete) => athleteFeedbackLocked[athlete.id]) ? "Close" : "Cancel"}
              </Button>
              {feedbackDialogAthletes.every((athlete) => athleteFeedbackLocked[athlete.id]) ? (
                <Button asChild>
                  <Link to={ROUTES.CONTACT_US}>Contact support</Link>
                </Button>
              ) : (
                <Button
                  onClick={handleSubmitFeedback}
                  disabled={
                    isSubmittingFeedback ||
                    feedbackDialogAthletes.some((athlete) => athleteFeedbackLocked[athlete.id])
                  }
                >
                  {isSubmittingFeedback ? "Saving..." : "Save feedback"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(profileDialogAthlete)}
        onOpenChange={(open) => {
          if (!open) {
            closeDialogs();
          }
        }}
      >
        <DialogContent className={cn(dialogShellClass, "sm:max-w-xl")}>
          {profileDialogAthlete && (
            <>
              <DialogHeader className={cn(dialogSectionClass, "space-y-0 pr-14 text-left")}>
                <DialogTitle className={dialogTitleClass}>Athlete profile</DialogTitle>
                <DialogDescription className="sr-only">Details for {profileDialogAthlete.name}</DialogDescription>
              </DialogHeader>
              <Divider />
              <div className={cn(dialogSectionClass, "flex max-h-[65vh] flex-col gap-5 overflow-y-auto")}>
                <div className="flex items-center gap-4">
                  <AthleteAvatar athlete={profileDialogAthlete} className="h-16 w-16" />
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <p className="text-[20px] font-medium leading-[24px] tracking-[-0.05em] text-[#1A202C]">
                      {profileDialogAthlete.name}
                    </p>
                    {getAthleteMeta(profileDialogAthlete) ? (
                      <p className={cn(bodyClass, "text-[#767980]")}>{getAthleteMeta(profileDialogAthlete)}</p>
                    ) : null}
                    {attendance[profileDialogAthlete.id] !== undefined && (
                      <div>
                        {attendance[profileDialogAthlete.id] ? (
                          <BrandPill tone="green">
                            <Check className="size-3" strokeWidth={1.5} aria-hidden="true" />
                            Attended this session
                          </BrandPill>
                        ) : (
                          <BrandPill tone="muted">Marked absent</BrandPill>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {(profileDialogAthlete.hometown || profileDialogAthlete.school || profileDialogAthlete.goals) && (
                  <div className="flex flex-col gap-3">
                    <p className={fieldLabelClass}>Information</p>
                    <div className="flex flex-col gap-3">
                      {profileDialogAthlete.hometown && (
                        <div className="flex items-start gap-3">
                          <MapPin className="mt-0.5 size-4 shrink-0 text-[#A3A6AB]" strokeWidth={1.5} aria-hidden="true" />
                          <div className="flex flex-col gap-1.5">
                            <span className={labelClass}>Location</span>
                            <span className={cn(bodyClass, "text-[#1A202C]")}>{profileDialogAthlete.hometown}</span>
                          </div>
                        </div>
                      )}
                      {profileDialogAthlete.school && (
                        <div className="flex items-start gap-3">
                          <NotebookPen className="mt-0.5 size-4 shrink-0 text-[#A3A6AB]" strokeWidth={1.5} aria-hidden="true" />
                          <div className="flex flex-col gap-1.5">
                            <span className={labelClass}>School</span>
                            <span className={cn(bodyClass, "text-[#1A202C]")}>{profileDialogAthlete.school}</span>
                          </div>
                        </div>
                      )}
                      {profileDialogAthlete.goals && (
                        <div className="flex items-start gap-3">
                          <CalendarDays className="mt-0.5 size-4 shrink-0 text-[#A3A6AB]" strokeWidth={1.5} aria-hidden="true" />
                          <div className="flex flex-col gap-1.5">
                            <span className={labelClass}>Goals</span>
                            <span className={cn(bodyClass, "text-[#1A202C]")}>{profileDialogAthlete.goals}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {profileDialogAthlete.bio && (
                  <div className="flex flex-col gap-[10px]">
                    <p className={fieldLabelClass}>About</p>
                    <p className={cn(bodyClass, "text-[#484D56]")}>{profileDialogAthlete.bio}</p>
                  </div>
                )}

                {profileDialogAthlete.interests && profileDialogAthlete.interests.length > 0 && (
                  <div className="flex flex-col gap-[10px]">
                    <p className={fieldLabelClass}>Key skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profileDialogAthlete.interests.map((interest) => (
                        <BrandPill key={interest} tone="neutral">
                          {interest}
                        </BrandPill>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Divider />
              <div className={cn(dialogSectionClass, "flex justify-end")}>
                <Button variant="outline" onClick={closeDialogs}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingUnselect)} onOpenChange={(open) => !open && closeAbsentDialog()}>
        <DialogContent className={cn(dialogShellClass, "sm:max-w-md")}>
          <DialogHeader className={cn(dialogSectionClass, "space-y-1.5 pr-14 text-left")}>
            <DialogTitle className={dialogTitleClass}>Mark as absent</DialogTitle>
            <DialogDescription className={dialogDescriptionClass}>
              Add a short reason this athlete didn't attend.
            </DialogDescription>
          </DialogHeader>
          <Divider />
          {pendingUnselect && (
            <div className={cn(dialogSectionClass, "flex flex-col gap-5")}>
              <div className="flex items-center gap-3">
                <AthleteAvatar athlete={pendingUnselect} />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <p className="text-[16px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">{pendingUnselect.name}</p>
                  {getAthleteMeta(pendingUnselect) ? (
                    <p className={cn(bodyClass, "text-[#767980]")}>{getAthleteMeta(pendingUnselect)}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col gap-[10px]">
                <label htmlFor="absent-reason" className={fieldLabelClass}>
                  Reason
                </label>
                <Textarea
                  id="absent-reason"
                  value={pendingReason}
                  onChange={(event) => {
                    setPendingReason(event.target.value);
                    if (reasonError) setReasonError(false);
                  }}
                  placeholder="For example, injury, illness or a schedule conflict"
                  aria-invalid={reasonError}
                  className={cn(textareaClass, "min-h-[110px]", reasonError && "border-destructive focus-visible:ring-destructive")}
                />
                {reasonError && <p className="text-[12px] leading-[14px] tracking-[-0.03em] text-destructive">Add a reason to continue.</p>}
              </div>
            </div>
          )}
          <Divider />
          <div className={cn(dialogSectionClass, "flex flex-col-reverse gap-[10px] sm:flex-row sm:justify-end")}>
            <Button variant="outline" onClick={closeAbsentDialog}>
              Cancel
            </Button>
            <Button onClick={confirmAbsent}>Save reason</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={completionDialogOpen} onOpenChange={setCompletionDialogOpen}>
        <DialogContent className={cn(dialogShellClass, "sm:max-w-xl")}>
          <DialogHeader className={cn(dialogSectionClass, "space-y-1.5 pr-14 text-left")}>
            <div className="flex items-center gap-[10px]">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-[#CBE7D1] text-[#1E7431]" aria-hidden="true">
                <Check className="size-4" strokeWidth={1.5} />
              </span>
              <DialogTitle className={dialogTitleClass}>Session completed</DialogTitle>
            </div>
            <DialogDescription className={dialogDescriptionClass}>Your session feedback is saved.</DialogDescription>
          </DialogHeader>
          <Divider />
          <div className={cn(dialogSectionClass, "flex flex-col gap-5")}>
            <div className="flex flex-col gap-1.5">
              <p className="text-[16px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">{sessionInfo.title || "Session"}</p>
              {getSessionWhen(sessionInfo.date, sessionInfo.startTime, sessionInfo.endTime) ? (
                <p className={cn(bodyClass, "text-[#767980]")}>
                  {getSessionWhen(sessionInfo.date, sessionInfo.startTime, sessionInfo.endTime)}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2">
              <div className="flex flex-col gap-[10px] rounded-[8px] bg-[#F4F4EB] p-4">
                <span className={labelClass}>Athletes attended</span>
                <span className="text-[32px] font-bold leading-[30px] tracking-[-0.03em] text-[#1A202C]">{attendedCount}</span>
              </div>
              <div className="flex flex-col gap-[10px] rounded-[8px] bg-[#F4F4EB] p-4">
                <span className={labelClass}>Your payout</span>
                <span className="text-[32px] font-bold leading-[30px] tracking-[-0.03em] text-[#1A202C]">{formatCurrency(payout)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-[10px]">
              <span className={labelClass}>Attended athletes</span>
              {attendedAthletes.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {attendedAthletes.map((athlete) => (
                    <BrandPill key={athlete.id} tone="neutral" className="py-[3px] pl-[3px]">
                      <Avatar className="size-4">
                        {athlete.avatar ? <AvatarImage src={athlete.avatar} alt="" /> : null}
                        <AvatarFallback className="bg-[#E5EDF7] text-[8px] font-medium text-[#0054B4]">
                          {getInitials(athlete.name)}
                        </AvatarFallback>
                      </Avatar>
                      {athlete.name}
                    </BrandPill>
                  ))}
                </div>
              ) : (
                <p className={cn(bodyClass, "text-[#767980]")}>No attendees recorded.</p>
              )}
            </div>
          </div>
          <Divider />
          <div className={cn(dialogSectionClass, "flex flex-col-reverse gap-[10px] sm:flex-row sm:justify-end")}>
            <Button variant="outline" onClick={() => setCompletionDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={() => navigate('/profile')}>Go to profile</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CoachSessionFeedback;
