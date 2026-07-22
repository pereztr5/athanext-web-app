import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Clock, MapPin, DollarSign, Lock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { SecurityAudit } from "@/utils/securityAudit";
import { colors, GRADIENTS } from "@/config/colors";
import { strings } from "@/config/strings";
import { BookingType } from "@/types/common";
import { CoachAvailabilitySlot } from "@/types/availability";
import { PROFILE_TYPE } from "@/utils/db";
import { buildLocalDateTime, toLocalISODate } from "@/utils/dateHelpers";
import { formatLocationDisplay } from "@/utils/sessionFormatting";

interface Coach {
  id?: string;
  name: string;
  company?: string;
  locations: string[];
  specialties?: string[];
  hourly_rate?: number;
  bio?: string;
}

interface CoachSchedulingModalProps {
  coach: Coach | null;
  isOpen: boolean;
  onClose: () => void;
  serviceType: BookingType | string;
  prefillSlot?: {
    slot: CoachAvailabilitySlot;
    date: string; // ISO date string (YYYY-MM-DD)
    availabilityId: string;
    weekStart: string;
    occurrenceId: string;
  } | null;
}

const normalizeTimeValue = (time: string) => {
  const [hours, minutes] = time.split(':');
  return `${hours?.padStart(2, '0') ?? '00'}:${minutes?.padStart(2, '0') ?? '00'}`;
};

const BASE_TIME_SLOTS = [
  "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
];

const bookingSchema = z.object({
  selectedDate: z.date({
    message: "Please select a date for your session"
  }),
  selectedTime: z.string().min(1, "Please select a time slot"),
  selectedLocation: z.string().min(1, "Please select a location"),
  duration: z.string().refine((val) => ["15", "30", "45", "60", "90", "120", "180"].includes(val), {
    message: "Please select a valid duration"
  }),
  notes: z.string().max(500, "Notes must be less than 500 characters").optional(),
});

const CoachSchedulingModal = ({ coach, isOpen, onClose, serviceType, prefillSlot }: CoachSchedulingModalProps) => {
  const isFreeConsultation = serviceType === BookingType.FreeConsultation;
  const slotPrice = prefillSlot?.slot?.price ?? undefined;
  const [platformFeePerc, setPlatformFeePerc] = useState(0);
  const [stripeFeePerc, setStripeFeePerc] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [duration, setDuration] = useState(isFreeConsultation ? "15" : "60");
  const [notes, setNotes] = useState("");
  const [isBooking, setIsBooking] = useState(false);
  const [showLimitAlert, setShowLimitAlert] = useState(false);
  const [limitAlertConfig, setLimitAlertConfig] = useState<{
    title: string;
    description: string;
    type: 'global' | 'per-coach';
  }>({ title: '', description: '', type: 'global' });
  const { toast } = useToast();
  const { user, session } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const isPrefilled = Boolean(prefillSlot);
  const toTitleCase = (text?: string | null) => {
    if (!text) return "";
    return text
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };
  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
  const safeText = (value?: string | null, fallback = "--") => {
    const trimmed = (value ?? "").trim();
    return trimmed || fallback;
  };
  const addMinutes = (time: string, minutesToAdd: number) => {
    const [hours = "0", minutes = "0"] = time.split(":");
    const base = new Date();
    base.setHours(Number(hours), Number(minutes), 0, 0);
    base.setMinutes(base.getMinutes() + minutesToAdd);
    return format(base, "h:mm aa");
  };

  useEffect(() => {
    if (prefillSlot && isOpen) {
      const parsedDate = new Date(`${prefillSlot.date}T00:00:00`);
      setSelectedDate(parsedDate);
      setSelectedTime(normalizeTimeValue(prefillSlot.slot.start_time));
      setSelectedLocation(prefillSlot.slot.location);
      setDuration(prefillSlot.slot.duration_minutes.toString());
    }

    // Load fee configuration when modal opens
    const fetchFees = async () => {
      try {
        const { data, error } = await supabase
          .from('configurations' as any)
          .select('key,value')
          .in('key', ['platform_fees', 'stripe_fees']);
        if (error) return;
        (data as any[])?.forEach((row: any) => {
          const v = Number.parseFloat(row.value);
          if (Number.isFinite(v)) {
            if (row.key === 'platform_fees') setPlatformFeePerc(v);
            if (row.key === 'stripe_fees') setStripeFeePerc(v);
          }
        });
      } catch {
        // ignore fee load errors in UI
      }
    };

    if (isOpen) {
      fetchFees();
    }
  }, [prefillSlot, isOpen]);

  const timeSlots = useMemo(() => {
    if (!prefillSlot?.slot?.start_time) return BASE_TIME_SLOTS;
    const normalized = normalizeTimeValue(prefillSlot.slot.start_time);
    return Array.from(new Set([...BASE_TIME_SLOTS, normalized]));
  }, [prefillSlot]);

  const locationOptions = useMemo(() => {
    const opts = new Map<string, string>();
    (coach?.locations || []).forEach((loc) => opts.set(loc, loc));
    if (prefillSlot) {
      const v = prefillSlot.slot.location;
      const label = v === 'online' ? 'Online' : v === 'in-person' ? 'In-Person' : v;
      opts.set(v, label);
    }
    return Array.from(opts.entries()).map(([value, label]) => ({ value, label }));
  }, [coach?.locations, prefillSlot]);

  const handleBookSession = async () => {
    // Security: Rate limiting for booking attempts
    if (!SecurityAudit.checkRateLimit('booking_attempt', 10, 300000)) { // 10 attempts per 5 minutes
      toast({
        title: strings.appointments.tooManyBookingAttempts,
        description: strings.appointments.waitBeforeTryingAgain,
        variant: "destructive",
      });
      return;
    }

    // Security: Validate inputs
    if (notes && !SecurityAudit.validateInput(notes, 'text')) {
      SecurityAudit.logSecurityEvent('BOOKING_INVALID_NOTES', { notesLength: notes.length });
      toast({
        title: "Invalid input detected",
        description: "Please check your booking notes for invalid characters.",
        variant: "destructive",
      });
      return;
    }

    const validation = bookingSchema.safeParse({
      selectedDate,
      selectedTime,
      selectedLocation,
      duration,
      notes,
    });

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      toast({
        title: "Please check your booking details",
        description: firstError.message,
        variant: "destructive",
      });
      return;
    }

    setIsBooking(true);

    try {
      const athleteProfileId =
        profile?.type === PROFILE_TYPE.athlete && profile?.data
          ? (profile.data as any).id
          : null;

      if (!athleteProfileId) {
        toast({
          title: "Profile required",
          description: "Please complete your athlete profile before booking.",
          variant: "destructive",
        });
        setIsBooking(false);
        return;
      }

      const selectedDateISO = selectedDate ? toLocalISODate(selectedDate) : prefillSlot?.date || null;
      const normalizedStartTime = selectedTime ? normalizeTimeValue(selectedTime) : null;

      if (selectedDateISO && normalizedStartTime) {
        const slotStart = buildLocalDateTime(selectedDateISO, normalizedStartTime);
        if (slotStart.getTime() <= Date.now()) {
          toast({
            title: "Slot unavailable",
            description: "This session has already started. Please choose another slot.",
            variant: "destructive",
          });
          setIsBooking(false);
          return;
        }
      }

      // Create the scheduled datetime
      const scheduledAt = new Date(selectedDate);
      const [hours, minutes] = selectedTime.split(':');
      scheduledAt.setHours(parseInt(hours), parseInt(minutes));

      // Get the coach by id (unique lookup)
      const { data: coaches, error: coachError } = await supabase
        .from('coaches')
        .select('id, hourly_rate')
        .eq('id', coach?.id)
        .single();

      if (coachError || !coaches) {
        throw new Error('Coach not found');
      }

      // Check free consultation limits
      if (isFreeConsultation) {
        // Check global limit (2 total free consultations)
        const { data: globalCount } = await supabase
          .from('free_consultation_tracking')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id)
          .in('status', ['booked', 'completed']);

        const totalUsed = globalCount?.length || 0;
        const MAX_FREE_CONSULTATIONS = 2;

        if (totalUsed >= MAX_FREE_CONSULTATIONS) {
          setLimitAlertConfig({
            title: strings.appointments.freeConsultationLimitReached,
            description: `You've used all ${MAX_FREE_CONSULTATIONS} of your free consultations across AthaLink. Ready to take the next step? Book a paid session to continue your growth journey with ${coach.name}.`,
            type: 'global'
          });
          setShowLimitAlert(true);
          setIsBooking(false);
          return;
        }

        // Check per-coach limit (1 per coach)
        const { data: perCoachConsultation } = await supabase
          .from('free_consultation_tracking')
          .select('id')
          .eq('user_id', user.id)
          .eq('coach_id', coaches.id)
          .in('status', ['booked', 'completed'])
          .maybeSingle();

        if (perCoachConsultation) {
          const remaining = MAX_FREE_CONSULTATIONS - totalUsed;
          setLimitAlertConfig({
            title: "Free Consultation Already Used With This Coach",
            description: `You've already had a free consultation with ${coach.name}. You have ${remaining} free consultation${remaining !== 1 ? 's' : ''} remaining with other coaches, or you can book a paid session to continue working with ${coach.name}.`,
            type: 'per-coach'
          });
          setShowLimitAlert(true);
          setIsBooking(false);
          return;
        }
      }

      const totalAmount = isFreeConsultation ? 0 : sessionCost;

      // Create payment session with appointment details
      const occurrenceDate =
        selectedDate
          ? toLocalISODate(selectedDate)
          : prefillSlot?.date;

      const { data: paymentData, error: paymentError } = await supabase.functions.invoke('create-booking-payment-v0', {
        body: {
          coach_id: coaches.id,
          athlete_id: athleteProfileId,
          occurrence_id: prefillSlot?.occurrenceId,
          occurrence_ids: prefillSlot?.occurrenceId ? [prefillSlot.occurrenceId] : undefined,
          session_type: prefillSlot?.slot?.session_type,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: parseInt(duration),
          service_type: serviceType,
          location: selectedLocation,
          total_amount: totalAmount,
          notes: notes,
        }
      });

      if (paymentError) throw paymentError;

      // Track free consultation if successful
      if (isFreeConsultation && paymentData.appointmentId) {
        await supabase
          .from('free_consultation_tracking')
          .insert({
            user_id: user.id,
            coach_id: coaches.id,
            appointment_id: paymentData.appointmentId,
            status: 'booked'
          });
      }

      // Redirect to Stripe Checkout
      if (paymentData.url) {
        window.location.href = paymentData.url;
        onClose();
      }
    } catch (error) {
      console.error('Booking error:', error);
      toast({
        title: strings.appointments.bookingFailed,
        description: strings.appointments.errorCreatingBooking,
        variant: "destructive",
      });
    } finally {
      setIsBooking(false);
    }
  };

  if (!coach) return null;

  const hourlyRate = coach.hourly_rate ? coach.hourly_rate : 0;
  const sessionCost = isFreeConsultation
    ? 0
    : typeof slotPrice === 'number'
      ? slotPrice
      : Math.round((hourlyRate / 60) * parseInt(duration));
  const totalWithFees = isFreeConsultation
    ? 0
    : Number((sessionCost * (1 + platformFeePerc / 100 + stripeFeePerc / 100)).toFixed(2));
  const platformFeeAmount = isFreeConsultation
    ? 0
    : Number((sessionCost * (platformFeePerc / 100)).toFixed(2));
  const stripeFeeAmount = isFreeConsultation
    ? 0
    : Number((sessionCost * (stripeFeePerc / 100)).toFixed(2));

  const displayDate = selectedDate
    ? format(selectedDate, "PPP")
    : prefillSlot?.date
    ? format(new Date(`${prefillSlot.date}T00:00:00`), "PPP")
    : "--";
  const displayStart = selectedTime
    ? format(new Date(`1970-01-01T${normalizeTimeValue(selectedTime)}:00`), "h:mm aa")
    : prefillSlot?.slot?.start_time
    ? format(new Date(`1970-01-01T${normalizeTimeValue(prefillSlot.slot.start_time)}:00`), "h:mm aa")
    : "--";
  const displayEnd = selectedTime
    ? addMinutes(normalizeTimeValue(selectedTime), parseInt(duration))
    : prefillSlot?.slot?.end_time
    ? format(new Date(`1970-01-01T${normalizeTimeValue(prefillSlot.slot.end_time)}:00`), "h:mm aa")
    : "--";
  const durationLabel = `${duration} minutes`;
  const locationLabel = safeText(
    formatLocationDisplay(selectedLocation || prefillSlot?.slot?.location),
    strings.appointments.chooseLocation
  );
  const sessionTitle = safeText(
    prefillSlot?.slot?.session_name ||
      (prefillSlot?.slot as any)?.session_title ||
      (prefillSlot?.slot as any)?.title ||
      (prefillSlot?.slot as any)?.name ||
      (typeof serviceType === "string" ? serviceType : strings.appointments.bookSession),
    "Session"
  );
  const typeLabel =
    prefillSlot?.slot?.session_type === "group"
      ? "Group Session"
      : prefillSlot?.slot?.session_type === "individual"
      ? "Individual"
      : toTitleCase(serviceType?.toString()) || "Session";
  const priceBadgeLabel =
    isFreeConsultation
      ? undefined
      : hourlyRate
      ? `$${hourlyRate}/hr`
      : sessionCost > 0
      ? `${formatCurrency(sessionCost)} session`
      : undefined;
  const hideSelectionFields = Boolean(prefillSlot);

  return (
    <>
      <AlertDialog open={showLimitAlert} onOpenChange={setShowLimitAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <AlertCircle style={{ color: colors.status.error }} className="h-5 w-5" />
              <AlertDialogTitle>{limitAlertConfig.title}</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base pt-2">
              {limitAlertConfig.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowLimitAlert(false);
              onClose();
            }}>
              Close
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowLimitAlert(false);
              // Optionally stay in modal to book paid session
            }}>
              View Paid Options
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-50">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-2xl font-bold text-slate-900">Confirm Your Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Session Summary */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-slate-900">{sessionTitle}</p>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-orange-600 border border-orange-100">
                      {typeLabel}
                    </span>
                  </div>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p className="font-semibold" style={{ color: colors.primary.main }}>{isFreeConsultation ? "Free" : formatCurrency(totalWithFees)}</p>
                  <p className="text-xs">Total</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm text-slate-800">
                <div className="flex items-start gap-2">
                  <CalendarIcon className="h-4 w-4 mt-0.5" style={{ color: colors.primary.main }} />
                  <div>
                    <p className="text-xs text-muted-foreground">Date &amp; Time</p>
                    <p className="font-semibold">{displayDate}</p>
                    <p className="text-xs text-muted-foreground">{displayStart !== "--" && displayEnd !== "--" ? `${displayStart} - ${displayEnd}` : "--"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5" style={{ color: colors.primary.main }} />
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="font-semibold">{locationLabel}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 mt-0.5" style={{ color: colors.primary.main }} />
                  <div>
                    <p className="text-xs text-muted-foreground">Start Time</p>
                    <p className="font-semibold">{displayStart}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 mt-0.5" style={{ color: colors.primary.main }} />
                  <div>
                    <p className="text-xs text-muted-foreground">End Time</p>
                    <p className="font-semibold">{displayEnd}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 mt-0.5" style={{ color: colors.primary.main }} />
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="font-semibold">{durationLabel}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Editable selections (hidden when prefilled) */}
            {!hideSelectionFields && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-sm font-medium text-slate-800">
                    {strings.appointments.selectDate} *
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal rounded-xl"
                        disabled={isPrefilled}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={(date) => toLocalISODate(date) < toLocalISODate(new Date()) || date < new Date("1900-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time" className="text-sm font-medium text-slate-800">
                    {strings.appointments.selectTime} *
                  </Label>
                  <Select value={selectedTime} onValueChange={setSelectedTime} disabled={isPrefilled}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder={strings.appointments.chooseTimeSlot} />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>
                          <div className="flex items-center">
                            <Clock className="mr-2 h-4 w-4" />
                            {time}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration" className="text-sm font-medium text-slate-800">
                    {strings.appointments.sessionDuration}
                  </Label>
                  <Select value={duration} onValueChange={setDuration} disabled={isFreeConsultation || isPrefilled}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder={strings.appointments.sessionDuration} />
                    </SelectTrigger>
                    <SelectContent>
                      {isFreeConsultation ? (
                        <SelectItem value="15">15 minutes - FREE</SelectItem>
                      ) : (
                        <>
                          <SelectItem value="30">30 minutes - ${Math.round((hourlyRate / 60) * 30)}</SelectItem>
                          <SelectItem value="45">45 minutes - ${Math.round((hourlyRate / 60) * 45)}</SelectItem>
                          <SelectItem value="60">60 minutes - ${Math.round((hourlyRate / 60) * 60)}</SelectItem>
                          <SelectItem value="90">90 minutes - ${Math.round((hourlyRate / 60) * 90)}</SelectItem>
                          <SelectItem value="120">120 minutes - ${Math.round((hourlyRate / 60) * 120)}</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location" className="text-sm font-medium text-slate-800">
                    Location *
                  </Label>
                  <Select value={selectedLocation} onValueChange={setSelectedLocation} disabled={isPrefilled}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder={strings.appointments.chooseLocation} />
                    </SelectTrigger>
                    <SelectContent>
                      {locationOptions.map((location) => (
                        <SelectItem key={location.value} value={location.value}>
                          <div className="flex items-center">
                            <MapPin className="mr-2 h-4 w-4" />
                            {location.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Notes */}
            {/* <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-semibold text-slate-800">
                Additional Notes (Optional)
              </Label>
              <Textarea
                id="notes"
                placeholder={strings.appointments.anySpecificGoals}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[90px] rounded-2xl border-slate-200 bg-white"
              />
            </div> */}

            {/* Cost Summary */}
            {/* Cost Summary hidden per request */}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 rounded-full bg-white"
                disabled={isBooking}
              >
                {strings.buttons.cancel}
              </Button>
              {!user ? (
                <Button
                  onClick={() => {
                    toast({
                      title: strings.appointments.authenticationRequired,
                      description: strings.appointments.pleaseSignInToBook,
                    });
                    navigate("/auth");
                  }}
                  className="flex-1 rounded-full text-white"
                  style={{ backgroundImage: GRADIENTS.primaryGradient }}
                >
                  <Lock className="mr-2 h-4 w-4" />
                  {strings.appointments.signInToBook}
                </Button>
              ) : (
                <Button
                  onClick={handleBookSession}
                  className="flex-1 rounded-full text-white hover:opacity-90"
                  style={{ backgroundColor: colors.primary.main }}
                  disabled={isBooking}
                >
                  {isBooking
                    ? strings.appointments.processing
                    : isFreeConsultation
                    ? strings.appointments.bookFreeConsultationButton
                    : `Book & Pay Now - ${formatCurrency(totalWithFees)}`}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CoachSchedulingModal;
