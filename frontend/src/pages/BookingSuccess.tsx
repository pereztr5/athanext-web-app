import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle, Calendar, Clock, MapPin, User, Receipt, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface BookingDetails {
  bookingId: string;
  coachId: string;
  athleteId: string;
  status: string;
  paymentStatus: string;
  notes: string | null;
  createdAt: string;
  slot?: {
    session_name?: string | null;
    session_type?: string | null;
    location?: string | null;
    price?: number | null;
    duration_minutes?: number | null;
    start_time?: string | null;
    end_time?: string | null;
  };
}

const formatTime = (time?: string | null) => {
  if (!time) return "-";
  return new Date(`2000-01-01T${time}`).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const BookingSuccess = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchBooking = async () => {
      if (!sessionId) return;
      setLoadError(null);
      setLoading(true);
      try {
        // First, force-verify payment status via edge function (handles webhook misses)
        await supabase.functions.invoke("create-booking-payment-v0", {
          body: { session_id: sessionId },
        });

        const { data: bookingRow, error: bookingErr } = await supabase
          .from("coach_slot_bookings" as any)
          .select(
            `id, coach_id, athlete_id, status, payment_status, notes, created_at,
             coach_availability_slot_occurrences (
               session_name,
               session_type,
               location,
               price,
               duration_minutes,
               start_time,
               end_time
             )`
          )
          .eq("stripe_session_id", sessionId)
          .maybeSingle();

        if (bookingErr) throw bookingErr;

        if (bookingRow) {
          setBookingDetails({
            bookingId: bookingRow.id,
            coachId: bookingRow.coach_id,
            athleteId: bookingRow.athlete_id,
            status: bookingRow.status,
            paymentStatus: bookingRow.payment_status,
            notes: bookingRow.notes,
            createdAt: bookingRow.created_at,
            slot: (bookingRow as any).coach_availability_slot_occurrences || {},
          });
        } else {
          setLoadError("Booking not found. If you just paid, please refresh in a moment.");
        }
      } catch (err: any) {
        console.error("Failed to load booking", err);
        setLoadError(err?.message || "Unable to load booking details.");
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [sessionId]);

  const slot = bookingDetails?.slot;
  const sessionName = slot?.session_name || "Coaching Session";
  const sessionType = slot?.session_type === "group" ? "Group" : "Individual";
  const location = slot?.location === "in-person" ? "In-Person" : slot?.location === "online" ? "Online" : "-";
  const price = slot?.price != null ? `$${slot.price}` : "-";
  const duration = slot?.duration_minutes != null ? `${slot.duration_minutes} min` : "-";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 pt-20">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <CardTitle className="text-3xl font-bold text-athlete-title">
            Booking {bookingDetails?.paymentStatus === "paid" ? "Confirmed" : "Created"}
          </CardTitle>
          <p className="text-athlete-subtitle">
            {bookingDetails?.paymentStatus === "paid"
              ? "Your payment has been processed successfully."
              : "We created your booking. Please wait for payment confirmation."}
          </p>
          {loadError && (
            <p className="text-sm text-red-600 flex items-center justify-center gap-2">
              <AlertCircle className="h-4 w-4" /> {loadError}
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-athlete-card-light p-6 rounded-xl space-y-4">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-athlete-subtitle" />
              <h3 className="text-xl font-semibold text-athlete-title">Booking Details</h3>
            </div>

            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-athlete-subtitle" />
                <div className="w-full">
                  <p className="font-medium text-athlete-title">Session</p>
                  {loading ? (
                    <Skeleton className="h-4 w-48" />
                  ) : (
                    <p className="text-athlete-subtitle">{sessionName}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-athlete-subtitle" />
                <div className="w-full">
                  <p className="font-medium text-athlete-title">Type</p>
                  {loading ? (
                    <Skeleton className="h-4 w-32" />
                  ) : (
                    <p className="text-athlete-subtitle">{sessionType}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-athlete-subtitle" />
                <div className="w-full">
                  <p className="font-medium text-athlete-title">Time</p>
                  {loading ? (
                    <Skeleton className="h-4 w-56" />
                  ) : (
                    <p className="text-athlete-subtitle">
                      {formatTime(slot?.start_time)} - {formatTime(slot?.end_time)} ({duration})
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-athlete-subtitle" />
                <div className="w-full">
                  <p className="font-medium text-athlete-title">Location</p>
                  {loading ? (
                    <Skeleton className="h-4 w-40" />
                  ) : (
                    <p className="text-athlete-subtitle">{location}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Receipt className="h-5 w-5 text-athlete-subtitle" />
                <div className="w-full">
                  <p className="font-medium text-athlete-title">Price</p>
                  {loading ? (
                    <Skeleton className="h-4 w-24" />
                  ) : (
                    <p className="text-athlete-subtitle">{price}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Receipt className="h-5 w-5 text-athlete-subtitle mt-1" />
                <div className="w-full">
                  <p className="font-medium text-athlete-title">Notes</p>
                  {loading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ) : bookingDetails?.notes ? (
                    <p className="text-athlete-subtitle whitespace-pre-wrap">{bookingDetails.notes}</p>
                  ) : (
                    <p className="text-athlete-subtitle text-muted-foreground">No notes provided</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
            <h4 className="font-semibold text-blue-900 mb-2">What's Next?</h4>
            <ul className="text-blue-800 space-y-1 text-sm">
              <li>• Your coach will contact you with any prep details</li>
              <li>• You'll receive a confirmation email with booking info</li>
              <li>• Add the session to your calendar and prepare your goals</li>
            </ul>
          </div>

          <div className="text-center space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link to="/">
                  Back to Home
                </Link>
              </Button>
              <Button asChild className="w-full sm:w-auto">
                <Link to="/coaches">
                  Book Another Session
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BookingSuccess;
