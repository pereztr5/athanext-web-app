import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Mail,
  MapPin,
  NotebookPen,
  Phone,
  SendHorizontal,
  ShieldCheck,
  User,
  UserCheck2,
  UserX,
  Users,
} from "lucide-react";

import { useCoachSessionFeedback, useUpsertSlotAttendance, useUpsertSlotFeedback, useUpsertSessionFeedback } from "@/hooks/useCoachSessionFeedback";
import { mapRpcRowToAthlete, buildAttendancePayload, buildFeedbackPayload, buildSessionFeedbackPayload } from "@/utils/sessionFeedbackHelpers";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/contexts/ProfileContext";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import RatingStars from "@/components/ui/RatingStars";
import { formatSessionPrice, formatSlotTime, formatSessionDate, getLocationLabel } from "@/utils/sessionFormatting";
import { PRIMARY } from "@/config/colors";

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

const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

 

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
  const [athleteHoverRatingMap, setAthleteHoverRatingMap] = useState<Record<string, number | null>>({});
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [sessionFeedbackCompleted, setSessionFeedbackCompleted] = useState(false);
  const [athleteFeedbackSubmitted, setAthleteFeedbackSubmitted] = useState<Record<string, boolean>>({});

  const hasInitializedAttendance = useRef(false);

  // Backend hooks
  const { data: feedbackData, isLoading: isLoadingData, error: dataError } = useCoachSessionFeedback(slotId || undefined);
  const { mutate: upsertAttendance, isPending: isUpdatingAttendance } = useUpsertSlotAttendance(slotId || undefined);
  const { mutate: upsertFeedback, isPending: isSubmittingFeedback } = useUpsertSlotFeedback(slotId || undefined);
  const { mutate: upsertSessionFeedbackMutation, isPending: isUpdatingSessionFeedback } = useUpsertSessionFeedback(slotId || undefined);

  console.log("isUpdatingAttendance", isUpdatingAttendance);
  console.log("isUpdatingSessionFeedback", isUpdatingSessionFeedback);
  console.log("feedbackData", feedbackData);

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

    console.log('🔐 PROFILE & SLOT CHECK:', {
      slotId,
      profileType: profile.type,
      profileData: profile.data,
      hasCoachData: profile.type === 'coach' && !!profile.data
    });

    if (profile.type !== 'coach' || !profile.data) {
      toast({
        title: 'Access Denied',
        description: 'Only coaches can access this page.',
        variant: 'destructive',
      });
      navigate(-1);
      return;
    }

    if (!slotId) {
      toast({
        title: 'Invalid Session',
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
        title: 'Error',
        description: 'Failed to load session data.',
        variant: 'destructive',
      });
    }
  }, [dataError, toast]);

  // Load data from backend
  useEffect(() => {
    console.log('📥 API DATA FETCH:', { slotId, feedbackData, isLoadingData, dataError, feedbackDataLength: feedbackData?.length });
    if (!feedbackData || feedbackData.length === 0) {
      console.warn('⚠️ NO FEEDBACK DATA RETURNED for slotId:', slotId);
      return;
    }

    // Log first row to debug session metadata
    if (feedbackData.length > 0) {
      console.log('📋 FIRST ROW DATA:', feedbackData[0]);
      console.log('📋 FIRST ROW KEYS:', Object.keys(feedbackData[0]));
      console.log('📋 athlete_name:', feedbackData[0].athlete_name);
      console.log('📋 athlete_id:', feedbackData[0].athlete_id);
      console.log('📋 booking_id:', feedbackData[0].booking_id);
    }

    const athletesData: Athlete[] = [];
    const attendanceData: Record<string, boolean> = {};
    const absentReasonsData: Record<string, string> = {};
    const ratingsData: Record<string, number | undefined> = {};
    const feedbackData_: Record<string, string> = {};
    const privateFeedbackData: Record<string, string> = {};
    const bookingMap: Record<string, string> = {};
    const submittedMap: Record<string, boolean> = {};

    let sessionRatingFromDB: number | null = null;
    let sessionSummaryFromDB: string | null = null;
    let coachNotesFromDB: string | null = null;

    feedbackData.forEach((row) => {
      const athlete = mapRpcRowToAthlete(row);
      athletesData.push(athlete);
      bookingMap[athlete.id] = row.booking_id;

      const isPresent = row.attendance !== 'absent';
      attendanceData[athlete.id] = isPresent;

      if (row.reason_absent) {
        absentReasonsData[athlete.id] = row.reason_absent;
      }

      if (row.rating) {
        ratingsData[athlete.id] = row.rating;
      }

      if (row.feedback_to_athlete) {
        feedbackData_[athlete.id] = row.feedback_to_athlete;
      }

      if (row.coach_only_notes) {
        privateFeedbackData[athlete.id] = row.coach_only_notes;
      }

      if (
        row.rating !== null ||
        (row.feedback_to_athlete && row.feedback_to_athlete.trim()) ||
        (row.coach_only_notes && row.coach_only_notes.trim())
      ) {
        submittedMap[athlete.id] = true;
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
    });

    setAthletes(athletesData);
    setBookingIdMap(bookingMap);
    setAttendance(attendanceData);
    setAbsentReasons(absentReasonsData);
    setAthleteRatingMap(ratingsData);
    setAthleteFeedbackMap(feedbackData_);
    setPrivateFeedbackMap(privateFeedbackData);
    setAthleteFeedbackSubmitted(submittedMap);

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

    console.log('✅ DATA LOADED:', { athletesCount: athletesData.length, athletes: athletesData, attendance: attendanceData });
  }, [feedbackData]);

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
            title: 'Error',
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
          title: 'Error',
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
        title: 'Error',
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
          title: 'Error',
          description: 'Failed to save attendance.',
          variant: 'destructive',
        });
      },
    });
  }, [pendingUnselect, slotId, pendingReason, bookingIdMap, upsertAttendance, toast]);

  const handleSubmitFeedback = useCallback(() => {
    if (!slotId || feedbackDialogAthletes.length === 0) return;

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
          title: 'Success',
          description: 'Feedback submitted successfully.',
        });
        setAthleteFeedbackSubmitted((prev) => {
          const next = { ...prev };
          feedbackDialogAthletes.forEach((athlete) => {
            next[athlete.id] = true;
          });
          return next;
        });
        closeDialogs();
      },
      onError: (error) => {
        toast({
          title: 'Error',
          description: 'Failed to submit feedback.',
          variant: 'destructive',
        });
      },
    });
  }, [slotId, feedbackDialogAthletes, bookingIdMap, athleteRatingMap, athleteFeedbackMap, privateFeedbackMap, upsertFeedback, toast]);

  const handleCompleteSession = useCallback(() => {
    if (!sessionRating || !slotId) return;

    const sessionPayload = buildSessionFeedbackPayload(slotId, sessionRating, sessionSummary, coachNotes);

    upsertSessionFeedbackMutation(sessionPayload, {
      onSuccess: () => {
        setCompletionDialogOpen(true);
        setSessionFeedbackCompleted(true);
      },
      onError: (error) => {
        toast({
          title: 'Error',
          description: 'Failed to save session feedback.',
          variant: 'destructive',
        });
      },
    });
  }, [sessionRating, slotId, sessionSummary, coachNotes, upsertSessionFeedbackMutation, toast]);

  if (isLoadingData || profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 pt-24 pb-16 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-slate-600">Loading session data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4 lg:px-6 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="rounded-xl h-10 w-10 p-0 border bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 hidden sm:inline-flex"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5 text-blue-600" />
            </Button>
            <Button
              variant="ghost"
              className="rounded-xl h-10 w-10 p-0 border bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 inline-flex sm:hidden flex-shrink-0"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5 text-blue-600" />
            </Button>
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">
                {totalAthletes === 1 ? "Individual" : "Group"} Session - Check-in &amp; Feedback
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {sessionHeader.sessionName || ""}
                {sessionHeader.sessionDate ? ` • ${formatSessionDate(sessionHeader.sessionDate)}` : ""}
                {sessionHeader.startTime && sessionHeader.endTime
                  ? ` • ${formatSlotTime(sessionHeader.startTime)} - ${formatSlotTime(sessionHeader.endTime)}`
                  : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_360px] gap-6">
          <div className="space-y-6">
            <Card className="rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-slate-800">Session Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-slate-800">{sessionHeader.sessionName || "Session"}</p>
                    {sessionHeader.pillar && (
                      <p className="text-sm text-slate-600">
                        <span className="font-medium text-slate-800">Pillar:</span>{" "}
                        <span>{sessionHeader.pillar}</span>
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl bg-blue-50 px-4 py-2 text-right border border-blue-100 min-w-[140px]">
                    <p className="text-xs text-slate-600">Rate per athlete</p>
                    <p className="text-lg font-semibold text-blue-700">
                      {sessionHeader.rateCents !== null ? formatSessionPrice(sessionHeader.rateCents) : "$0"}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium text-slate-800">Coach:</span>{" "}
                    <span className="text-blue-700 font-semibold">{sessionHeader.coachName || ""}</span>
                  </p>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    <span>{sessionHeader.locationType ? getLocationLabel(sessionHeader.locationType as 'online' | 'in-person') : ""}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
            <div className="p-4 pt-5">
              <Input
                placeholder="Search athletes"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-10 w-full"
              />
            </div>
            <CardHeader className="pb-3 flex-row items-center justify-between gap-3 flex-wrap md:flex-nowrap">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  Attendance
                  <Badge className="bg-red-50 text-red-700 border-red-200 text-xs">
                      Required
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Mark athletes who attended this session.
                  </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={allSelected ? true : attendedCount === 0 ? false : "indeterminate"}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all athletes"
                    className="rounded-md"
                  />
                  <span>Select all</span>
                </div>
                <div className="text-sm font-medium text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-full">
                  {attendedCount} selected
                </div>
              </div>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[360px] overflow-y-auto pr-2">
                {filteredAthletes.map((athlete) => {
                  const isPresent = attendance[athlete.id];
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
                        "w-full text-left rounded-xl border px-3 py-3 flex flex-col sm:flex-row sm:items-start gap-3 md:gap-4 transition-all",
                        "hover:border-blue-200 hover:bg-blue-50/60",
                        isPresent ? "border-blue-200 bg-blue-50/70" : "border-border bg-white"
                      )}
                    >
                      <Checkbox
                        checked={isPresent}
                        onCheckedChange={() => {
                          if (!sessionFeedbackCompleted) {
                            toggleAttendance(athlete.id);
                          }
                        }}
                        onClick={(event) => event.stopPropagation()}
                        className="rounded-md"
                        aria-label={`Mark ${athlete.name} as attended`}
                      />
                      <Avatar className="h-12 w-12">
                        {athlete.avatar ? (
                          <AvatarImage src={athlete.avatar} alt={athlete.name} />
                        ) : (
                          <AvatarFallback className="bg-blue-100 text-blue-700">
                            {getInitials(athlete.name)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {athlete.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {athlete.role} | {athlete.age}
                          {athlete.level ? ` | ${athlete.level}` : ""}
                        </p>
                      </div>
                      {isPresent && (
                        <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center w-full sm:w-auto">
                          <Button
                            size="sm"
                            className="w-full sm:w-auto px-3 py-2 text-[13px] rounded-full transition-all flex items-center justify-center gap-1.5 bg-amber-50 border border-amber-400 text-amber-700 hover:bg-amber-100"
                            onClick={(event) => {
                              event.stopPropagation();
                              openFeedbackDialog([athlete]);
                            }}
                          >
                            {athleteFeedbackSubmitted[athlete.id] ? 'Feedback Submitted' : 'Add Feedback'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto px-3 py-2 text-[13px] rounded-full transition-all border border-[#0d7ff2] text-[#0d7ff2] hover:bg-blue-50 flex items-center justify-center gap-1.5"
                            style={{
                              borderColor: PRIMARY.main,
                              color: PRIMARY.main,
                              backgroundColor: "hsla(210,90%,50%,0.08)",
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              openProfileDialog(athlete);
                            }}
                          >
                            <span className="inline-flex items-center gap-1 ">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              Profile
                            </span>
                          </Button>
                        </div>
                      )}
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Overall Session Feedback</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-800">
                    Overall session rating <span className="text-red-600">*</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <RatingStars
                      label="Overall session rating"
                      value={sessionHoverRating ?? sessionRating ?? 0}
                      onChange={(val) => setSessionRating(val)}
                      onHover={(val) => setSessionHoverRating(val)}
                      onLeave={() => setSessionHoverRating(null)}
                    />
                    <span className="text-sm font-semibold text-slate-900">
                      {(sessionHoverRating ?? sessionRating ?? 0).toFixed(1)}
                    </span>
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-800">Session summary</p>
                <Textarea
                  value={sessionSummary}
                  onChange={(event) => setSessionSummary(event.target.value)}
                  placeholder="Provide an overall summary of the session, key focus areas, and general observations..."
                  className="min-h-[140px] bg-slate-50"
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-blue-100">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Payment Summary</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Based on confirmed attendance.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Rate per athlete</span>
                  <span className="font-semibold text-slate-800">
                    {formatCurrency(ratePerAthlete)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Athletes attended</span>
                  <span className="font-semibold text-slate-800">
                    {attendedCount}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Session total</span>
                  <span className="font-semibold text-slate-800">
                    {formatCurrency(sessionTotal)}
                  </span>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-700">
                        Your payout
                      </p>
                      <p className="text-xs text-emerald-700">Payout to coach</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-emerald-700">
                    {formatCurrency(payout)}
                  </span>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>Total Athletes</span>
                    </div>
                    <span className="font-semibold text-slate-800">
                      {totalAthletes}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <UserCheck2 className="h-4 w-4" />
                      <span>Attended</span>
                    </div>
                    <span className="font-semibold text-slate-800">
                      {attendedCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <UserX className="h-4 w-4" />
                      <span>Absent</span>
                    </div>
                    <span className="font-semibold text-slate-800">
                      {absentCount}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {!sessionRating && (
                <p className="text-sm text-red-600">
                  Overall session rating is required to complete the session.
                </p>
              )}
              <Button
                className="w-full rounded-full h-12 text-base"
                disabled={!sessionRating || isUpdatingSessionFeedback || sessionFeedbackCompleted}
                onClick={handleCompleteSession}
                style={{
                  backgroundColor: PRIMARY.main,
                  color: PRIMARY.foreground,
                }}
              >
                <SendHorizontal className="h-4 w-4 mr-2" />
                {isUpdatingSessionFeedback ? 'Processing...' : sessionFeedbackCompleted ? 'Session Feedback Submitted' : 'Complete session & send'}
              </Button>
            </div>
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
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Submit Feedback</DialogTitle>
            <DialogDescription>
              Share highlights and notes for the selected athletes.
            </DialogDescription>
          </DialogHeader>
          {feedbackDialogAthletes.length > 0 && (
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
              {feedbackDialogAthletes.map((athlete, index) => {
                const athleteRating = athleteRatingMap[athlete.id];
                return (
                  <div key={athlete.id} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        {athlete.avatar ? (
                          <AvatarImage
                            src={athlete.avatar}
                            alt={athlete.name}
                          />
                        ) : (
                          <AvatarFallback className="bg-blue-100 text-blue-700">
                            {getInitials(athlete.name)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {athlete.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {athlete.role} | {athlete.age}
                          {athlete.level ? ` | ${athlete.level}` : ""}
                        </p>
                      </div>
                      <Badge className="ml-auto">{index + 1} of {feedbackDialogAthletes.length}</Badge>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-800">
                          Athlete rating <span className="text-muted-foreground">(optional)</span>
                        </p>
                        <div className="flex items-center gap-3 flex-wrap">
                          <RatingStars
                            size="sm"
                            label={`Rating for ${athlete.name}`}
                            value={athleteHoverRatingMap[athlete.id] ?? athleteRating ?? 0}
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
                          <span className="text-sm font-semibold text-slate-900">
                            {(athleteHoverRatingMap[athlete.id] ?? athleteRating ?? 0).toFixed(1)}
                          </span>
                          {athleteRating && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={() =>
                                setAthleteRatingMap((prev) => ({ ...prev, [athlete.id]: undefined }))
                              }
                            >
                              Clear
                            </Button>
                          )}
                        </div>
                      </div>

                    </div>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-800">
                          Feedback to Athlete/Parent
                        </p>
                        <Textarea
                          value={athleteFeedbackMap[athlete.id] ?? ""}
                          onChange={(event) =>
                            setAthleteFeedbackMap((prev) => ({
                              ...prev,
                              [athlete.id]: event.target.value,
                            }))
                          }
                          placeholder={`E.g. ${athlete.name} commanded the box well and improved footwork...`}
                          className="min-h-[120px] resize-none focus-visible:ring-blue-300 focus-visible:ring-2 ml-1 focus-visible:ring-offset-0"
                        />
                      </div>
                      <div className="space-y-2 pb-2">
                        <p className="text-sm font-medium text-slate-800">
                          Coach-only notes <span className="text-muted-foreground">(optional)</span>
                        </p>
                        <Textarea
                          value={privateFeedbackMap[athlete.id] ?? ""}
                          onChange={(event) =>
                            setPrivateFeedbackMap((prev) => ({
                              ...prev,
                              [athlete.id]: event.target.value,
                            }))
                          }
                          placeholder="Internal notes only you can see..."
                          className="min-h-[100px] resize-none focus-visible:ring-blue-300 ml-1 mb-1 focus-visible:ring-2 focus-visible:ring-offset-0"
                        />
                      </div>
                    </div>
                    {index < feedbackDialogAthletes.length - 1 && <Separator />}
                  </div>
                );
              })}
            </div>
          )}
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-3">
            <Button variant="secondary" className="rounded-full border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100" disabled>
              <NotebookPen className="h-4 w-4 mr-2" />
              Save as Draft
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" className="rounded-full" onClick={closeDialogs}>
                Cancel
              </Button>
              <Button
                className="rounded-full"
                onClick={handleSubmitFeedback}
                disabled={
                  isSubmittingFeedback ||
                  feedbackDialogAthletes.every((athlete) => athleteFeedbackSubmitted[athlete.id])
                }
                style={{
                  backgroundColor: "hsla(210,90%,50%,0.12)",
                  color: PRIMARY.main,
                  borderColor: PRIMARY.main,
                }}
              >
                {isSubmittingFeedback
                  ? 'Submitting...'
                  : feedbackDialogAthletes.every((athlete) => athleteFeedbackSubmitted[athlete.id])
                    ? 'Feedback Submitted'
                    : 'Submit Feedback'}
              </Button>
            </div>
          </DialogFooter>
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
        <DialogContent className="sm:max-w-xl">
          {profileDialogAthlete && (
            <div className="space-y-6">
              <DialogHeader className="space-y-0 pb-4 border-b">
                <DialogTitle className="text-2xl font-normal text-slate-700">Athlete Profile</DialogTitle>
              </DialogHeader>

              <div className="flex flex-col items-start  space-y-3">
                <Avatar className="h-28 w-28">
                  {profileDialogAthlete.avatar ? (
                    <AvatarImage
                      src={profileDialogAthlete.avatar}
                      alt={profileDialogAthlete.name}
                    />
                  ) : (
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-2xl">
                      {getInitials(profileDialogAthlete.name)}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="space-y-1">
                  <p className="text-xl font-semibold text-slate-900">
                    {profileDialogAthlete.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {[profileDialogAthlete.role, profileDialogAthlete.age, profileDialogAthlete.level]
                      .filter(Boolean)
                      .join(" • ")}
                  </p>
                  {attendance[profileDialogAthlete.id] !== undefined && (
                    <p className="text-sm text-primary font-medium">
                      {attendance[profileDialogAthlete.id] ? "✓ Attended this session" : "Marked absent"}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-base font-semibold text-slate-900">Information</p>
                <div className="grid grid-cols-1 gap-4 text-sm text-slate-700">
                  {profileDialogAthlete.hometown && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">Location</p>
                        <p className="font-normal text-slate-900">{profileDialogAthlete.hometown}</p>
                      </div>
                    </div>
                  )}
                  {profileDialogAthlete.school && (
                    <div className="flex items-start gap-3">
                      <NotebookPen className="h-5 w-5 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">School</p>
                        <p className="font-normal text-slate-900">{profileDialogAthlete.school}</p>
                      </div>
                    </div>
                  )}
                  {profileDialogAthlete.goals && (
                    <div className="flex items-start gap-3">
                      <CalendarDays className="h-5 w-5 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">Joined</p>
                        <p className="font-normal text-slate-900">{profileDialogAthlete.goals}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {profileDialogAthlete.bio && (
                <div className="space-y-3">
                  <p className="text-base font-semibold text-slate-900">About</p>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {profileDialogAthlete.bio}
                  </p>
                </div>
              )}

              {profileDialogAthlete.interests && profileDialogAthlete.interests.length > 0 && (
                <div className="space-y-3">
                  <p className="text-base font-semibold text-slate-900">Key Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {profileDialogAthlete.interests.map((interest) => (
                      <span
                        key={interest}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-100 text-slate-700 px-3 py-1.5 text-sm font-normal"
                      >
                        <span className="text-blue-600">🏆</span>
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter className="pt-4">
                <Button variant="outline" className="w-full rounded-lg" onClick={closeDialogs}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* <Dialog
        open={Boolean(profileDialogAthlete)}
        onOpenChange={(open) => {
          if (!open) {
            closeDialogs();
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          {profileDialogAthlete && (
            <div className="space-y-6">
              <DialogHeader className="space-y-2">
                <DialogTitle className="text-2xl font-semibold text-slate-900">Athlete Profile</DialogTitle>
                <DialogDescription className="text-sm text-slate-500">
                  Quick view of athlete details.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    {profileDialogAthlete.avatar ? (
                      <AvatarImage
                        src={profileDialogAthlete.avatar}
                        alt={profileDialogAthlete.name}
                      />
                    ) : (
                      <AvatarFallback className="bg-blue-100 text-blue-700 text-lg">
                        {getInitials(profileDialogAthlete.name)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-slate-900">
                      {profileDialogAthlete.name}
                    </p>
                    <p className="text-sm text-slate-600">
                      {[profileDialogAthlete.role, profileDialogAthlete.age, profileDialogAthlete.level]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  </div>
                </div>
                {attendance[profileDialogAthlete.id] !== undefined && (
                  <Badge className="bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-3 py-1 text-sm font-semibold">
                    {attendance[profileDialogAthlete.id] ? "Marked Present" : "Marked Absent"}
                  </Badge>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-900">Contact Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-700">
                  {profileDialogAthlete.hometown && (
                    <div className="flex items-start gap-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <MapPin className="h-4 w-4 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-500">Location</p>
                        <p className="font-semibold text-slate-900">{profileDialogAthlete.hometown}</p>
                      </div>
                    </div>
                  )}
                  {profileDialogAthlete.school && (
                    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <NotebookPen className="h-4 w-4 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-500">School</p>
                        <p className="font-semibold text-slate-900">{profileDialogAthlete.school}</p>
                      </div>
                    </div>
                  )}
                  {profileDialogAthlete.goals && (
                    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:col-span-2">
                      <CalendarDays className="h-4 w-4 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-500">Current Goal</p>
                        <p className="font-semibold text-slate-900">{profileDialogAthlete.goals}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {profileDialogAthlete.bio && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">About</p>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {profileDialogAthlete.bio}
                  </p>
                </div>
              )}

              {profileDialogAthlete.interests && profileDialogAthlete.interests.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">Key Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {profileDialogAthlete.interests.map((interest) => (
                      <span
                        key={interest}
                        className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 text-xs font-medium"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter className="pt-2">
                <Button variant="outline" className="rounded-full" onClick={closeDialogs}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog> */}

      <Dialog open={Boolean(pendingUnselect)} onOpenChange={(open) => !open && closeAbsentDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark athlete as absent</DialogTitle>
            <DialogDescription>
              Please add a brief reason for why this athlete did not attend.
            </DialogDescription>
          </DialogHeader>
          {pendingUnselect && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {pendingUnselect.avatar ? (
                    <AvatarImage src={pendingUnselect.avatar} alt={pendingUnselect.name} />
                  ) : (
                  <AvatarFallback className="bg-blue-100 text-blue-700">
                    {getInitials(pendingUnselect.name)}
                  </AvatarFallback>
                )}
              </Avatar>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{pendingUnselect.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {pendingUnselect.role} | {pendingUnselect.age}
                    {pendingUnselect.level ? ` | ${pendingUnselect.level}` : ""}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-700">Reason</label>
                <Textarea
                  value={pendingReason}
                  onChange={(event) => {
                    setPendingReason(event.target.value);
                    if (reasonError) setReasonError(false);
                  }}
                  placeholder="e.g. Injury, illness, schedule conflict..."
                  className={cn("min-h-[120px]", reasonError ? "border-red-200 focus-visible:ring-red-200" : "")}
                />
                {reasonError && <p className="text-xs text-red-600">Reason is required</p>}
              </div>
            </div>
          )}
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" className="rounded-full" onClick={closeAbsentDialog}>
              Cancel
            </Button>
            <Button className="rounded-full" onClick={confirmAbsent}>
              Save reason
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completionDialogOpen} onOpenChange={setCompletionDialogOpen}>
        <DialogContent className="sm:max-w-xl p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-500 to-green-500 text-white px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/60">
                  ✓
                </span>
                Session Completed! 🎉
              </p>
              <p className="text-sm text-emerald-50">Your session has been successfully saved</p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="space-y-1">
              <p className="text-base font-semibold text-slate-900">{sessionInfo.title}</p>
              <p className="text-sm text-slate-700">
                {sessionInfo.date} • {sessionInfo.startTime}-{sessionInfo.endTime}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-slate-600">Athletes</p>
                <p className="text-xl font-bold text-slate-900">{attendedCount}</p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-emerald-700">Your payout</p>
                <p className="text-2xl font-bold text-emerald-700">{formatCurrency(payout)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600">Attended athletes</p>
              <div className="flex flex-wrap gap-2">
                {attendedAthletes.length ? (
                  attendedAthletes.map((athlete) => (
                    <div
                      key={athlete.id}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 border border-slate-200"
                    >
                      <Avatar className="h-7 w-7 border border-slate-200">
                        {athlete.avatar ? (
                          <AvatarImage src={athlete.avatar} alt={athlete.name} />
                        ) : (
                          <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                            {getInitials(athlete.name)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <span className="text-sm font-medium text-slate-800">{athlete.name}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No attendees recorded.</p>
                )}
              </div>
            </div>

            {/* <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 flex items-start gap-2">
              <span className="text-lg leading-none">💡</span>
            </div> */}

            <div className="flex justify-end gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => setCompletionDialogOpen(false)}>
                Close
              </Button>
              <Button className="rounded-full" onClick={() => navigate('/profile')}>
                Go to profile
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CoachSessionFeedback;
