import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/routes";
import { supabase } from "@/integrations/supabase/client";
import { bookingsAPI, type BookingConfirmationData } from "@/api/bookings";
import { formatLocationSentence, formatTimeSpan } from "@/utils/sessionFormatting";
import { parseISODateLocal, zonedWallTimeToUtc } from "@/utils/dateHelpers";
import { formatDateInZone, formatSlotForViewer } from "@/utils/viewerTime";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { formatDateToUSA } from "@/utils/helperFunctions";
import BookingReceipt from "@/components/receipts/BookingReceipt";
import { BrandPill } from "@/components/brand";
import { useFeeConfig } from "@/hooks/useFeeConfig";
import { useReferralWaiver } from "@/hooks/useReferrals";
import { computeSessionPrice } from "@/utils/referralHelpers";
import { useProfile } from "@/contexts/ProfileContext";
import { FALLBACK_CONTACT_METHODS, PROFILE_TYPE } from "@/utils/db";

// Support address shown in the receipt footer (same source the Contact page falls back to).
const RECEIPT_SUPPORT_EMAIL = FALLBACK_CONTACT_METHODS.find((method) => method.icon === "email")?.value;

interface CoachInfo {
  name?: string | null;
  title?: string | null;
}

const BookingConfirmation = () => {
  const viewerTimeZone = useViewerTimeZone();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  
  const [bookingDetails, setBookingDetails] = useState<BookingConfirmationData | null>(null);
  const [coachInfo, setCoachInfo] = useState<CoachInfo>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const { platformFeePerc, stripeFeePerc } = useFeeConfig();
  const { profile } = useProfile();
  const athleteProfileId =
    profile?.type === PROFILE_TYPE.athlete && profile?.data ? (profile.data as any).id : undefined;
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
    []
  );

  const formatCurrency = useCallback(
    (value: number | null | undefined) => currencyFormatter.format(Number.isFinite(value || 0) ? Number(value) : 0),
    [currencyFormatter]
  );

  const handleDownloadReceipt = async () => {
    if (!receiptRef.current || !receiptData) return;

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const element = receiptRef.current;
      // Make sure DM Sans is loaded so the capture doesn't fall back to a system font.
      await document.fonts?.ready;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, "PNG", margin, position, contentWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        pdf.addPage();
        position = heightLeft - imgHeight + margin;
        pdf.addImage(imgData, "PNG", margin, position, contentWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`booking-confirmation-${bookingDetails?.bookingId || sessionId}.pdf`);
    } catch (err) {
      console.error("Failed to download receipt:", err);
    }
  };

  const handleNavigateToProfile = () => {
    navigate(ROUTES.PROFILE);
  };

  const handleNavigateToContact = () => {
    navigate(ROUTES.CONTACT_US);
  };

  useEffect(() => {
    const loadBookingConfirmation = async () => {
      if (!sessionId) {
        setLoadError("No booking session found");
        return;
      }

      setLoadError(null);
      setLoading(true);

      try {
        const result = await bookingsAPI.fetchCompleteBookingConfirmation(sessionId);

        if (result.error) {
          setLoadError(result.error.message);
          return;
        }

        if (result.data) {
          setBookingDetails(result.data.booking);
          setCoachInfo(result.data.coach);
        }
      } catch (err: any) {
        console.error("Failed to load booking confirmation:", err);
        setLoadError("An unexpected error occurred. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadBookingConfirmation();
  }, [sessionId]);

  const slot = bookingDetails?.slot;
  const sessionName = slot?.session_name || "Coaching session";
  const sessionType = slot?.session_type === "group" ? "Group" : "Individual";
  // Existing client of this coach: create-booking-payment charged no platform fee.
  const { waived: platformFeeWaived } = useReferralWaiver(athleteProfileId, bookingDetails?.coachId);
  const feeAdjustedPriceValue =
    typeof slot?.price === "number"
      ? computeSessionPrice(slot.price, platformFeePerc || 0, stripeFeePerc || 0, platformFeeWaived).total
      : 0;
  const price = feeAdjustedPriceValue ? formatCurrency(feeAdjustedPriceValue) : "-";
  const occurrenceDate = slot?.occurrence_date || null;
  // Receipt breakdown: slot base price + everything added on top (platform + processing fees) = fee-inclusive total.
  const receiptSessionPriceValue = typeof slot?.price === "number" ? slot.price : null;
  const receiptTotalPaidValue = receiptSessionPriceValue != null ? feeAdjustedPriceValue : null;
  const receiptFeeValue =
    receiptSessionPriceValue != null && receiptTotalPaidValue != null
      ? Number((receiptTotalPaidValue - receiptSessionPriceValue).toFixed(2))
      : null;

  const { formattedDate, dayOfWeek } = useMemo(() => {
    if (!occurrenceDate) {
      return { formattedDate: "-", dayOfWeek: "-" };
    }

    const parsedDate = parseISODateLocal(occurrenceDate);
    if (isNaN(parsedDate.getTime())) {
      return { formattedDate: "-", dayOfWeek: "-" };
    }

    // Show the viewer's calendar day for the Eastern start time (ATH-22).
    const viewerStart = slot?.start_time ? zonedWallTimeToUtc(occurrenceDate, slot.start_time) : null;
    if (viewerStart) {
      return {
        formattedDate: formatDateInZone(viewerStart, viewerTimeZone, { month: "short", day: "numeric", year: "numeric" }),
        dayOfWeek: formatDateInZone(viewerStart, viewerTimeZone, { weekday: "long" }),
      };
    }

    return {
      formattedDate: parsedDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      dayOfWeek: parsedDate.toLocaleDateString("en-US", { weekday: "long" }),
    };
  }, [occurrenceDate, slot?.start_time, viewerTimeZone]);

  const coachName = coachInfo.name?.trim() || "";
  const coachTitle = coachInfo.title?.trim() || "";
  const coachInitials = useMemo(() => {
    if (!coachName) return "C";
    const parts = coachName.split(" ").filter(Boolean);
    if (!parts.length) return "C";
    return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "C";
  }, [coachName]);

  const receiptTimeLabel = useMemo(() => {
    const viewerSpan = formatSlotForViewer(occurrenceDate, slot?.start_time, slot?.end_time, viewerTimeZone).span;
    const span = viewerSpan || (slot?.start_time && slot?.end_time ? formatTimeSpan(slot.start_time, slot.end_time) : "");
    const minutes = slot?.duration_minutes != null ? `${slot.duration_minutes} min` : "";
    return [span, minutes].filter(Boolean).join(", ") || "—";
  }, [occurrenceDate, slot?.start_time, slot?.end_time, slot?.duration_minutes, viewerTimeZone]);

  const receiptIssuedLabel = useMemo(() => {
    if (!bookingDetails?.createdAt) return "—";
    const created = new Date(bookingDetails.createdAt);
    if (isNaN(created.getTime())) return formatDateToUSA(bookingDetails.createdAt) || "—";
    return created.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }, [bookingDetails?.createdAt]);

  const receiptData = useMemo(() => {
    if (!bookingDetails) return null;

    const hasDate = formattedDate !== "-" && dayOfWeek !== "-";
    const formatReceiptAmount = (value: number | null) => (value != null ? formatCurrency(value) : "—");

    return {
      bookingRef: bookingDetails.bookingId ? `#${bookingDetails.bookingId.slice(0, 8).toUpperCase()}` : "",
      issueDateLabel: receiptIssuedLabel,
      sessionName,
      coachName,
      type: sessionType,
      dateLabel: hasDate ? `${dayOfWeek}, ${formattedDate}` : "—",
      timeLabel: receiptTimeLabel,
      locationLabel: formatLocationSentence(slot?.location) || "—",
      sessionPriceLabel: formatReceiptAmount(receiptSessionPriceValue),
      feeLabel: formatReceiptAmount(receiptFeeValue),
      totalPaidLabel: formatReceiptAmount(receiptTotalPaidValue),
      isPaid: bookingDetails.paymentStatus === "paid",
      supportEmail: RECEIPT_SUPPORT_EMAIL,
    };
  }, [
    bookingDetails,
    coachName,
    dayOfWeek,
    formatCurrency,
    formattedDate,
    receiptFeeValue,
    receiptIssuedLabel,
    receiptSessionPriceValue,
    receiptTimeLabel,
    receiptTotalPaidValue,
    sessionName,
    sessionType,
    slot?.location,
  ]);

  const isPaid = bookingDetails?.paymentStatus === "paid";
  const detailItems = [
    { label: "Date", value: formattedDate !== "-" && dayOfWeek !== "-" ? `${dayOfWeek}, ${formattedDate}` : "-", skeleton: "w-36" },
    { label: "Time", value: receiptTimeLabel, skeleton: "w-40" },
    { label: "Location", value: formatLocationSentence(slot?.location) || "-", skeleton: "w-24" },
    { label: "Type", value: sessionType, skeleton: "w-20" },
  ];

  return (
    <div className="flex items-start justify-center px-4 py-8 font-sans tracking-[-0.03em] text-[#1A202C] sm:py-12 lg:py-16">
      <div className="w-full max-w-2xl overflow-hidden rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0]">
        {/* Success header */}
        <div className="flex flex-col items-start gap-4 px-[25px] pb-5 pt-[30px]">
          <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#CBE7D1]">
            <CheckCircle className="h-5 w-5 text-[#1E7431]" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[24px] font-semibold leading-[30px] tracking-[-0.05em]">
                {isPaid ? "Booking confirmed" : "Booking created"}
              </h1>
              {bookingDetails && (
                <BrandPill tone={isPaid ? "green" : "amber"}>{isPaid ? "Paid" : "Payment pending"}</BrandPill>
              )}
            </div>
            <p className="text-[14px] leading-[18px] text-[#484D56]">
              Your session{coachName ? ` with ${coachName}` : ""} is booked. We’ll email you the details.
            </p>
          </div>
          {loadError && (
            <p className="flex items-center gap-2 text-[14px] leading-[18px] text-destructive">
              <AlertCircle strokeWidth={1.5} className="h-4 w-4 flex-none" /> {loadError}
            </p>
          )}
        </div>
        <div className="h-px bg-[#EAEADF]" />

        {/* Booking details */}
        <div className="flex flex-col gap-5 px-[25px] py-5">
          <div className="flex items-start justify-between gap-5">
            <div className="flex min-w-0 flex-col gap-2.5">
              {loading ? (
                <Skeleton className="h-6 w-48" />
              ) : (
                <p className="text-[20px] font-medium leading-[24px] tracking-[-0.05em]">{sessionName}</p>
              )}
              {!loading && slot && (
                <div className="flex flex-wrap gap-1.5">
                  <BrandPill tone={slot.session_type === "group" ? "teal" : "blue"}>{sessionType}</BrandPill>
                </div>
              )}
            </div>
            <div className="flex flex-none flex-col items-end gap-1.5 text-right">
              {loading ? (
                <Skeleton className="h-[30px] w-20" />
              ) : (
                <p className="text-[32px] font-bold leading-[30px]">{price}</p>
              )}
              <p className="text-[12px] leading-[14px] text-[#767980]">Total, fees included</p>
              {!loading && platformFeeWaived ? <BrandPill tone="green">No service fee</BrandPill> : null}
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-[8px] bg-[#F4F4EB] px-5 py-4 sm:grid-cols-2">
            {detailItems.map((item) => (
              <div key={item.label} className="flex flex-col gap-1.5">
                <dt className="text-[12px] font-medium leading-[13px] text-[#767980]">{item.label}</dt>
                <dd className="text-[14px] leading-[18px]">
                  {loading ? <Skeleton className={`h-[18px] ${item.skeleton}`} /> : item.value}
                </dd>
              </div>
            ))}
          </dl>

          {loading ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ) : (
            coachName && (
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-[#E5EDF7] text-[14px] font-medium text-[#0054B4]">
                    {coachInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-[16px] font-medium leading-[18px]">{coachName}</p>
                  <p className="text-[12px] leading-[14px] text-[#767980]">{coachTitle || "Coach"}</p>
                </div>
              </div>
            )
          )}

          <div className="flex flex-col gap-2.5">
            <p className="text-[16px] font-medium leading-[18px] tracking-[-0.05em]">What happens next</p>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[14px] leading-[18px] text-[#484D56] marker:text-[#A3A6AB]">
              <li>Your coach will reach out with any prep details.</li>
              <li>You’ll get a confirmation email with your booking.</li>
              <li>Add the session to your calendar and note your goals.</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="h-px bg-[#EAEADF]" />
        <div className="flex flex-col-reverse gap-4 px-[25px] py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14px] leading-[18px] text-[#767980]">
            Need help?{" "}
            <button
              type="button"
              onClick={handleNavigateToContact}
              className="font-medium text-[#0054B4] underline-offset-2 hover:underline"
            >
              Contact support
            </button>
          </p>
          <div className="flex flex-col-reverse gap-[10px] sm:flex-row">
            <Button onClick={handleNavigateToProfile} disabled={loading} variant="outline">
              Back to profile
            </Button>
            <Button onClick={handleDownloadReceipt} disabled={loading}>
              Download receipt
            </Button>
          </div>
        </div>
      </div>
      {/* Hidden receipt container used only for PDF generation */}
      {receiptData && (
        <div className="fixed -left-[10000px] top-0 w-[900px]">
          <div ref={receiptRef}>
            <BookingReceipt data={receiptData} />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Back from Stripe after a request (ATH-85): the card is held, nothing is charged until the
 * coach accepts.
 */
const RequestSent = ({ sessionId }: { sessionId: string }) => {
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "held" | "full" | "error">("checking");
  useEffect(() => {
    supabase.functions
      .invoke("create-booking-payment-v0", { body: { session_id: sessionId } })
      .then(({ data, error }) => setState(error ? "error" : data?.full ? "full" : data?.held ? "held" : "error"))
      .catch(() => setState("error"));
  }, [sessionId]);
  const copy = {
    checking: ["Sending your request…", "One moment while we confirm your card."],
    held: ["Request sent", "Your card is held and charged only if the coach accepts. They usually reply within a day; if they don't accept, the hold is released."],
    full: ["That time just filled up", "Your card was not charged and the hold is released. Pick another time."],
    error: ["We couldn't confirm your request", "Your card was not charged. Check My Sessions, or try again."],
  }[state];
  return (
    <div className="overflow-x-hidden px-4 pb-16 md:px-10">
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] p-6 text-center">
        <h1 className="text-[22px] font-semibold leading-[28px] tracking-[-0.05em] text-[#1A202C]">{copy[0]}</h1>
        <p className="text-[14px] leading-[20px] text-[#484D56]">{copy[1]}</p>
        {state !== "checking" ? (
          <button
            type="button"
            className="mx-auto inline-flex h-[34px] items-center rounded-[8px] border border-[#6698D2] bg-[#0054B4] px-4 text-[14px] font-medium text-[#F1F1E6]"
            onClick={() => navigate(state === "full" ? ROUTES.BOOK : ROUTES.MY_SESSIONS)}
          >
            {state === "full" ? "Pick another time" : "Go to My Sessions"}
          </button>
        ) : null}
      </div>
    </div>
  );
};

const BookingConfirmationPage = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  return searchParams.get("request") === "1" && sessionId ? <RequestSent sessionId={sessionId} /> : <BookingConfirmation />;
};

export default BookingConfirmationPage;
