import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/routes";
import { bookingsAPI, type BookingConfirmationData } from "@/api/bookings";
import { formatSlotTime } from "@/utils/sessionFormatting";
import { parseISODateLocal } from "@/utils/dateHelpers";
import { formatDateToUSA } from "@/utils/helperFunctions";
import BookingReceipt from "@/components/receipts/BookingReceipt";
import { useFeeConfig } from "@/hooks/useFeeConfig";

interface CoachInfo {
  name?: string | null;
  title?: string | null;
}

const BookingConfirmation = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  
  const [bookingDetails, setBookingDetails] = useState<BookingConfirmationData | null>(null);
  const [coachInfo, setCoachInfo] = useState<CoachInfo>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const { platformFeePerc, stripeFeePerc } = useFeeConfig();
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
  const sessionName = slot?.session_name || "Coaching Session";
  const sessionType = slot?.session_type === "group" ? "Group" : "Individual";
  const location = slot?.location === "in-person" ? "In-Person" : slot?.location === "online" ? "Online" : "-";
  const feeAdjustedPriceValue =
    typeof slot?.price === "number"
      ? Number(
          (
            slot.price *
            (1 + (platformFeePerc || 0) / 100 + (stripeFeePerc || 0) / 100)
          ).toFixed(2)
        )
      : 0;
  const price = feeAdjustedPriceValue ? formatCurrency(feeAdjustedPriceValue) : "-";
  const duration = slot?.duration_minutes != null ? `${slot.duration_minutes} minutes` : "-";
  const occurrenceDate = slot?.occurrence_date || null;
  const basePriceValue = feeAdjustedPriceValue;
  const totalPaidValue = basePriceValue;

  const { formattedDate, dayOfWeek } = useMemo(() => {
    if (!occurrenceDate) {
      return { formattedDate: "-", dayOfWeek: "-" };
    }

    const parsedDate = parseISODateLocal(occurrenceDate);
    if (isNaN(parsedDate.getTime())) {
      return { formattedDate: "-", dayOfWeek: "-" };
    }

    return {
      formattedDate: parsedDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      dayOfWeek: parsedDate.toLocaleDateString("en-US", { weekday: "long" }),
    };
  }, [occurrenceDate]);

  const coachName = coachInfo.name?.trim() || "";
  const coachTitle = coachInfo.title?.trim() || "";
  const coachInitials = useMemo(() => {
    if (!coachName) return "C";
    const parts = coachName.split(" ").filter(Boolean);
    if (!parts.length) return "C";
    return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "C";
  }, [coachName]);

  const sessionTimeLabel = useMemo(() => {
    const start = formatSlotTime(slot?.start_time);
    const end = formatSlotTime(slot?.end_time);
    if (!start && !end) return "-";
    return `${start} - ${end}`.trim();
  }, [slot?.start_time, slot?.end_time]);

  const issueDateLabel = useMemo(() => {
    const formatted = bookingDetails?.createdAt
      ? formatDateToUSA(bookingDetails.createdAt)
      : "";
    return formatted || "-";
  }, [bookingDetails?.createdAt]);

  const receiptData = useMemo(() => {
    if (!bookingDetails) return null;

    return {
      bookingId: bookingDetails.bookingId || "—",
      issueDateLabel,
      sessionName,
      sessionDate: formattedDate,
      sessionDay: dayOfWeek,
      sessionTime: sessionTimeLabel,
      duration,
      type: sessionType,
      location,
      coachName: coachName || "Your Coach",
      coachTitle: coachTitle || undefined,
      coachInitials,
      basePriceLabel: formatCurrency(basePriceValue),
      totalPaidLabel: formatCurrency(totalPaidValue),
    };
  }, [
    basePriceValue,
    bookingDetails,
    coachInitials,
    coachName,
    coachTitle,
    dayOfWeek,
    duration,
    formatCurrency,
    formattedDate,
    issueDateLabel,
    location,
    sessionName,
    sessionTimeLabel,
    sessionType,
    totalPaidValue,
  ]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center px-4 py-8 sm:py-12 lg:py-16">
      <div className="w-full max-w-6xl space-y-8 lg:space-y-10">
        {/* Header Section */}
        <div className="bg-blue-50 rounded-3xl px-6 py-12 sm:px-10 sm:py-14 lg:px-12 lg:py-16 text-center flex flex-col items-center gap-5">
          <div className="h-16 w-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
            <CheckCircle className="h-8 w-8 text-white" strokeWidth={2.5} />
          </div>
          <div className="space-y-3 max-w-2xl">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
              {bookingDetails?.paymentStatus === "paid" ? "Booking Confirmed!" : "Booking Created"}
            </h1>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
              Great! Your training session{coachName ? ` with ${coachName}` : ""} has been successfully booked.<br className="hidden sm:inline" />
              Get ready to elevate your game!
            </p>
          </div>
          {loadError && (
            <p className="text-sm flex items-center justify-center gap-2 bg-red-50 px-4 py-2 rounded-lg text-red-600">
              <AlertCircle className="h-4 w-4" /> {loadError}
            </p>
          )}
        </div>

        {/* Content Section */}
        <div className="grid gap-6 lg:gap-8 lg:grid-cols-[1.4fr_1fr] items-start">
          {/* Left: Booking Details Card */}
          <div className="bg-blue-50 shadow-sm rounded-3xl p-6 sm:p-8 lg:p-9 border border-blue-100">
            <div className="space-y-1 mb-6">
              <p className="text-lg font-bold text-gray-900">Your Booking Details</p>
              <p className="text-sm text-gray-500">Session Information</p>
            </div>

            {/* Inner White Card */}
            <div className="bg-white rounded-2xl p-6 sm:p-7 space-y-6 shadow-sm">
              {/* Session & Price Row */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Session</p>
                  {loading ? (
                    <Skeleton className="h-7 w-48" />
                  ) : (
                    <p className="text-xl font-bold text-gray-900">{sessionName}</p>
                  )}
                </div>
                <div className="text-right space-y-1.5">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Price</p>
                  {loading ? (
                    <Skeleton className="h-7 w-16 ml-auto" />
                  ) : (
                    <p className="text-xl font-bold text-blue-600">{price}</p>
                  )}
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-y-5 gap-x-4 text-sm">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date</p>
                  {loading ? (
                    <Skeleton className="h-5 w-28" />
                  ) : (
                    <p className="font-semibold text-gray-900">{formattedDate}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Day</p>
                  {loading ? (
                    <Skeleton className="h-5 w-24" />
                  ) : (
                    <p className="font-semibold text-gray-900">{dayOfWeek}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Time</p>
                  {loading ? (
                    <Skeleton className="h-5 w-32" />
                  ) : (
                    <p className="font-semibold text-gray-900">
                      {formatSlotTime(slot?.start_time)} - {formatSlotTime(slot?.end_time)}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Duration</p>
                  {loading ? (
                    <Skeleton className="h-5 w-20" />
                  ) : (
                    <p className="font-semibold text-gray-900">{duration}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Type</p>
                  {loading ? (
                    <Skeleton className="h-5 w-20" />
                  ) : (
                    <p className="font-semibold text-gray-900">{sessionType}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Location</p>
                  {loading ? (
                    <Skeleton className="h-5 w-24" />
                  ) : (
                    <p className="font-semibold text-gray-900">{location}</p>
                  )}
                </div>
              </div>

              {/* Coach Info */}
              {loading ? (
                <div className="flex items-center gap-3.5 pt-5 border-t border-gray-200">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ) : (
                coachName && (
                  <div className="flex items-center gap-3.5 pt-5 border-t border-gray-200">
                    <Avatar className="h-12 w-12 text-white bg-blue-600">
                      <AvatarFallback className="font-semibold text-base bg-blue-600">{coachInitials}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Coach</p>
                      <p className="text-base font-bold text-gray-900">{coachName}</p>
                      {coachTitle && <p className="text-sm text-gray-600">{coachTitle}</p>}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Right: What's Next & Actions */}
          <div className="space-y-5">
            {/* What's Next Card */}
            <div className="bg-blue-50 shadow-sm rounded-3xl p-6 sm:p-8 space-y-5 border border-blue-100">
              <p className="text-lg font-bold text-gray-900">What's Next?</p>
              <ul className="space-y-3.5 text-sm text-gray-700">
                <li className="flex gap-3">
                  <span className="text-blue-600 font-bold mt-0.5">•</span>
                  <span className="leading-relaxed">Your coach will contact you with any prep details</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-600 font-bold mt-0.5">•</span>
                  <span className="leading-relaxed">You'll receive a confirmation email with booking info</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-600 font-bold mt-0.5">•</span>
                  <span className="leading-relaxed">Add the session to your calendar and prepare your goals</span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3.5">
              <Button 
                onClick={handleDownloadReceipt}
                disabled={loading}
                className="w-full h-14 text-base font-semibold rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md hover:shadow-lg transition-all hover:scale-[1.02]"
              >
                Download Receipt
              </Button>
              <Button
                onClick={handleNavigateToProfile}
                disabled={loading}
                variant="outline"
                className="w-full h-14 text-base font-semibold rounded-full border-2 border-blue-500 text-blue-600 bg-white hover:bg-blue-50 transition-colors"
              >
                Back to Profile
              </Button>
            </div>

            {/* Support Link */}
            <div className="text-center text-sm text-gray-600 pt-2">
              Need help?{" "}
              <button 
                onClick={handleNavigateToContact}
                className="font-semibold text-blue-600 hover:underline transition-colors"
              >
                Contact Support
              </button>
            </div>
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

export default BookingConfirmation;
