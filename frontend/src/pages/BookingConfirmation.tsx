/**
 * Booking confirmation / receipt (Working Copy a-receipt): one or several sessions, credits,
 * pay-direct and requests. After Stripe: ?session_id=. After credits/direct: ?bookings=.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { bookAPI } from "@/api/book";
import { fetchBookingReceipt } from "@/api/receipts";
import BookingReceipt from "@/components/receipts/BookingReceipt";
import { buildReceiptModel, calendarEvents, receiptText } from "@/components/receipts/receiptModel";
import { pageTitle, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { useBookingFees } from "@/hooks/useBookingFees";
import { useToast } from "@/hooks/use-toast";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { clearPendingRequests, readPendingRequests } from "@/utils/pendingRequests";
import { FALLBACK_CONTACT_METHODS } from "@/utils/db";
import { downloadText } from "@/utils/download";
import { buildIcs } from "@/utils/ics";
import { plural } from "@/utils/schedule";

const SUPPORT = FALLBACK_CONTACT_METHODS.find((method) => method.icon === "email")?.value;

const idsFrom = (raw: string | null) =>
  (raw ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

const BookingConfirmation = () => {
  const timeZone = useViewerTimeZone();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const sessionId = searchParams.get("session_id");
  const bookingIds = idsFrom(searchParams.get("bookings"));
  const source = sessionId ? { stripeSessionId: sessionId } : { bookingIds };

  const receipt = useQuery({
    queryKey: ["booking-receipt", sessionId, bookingIds.join(",")],
    enabled: Boolean(sessionId || bookingIds.length),
    queryFn: () => fetchBookingReceipt(source),
  });
  const fees = useBookingFees(receipt.data?.bookings[0]?.athleteId);
  const model = useMemo(
    () => (receipt.data ? buildReceiptModel(receipt.data, timeZone, fees) : null),
    [receipt.data, timeZone, fees]
  );

  const addToCalendar = () => {
    if (!model) return;
    const events = calendarEvents(model);
    if (!events.length) {
      toast({ title: "Nothing to add", description: "Requests go on the calendar once the coach accepts." });
      return;
    }
    downloadText(buildIcs(events), `athanext-${model.number || "sessions"}.ics`, "text/calendar");
  };

  const emailReceipt = () => {
    if (!model) return;
    const to = model.email;
    const subject = encodeURIComponent(`AthaNext ${model.isReceipt ? "receipt" : "confirmation"} ${model.number ? `#${model.number}` : ""}`.trim());
    const body = encodeURIComponent(receiptText(model, SUPPORT));
    window.location.href = to ? `mailto:${to}?subject=${subject}&body=${body}` : `mailto:?subject=${subject}&body=${body}`;
    toast({ title: to ? `Draft opened for ${to}` : "Draft opened", description: "Send it from your mail app. Stripe also emails a receipt when you pay by card." });
  };

  if (!sessionId && !bookingIds.length) {
    return (
      <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
        <div className="mx-auto flex max-w-[700px] flex-col gap-4">
          <h1 className={pageTitle}>Receipt not found</h1>
          <p className="text-[14px] text-[#767980]">This page opens after you book.</p>
          <Link to={ROUTES.BOOK} className={cn(secondaryButton, "self-start")}>
            Back to booking
          </Link>
        </div>
      </div>
    );
  }

  if (receipt.isError) {
    return (
      <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
        <div className="mx-auto flex max-w-[700px] flex-col gap-4">
          <h1 className={pageTitle}>Couldn't load this receipt</h1>
          <p className="flex items-center gap-2 text-[14px] text-[#972B2B]">
            <AlertCircle className="size-4 flex-none" strokeWidth={1.5} />
            {receipt.error instanceof Error ? receipt.error.message : "Try again in a moment."}
          </p>
          <Link to={ROUTES.MY_SESSIONS} className={cn(secondaryButton, "self-start")}>
            View in My Sessions
          </Link>
        </div>
      </div>
    );
  }

  const confirmed = model?.confirmed ?? 0;
  const requests = model?.requests ?? 0;
  const title = model && !confirmed && requests ? "Request sent" : "You're booked";
  const sub = !model
    ? "Loading your receipt…"
    : confirmed
      ? `${plural(confirmed, "session")} confirmed${requests ? `, ${plural(requests, "request")} sent` : ""}. Your coaches have been notified${model.email ? ` and a copy goes to ${model.email}` : ""}.`
      : "Nothing is charged until the coach accepts. Times are held for 24 hours and you get a message either way.";

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-[700px] flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2.5">
            <h1 className={pageTitle}>{title}</h1>
            <p className="text-[14px] leading-[18px] text-[#767980]">{sub}</p>
          </div>
          <div className="flex flex-none flex-wrap gap-2">
            <Link to={ROUTES.BOOK} className={secondaryButton}>
              Book more
            </Link>
            <Link to={ROUTES.MY_SESSIONS} className={primaryButton}>
              View in My Sessions
            </Link>
          </div>
        </header>
        {model ? (
          <BookingReceipt model={model} supportEmail={SUPPORT} onAddToCalendar={addToCalendar} onEmail={emailReceipt} />
        ) : (
          <div className="h-64 animate-pulse rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0]" />
        )}
      </div>
    </div>
  );
};

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
    held: ["Request sent", "Nothing is charged until the coach accepts. Times are held for 24 hours and you get a message either way."],
    full: ["That time just filled up", "Your card was not charged and the hold is released. Pick another time."],
    error: ["We couldn't confirm your request", "Your card was not charged. Check My Sessions, or try again."],
  }[state];
  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-[700px] flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2.5">
            <h1 className={pageTitle}>{copy[0]}</h1>
            <p className="text-[14px] leading-[18px] text-[#767980]">{copy[1]}</p>
          </div>
          {state !== "checking" ? (
            <button
              type="button"
              className={primaryButton}
              onClick={() => navigate(state === "full" ? ROUTES.BOOK : ROUTES.MY_SESSIONS)}
            >
              {state === "full" ? "Pick another time" : "View in My Sessions"}
            </button>
          ) : null}
        </header>
      </div>
    </div>
  );
};

const PendingRequestsStep = () => {
  const [pending, setPending] = useState(readPendingRequests);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!pending) return null;
  const go = async () => {
    setOpening(true);
    setError(null);
    try {
      const result = await bookAPI.checkout(pending.occurrenceIds, pending.athleteId);
      clearPendingRequests();
      if (result.url) window.location.href = result.url;
      else setPending(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the requests.");
      setOpening(false);
    }
  };
  return (
    <div className="px-4 pt-6 md:px-5">
      <div className="mx-auto flex w-full max-w-[700px] flex-col gap-3 rounded-[10px] border border-[#F0B144] bg-[#FCEFDA] p-5">
        <b className="text-[16px] font-medium text-[#1A202C]">One more step: your requests</b>
        <p className="text-[14px] leading-[20px] text-[#484D56]">
          {pending.occurrenceIds.length === 1 ? "1 time" : `${pending.occurrenceIds.length} times`} with {pending.coachNames.join(" and ")} need the
          coach to accept. Hold your card now; it's charged only if they accept.
        </p>
        {error ? <p className="text-[14px] text-[#972B2B]">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={primaryButton} disabled={opening} onClick={go}>
            {opening ? "Opening…" : "Hold card and send requests"}
          </button>
          <button
            type="button"
            className="inline-flex h-[34px] items-center px-2 text-[14px] font-medium text-[#767980] hover:underline"
            onClick={() => {
              clearPendingRequests();
              setPending(null);
            }}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
};

const BookingConfirmationPage = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  if (searchParams.get("request") === "1" && sessionId) return <RequestSent sessionId={sessionId} />;
  return (
    <>
      <PendingRequestsStep />
      <BookingConfirmation />
    </>
  );
};

export default BookingConfirmationPage;
