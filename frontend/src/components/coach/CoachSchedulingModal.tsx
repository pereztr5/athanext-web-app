import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Clock, MapPin, Lock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { SecurityAudit } from "@/utils/securityAudit";
import { strings } from "@/config/strings";
import { BookingType } from "@/types/common";
import { CoachAvailabilitySlot } from "@/types/availability";
import { PROFILE_TYPE } from "@/utils/db";
import { getZonedISODate, isBookingWindowClosed, toLocalISODate } from "@/utils/dateHelpers";
import { formatLocationSentence, formatTimeSpan } from "@/utils/sessionFormatting";
import { BrandPill } from "@/components/brand";
import { cn } from "@/lib/utils";

interface Coach {
  id?: string;
  name: string;
  company?: string;
  locations: string[];
  specialties?: string[];
  hourly_rate?: number;
  bio?: string;
  /** Optional sport name; renders a teal pill in the summary when provided. */
  sport?: string;
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
    return format(base, "HH:mm");
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
      const label = v === 'online' ? 'Online' : v === 'in-person' ? 'In person' : v;
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
      const occurrenceDate = prefillSlot?.date || selectedDateISO;
      const occurrenceStart = prefillSlot?.slot?.start_time || normalizedStartTime;

      if (occurrenceDate && occurrenceStart && isBookingWindowClosed(occurrenceDate, occurrenceStart)) {
        const { data: pendingBooking } = await supabase
          .from("coach_slot_bookings" as any)
          .select("id")
          .eq("occurrence_id", prefillSlot?.occurrenceId || "")
          .eq("athlete_id", athleteProfileId)
          .eq("status", "pending_payment")
          .maybeSingle();

        if (!pendingBooking) {
          toast({
            title: "Slot unavailable",
            description: "Booking stays open until 10 minutes after the start time (Eastern).",
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
            title: "Free consultation limit reached",
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
            title: "Free consultation already used with this coach",
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

  const displayDateValue = selectedDate
    ? selectedDate
    : prefillSlot?.date
    ? new Date(`${prefillSlot.date}T00:00:00`)
    : null;
  const displayDate = displayDateValue ? format(displayDateValue, "EEEE, MMM d") : "--";
  const startTimeValue = selectedTime
    ? normalizeTimeValue(selectedTime)
    : prefillSlot?.slot?.start_time
    ? normalizeTimeValue(prefillSlot.slot.start_time)
    : "";
  const endTimeValue = selectedTime
    ? addMinutes(normalizeTimeValue(selectedTime), parseInt(duration))
    : prefillSlot?.slot?.end_time
    ? normalizeTimeValue(prefillSlot.slot.end_time)
    : "";
  const timeSpan = startTimeValue && endTimeValue ? formatTimeSpan(startTimeValue, endTimeValue) : "";
  const displayTime = timeSpan ? `${timeSpan}, ${duration} min` : "--";
  const rawLocation = selectedLocation || prefillSlot?.slot?.location || "";
  const locationLabel = safeText(
    rawLocation === "online" || rawLocation === "in-person" ? formatLocationSentence(rawLocation) : rawLocation,
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
  const isGroupSession = prefillSlot?.slot?.session_type === "group";
  const typeLabel =
    isGroupSession
      ? "Group"
      : prefillSlot?.slot?.session_type === "individual"
      ? "Individual"
      : toTitleCase(serviceType?.toString()) || "Session";
  const sportLabel = coach.sport?.trim();
  // Break the total down so the parts always add up to the charged total:
  // the last fee shown absorbs any rounding cent.
  const roundCents = (value: number) => Math.round(value * 100) / 100;
  const hasProcessingFee = stripeFeePerc > 0;
  const platformFeeDisplay = hasProcessingFee ? platformFeeAmount : roundCents(totalWithFees - sessionCost);
  const processingFeeDisplay = roundCents(totalWithFees - sessionCost - platformFeeAmount);
  const priceBreakdown = isFreeConsultation
    ? "Free"
    : `${formatCurrency(sessionCost)} session + ${formatCurrency(platformFeeDisplay)} platform fee${
        hasProcessingFee ? ` + ${formatCurrency(processingFeeDisplay)} processing fee` : ""
      }`;
  const hideSelectionFields = Boolean(prefillSlot);

  const modalSurface =
    "bg-[#F7F7F0] border border-[#EAEADF] rounded-[10px] sm:rounded-[10px] shadow-[0_0_15px_rgba(0,0,0,0.05)] font-sans text-[#1A202C] tracking-[-0.03em]";
  const closeButtonOverride =
    "[&>button]:text-[#767980] [&>button]:opacity-100 [&>button:hover]:text-[#1A202C] [&>button]:right-[13px] [&>button]:top-[11px] sm:[&>button]:right-[17px] sm:[&>button]:top-[19px] [&>button_svg]:stroke-[1.5]";
  const primaryButton =
    "h-[34px] px-4 rounded-[8px] border border-[#6698D2] bg-[#0054B4] text-[#F1F1E6] text-[16px] font-medium tracking-[-0.03em] hover:bg-[#004390]";
  const secondaryButton =
    "h-[34px] px-4 rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] text-[#1A202C] text-[16px] font-medium tracking-[-0.03em] hover:bg-[#EAEADF] hover:text-[#1A202C]";
  const fieldLabel = "text-[12px] font-medium leading-[13px] tracking-[-0.03em] text-[#767980]";
  const fieldInput =
    "h-[34px] w-full rounded-[8px] border border-[#EAEADF] bg-[#F1F1E6] px-3 text-[14px] font-normal tracking-[-0.03em] text-[#1A202C] hover:bg-[#F1F1E6] hover:text-[#1A202C]";
  const menuSurface = "rounded-[8px] border-[#EAEADF] bg-[#F7F7F0] text-[#1A202C]";
  const menuIcon = "mr-2 h-4 w-4 text-[#767980]";

  return (
    <>
      <AlertDialog open={showLimitAlert} onOpenChange={setShowLimitAlert}>
        <AlertDialogContent className={cn(modalSurface, "gap-0 p-0")}>
          <AlertDialogHeader className="space-y-2.5 px-[25px] pb-5 pt-[30px] text-left">
            <div className="flex items-center gap-2">
              <AlertCircle strokeWidth={1.5} className="h-5 w-5 flex-none text-[#906A29]" />
              <AlertDialogTitle className="text-[20px] font-medium leading-[24px] tracking-[-0.05em] text-[#1A202C]">
                {limitAlertConfig.title}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#484D56]">
              {limitAlertConfig.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="h-px bg-[#EAEADF]" />
          <AlertDialogFooter className="gap-[10px] px-[25px] py-5 sm:space-x-0">
            <AlertDialogCancel
              className={cn(secondaryButton, "mt-0")}
              onClick={() => {
                setShowLimitAlert(false);
                onClose();
              }}
            >
              Close
            </AlertDialogCancel>
            <AlertDialogAction
              className={primaryButton}
              onClick={() => {
                setShowLimitAlert(false);
                // Optionally stay in modal to book paid session
              }}
            >
              View paid options
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className={cn("max-w-2xl max-h-[90vh] overflow-y-auto gap-0 p-0", modalSurface, closeButtonOverride)}>
          <DialogHeader className="px-[25px] py-5 pr-14 text-left">
            <DialogTitle className="text-[24px] font-semibold leading-[30px] tracking-[-0.05em] text-[#1A202C]">
              Confirm your booking
            </DialogTitle>
          </DialogHeader>
          <div className="h-px bg-[#EAEADF]" />

          <div className="flex flex-col gap-5 px-[25px] py-5">
            {/* Session summary */}
            <div className="flex items-start justify-between gap-5">
              <div className="flex min-w-0 flex-col gap-2.5">
                <p className="text-[20px] font-medium leading-[24px] tracking-[-0.05em] text-[#1A202C]">
                  {sessionTitle} with {coach.name}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <BrandPill tone={isGroupSession ? "teal" : "blue"}>{typeLabel}</BrandPill>
                  {sportLabel && <BrandPill tone="teal">{sportLabel}</BrandPill>}
                </div>
              </div>
              <div className="flex flex-none flex-col items-end gap-1.5 text-right">
                <p className="text-[32px] font-bold leading-[30px] tracking-[-0.03em] text-[#1A202C]">
                  {isFreeConsultation ? "Free" : formatCurrency(totalWithFees)}
                </p>
                <p className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
                  {isFreeConsultation ? "Total" : "Total, fees included"}
                </p>
              </div>
            </div>

            {/* Details */}
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-[8px] bg-[#F4F4EB] px-5 py-4 sm:grid-cols-2">
              {[
                { label: "Date", value: displayDate },
                { label: "Time", value: displayTime },
                { label: "Location", value: locationLabel },
                { label: "Price", value: priceBreakdown },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-1.5">
                  <dt className={fieldLabel}>{item.label}</dt>
                  <dd className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#1A202C]">{item.value}</dd>
                </div>
              ))}
            </dl>

            {/* Editable selections (hidden when prefilled) */}
            {!hideSelectionFields && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="date" className={fieldLabel}>
                    Date *
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="date"
                        variant="outline"
                        className={cn(fieldInput, "justify-start text-left")}
                        disabled={isPrefilled}
                      >
                        <CalendarIcon strokeWidth={1.5} className="mr-2 h-4 w-4 text-[#767980]" />
                        {selectedDate ? (
                          format(selectedDate, "EEEE, MMM d")
                        ) : (
                          <span className="text-[#A3A6AB]">Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className={cn(menuSurface, "w-auto p-0")} align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={(date) => toLocalISODate(date) < getZonedISODate(new Date()) || date < new Date("1900-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="time" className={fieldLabel}>
                    Time *
                  </Label>
                  <Select value={selectedTime} onValueChange={setSelectedTime} disabled={isPrefilled}>
                    <SelectTrigger id="time" className={fieldInput}>
                      <SelectValue placeholder={strings.appointments.chooseTimeSlot} />
                    </SelectTrigger>
                    <SelectContent className={menuSurface}>
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>
                          <div className="flex items-center">
                            <Clock strokeWidth={1.5} className={menuIcon} />
                            {time}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="duration" className={fieldLabel}>
                    Duration
                  </Label>
                  <Select value={duration} onValueChange={setDuration} disabled={isFreeConsultation || isPrefilled}>
                    <SelectTrigger id="duration" className={fieldInput}>
                      <SelectValue placeholder="Duration" />
                    </SelectTrigger>
                    <SelectContent className={menuSurface}>
                      {isFreeConsultation ? (
                        <SelectItem value="15">15 min, free</SelectItem>
                      ) : (
                        <>
                          <SelectItem value="30">30 min, ${Math.round((hourlyRate / 60) * 30)}</SelectItem>
                          <SelectItem value="45">45 min, ${Math.round((hourlyRate / 60) * 45)}</SelectItem>
                          <SelectItem value="60">60 min, ${Math.round((hourlyRate / 60) * 60)}</SelectItem>
                          <SelectItem value="90">90 min, ${Math.round((hourlyRate / 60) * 90)}</SelectItem>
                          <SelectItem value="120">120 min, ${Math.round((hourlyRate / 60) * 120)}</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="location" className={fieldLabel}>
                    Location *
                  </Label>
                  <Select value={selectedLocation} onValueChange={setSelectedLocation} disabled={isPrefilled}>
                    <SelectTrigger id="location" className={fieldInput}>
                      <SelectValue placeholder={strings.appointments.chooseLocation} />
                    </SelectTrigger>
                    <SelectContent className={menuSurface}>
                      {locationOptions.map((location) => (
                        <SelectItem key={location.value} value={location.value}>
                          <div className="flex items-center">
                            <MapPin strokeWidth={1.5} className={menuIcon} />
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
                className="min-h-[90px] rounded-[8px] border-0 bg-[#F1F1E6] p-3 text-[14px] leading-[18px] tracking-[-0.03em] text-[#1A202C] placeholder:text-[#A3A6AB] focus-visible:ring-[#6698D2]"
              />
            </div> */}
          </div>

          {/* Action buttons */}
          <div className="h-px bg-[#EAEADF]" />
          <div className="flex flex-col-reverse gap-[10px] px-[25px] py-5 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose} className={secondaryButton} disabled={isBooking}>
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
                className={primaryButton}
              >
                <Lock strokeWidth={1.5} className="h-4 w-4" />
                Sign in to book
              </Button>
            ) : (
              <Button onClick={handleBookSession} className={primaryButton} disabled={isBooking}>
                {isBooking
                  ? strings.appointments.processing
                  : isFreeConsultation
                  ? "Book free consultation"
                  : `Book and pay ${formatCurrency(totalWithFees)}`}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CoachSchedulingModal;
