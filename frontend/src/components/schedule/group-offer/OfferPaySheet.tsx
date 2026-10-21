/**
 * Review and pay for sessions ticked on a group-offer card (WC4 `pk-pay`).
 * Uses the app's fee lines and existing checkout / pay-direct path. Refunds stay on the
 * cancellation-credit path — this sheet never opens a card refund.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { bookAPI } from "@/api/book";
import type { GroupOffer, GroupOfferSession } from "@/api/schedule";
import { canApplePay } from "@/components/book/applePay";
import { FeeLines } from "@/components/book/FeeLines";
import { cardRateText, feeAmountText } from "@/utils/feeDisplay";
import { ApplePayButton, sheetBody, sheetContent, sheetFooter, sheetHeader, sheetTitle, stat28 } from "@/components/book/checkoutParts";
import { CheckoutTermsLine } from "@/components/legal/LegalLinks";
import { meta, primaryButton, textButton } from "@/components/schedule/styles";
import { useAuth } from "@/contexts/AuthContext";
import { useBookingFees } from "@/hooks/useBookingFees";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { planBooking } from "@/utils/bookPlan";
import { formatDayISO, plural } from "@/utils/schedule";
import { money2 } from "./parts";

export const OfferPaySheet = ({
  open,
  onOpenChange,
  offer,
  sessions,
  athleteId,
  athleteName,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: GroupOffer;
  sessions: GroupOfferSession[];
  athleteId: string;
  athleteName: string;
  onPaid: () => void;
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fees = useBookingFees(athleteId);
  const offlineCard = useQuery({
    queryKey: ["booking-coach-card", offer.coachId, athleteId],
    queryFn: async () => {
      const { data, error: err } = await supabase.rpc("booking_coach_card", {
        p_coach_id: offer.coachId,
        p_athlete_id: athleteId,
      });
      if (err) throw err;
      return data as { offline_pay_available?: boolean } | null;
    },
    enabled: Boolean(athleteId) && !offer.coachPaysDirect && open,
  });
  const [apple] = useState(() => canApplePay());
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setOffline(false);
    setError(null);
  }, [open]);

  const coaches = useMemo(
    () => ({
      [offer.coachId]: {
        id: offer.coachId,
        needsRequest: false,
        paysDirect: offer.coachPaysDirect || offline,
        credits: 0,
      },
    }),
    [offer.coachId, offer.coachPaysDirect, offline]
  );

  const picked = sessions.map((s) => ({
    id: s.id,
    coachId: offer.coachId,
    price: s.price,
    date: s.date,
    startTime: s.startTime,
  }));
  const plan = planBooking(picked, coaches, false, fees);
  const first = offer.coachName.split(" ")[0] || "the coach";
  const canOff = Boolean(offlineCard.data?.offline_pay_available) && !offer.coachPaysDirect;
  const direct = offline || offer.coachPaysDirect;
  const total = direct ? plan.payDirect || plan.subtotal : plan.dueNow;
  // A card total waits for the fee rates, so the amount shown is what is charged.
  const totalText = direct ? money2(total) : feeAmountText(plan.feesReady, plan.feesError, money2(total));
  const cardBlocked = !direct && !plan.feesReady;

  const pay = useMutation({
    mutationFn: () => bookAPI.checkout(
      sessions.map((s) => s.id),
      athleteId,
      true,
      offline && !offer.coachPaysDirect
    ),
    onSuccess: (result) => {
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["group-offer", offer.id] });
      onPaid();
      onOpenChange(false);
      if (result.direct || direct) {
        toast({
          title: `Booked ${plural(sessions.length, "session")}`,
          description: `Pay ${first} ${money2(plan.payDirect || plan.subtotal)} directly. Nothing was charged in AthaNext.`,
        });
        return;
      }
      toast({ title: `Booked ${plural(sessions.length, "session")}` });
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Couldn't book these sessions."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={sheetContent}>
        <DialogHeader className={sheetHeader}>
          <DialogTitle className={sheetTitle}>Review and pay</DialogTitle>
          <DialogDescription className={meta}>For {athleteName}</DialogDescription>
        </DialogHeader>
        <div className={sheetBody}>
          <div className="flex flex-col gap-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 text-body-m">
                <span className="min-w-0 truncate">
                  {s.sessionName} · {formatDayISO(s.date, { weekday: "short", month: "short", day: "numeric" })}
                </span>
                <span className="flex-none tabular-nums">{money2(s.price)}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 rounded-card border border-light-525 bg-light-400 px-4 py-3.5 text-body-m">
            {direct ? (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-subtitle">Pay {first} directly</span>
                  <span className={stat28}>{money2(total)}</span>
                </div>
                <span className={meta}>
                  {offer.coachPayNote || `${first} takes payment directly. Nothing is charged in AthaNext.`}
                </span>
              </>
            ) : (
              <>
                <div className="flex justify-between gap-3">
                  <span className="text-dark-300">{sessions.length > 1 ? "Sessions" : "Session"}</span>
                  <span className="tabular-nums">{money2(plan.subtotal)}</span>
                </div>
                <FeeLines platformFees={plan.platformFees} processingFees={plan.processingFees} ready={plan.feesReady} error={plan.feesError} />
                <div className="h-px bg-light-525" />
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-subtitle">Total</span>
                  <span className={stat28}>{totalText}</span>
                </div>
              </>
            )}
          </div>

          {error ? <p className="text-body-m text-error-700">{error}</p> : null}
        </div>
        <div className={cn(sheetFooter, "flex-col")}>
          {pay.isPending ? (
            <button type="button" className={cn(primaryButton, "h-[48px] w-full")} disabled>
              Working…
            </button>
          ) : direct ? (
            <button type="button" className={cn(primaryButton, "h-[48px] w-full")} disabled={!user} onClick={() => pay.mutate()}>
              Book {plural(sessions.length, "session")}
            </button>
          ) : apple ? (
            <ApplePayButton label={`Pay ${totalText} with`} className="h-[48px] w-full" disabled={!user || cardBlocked} onClick={() => pay.mutate()} />
          ) : (
            <button type="button" className={cn(primaryButton, "h-[48px] w-full")} disabled={!user || cardBlocked} onClick={() => pay.mutate()}>
              Pay {totalText}
            </button>
          )}
          {!direct ? <CheckoutTermsLine /> : null}
          {canOff ? (
            <button type="button" className={cn(textButton, "justify-center text-dark-300")} onClick={() => setOffline((v) => !v)}>
              {offline ? "Pay by card instead" : `Pay ${first} directly instead`}
            </button>
          ) : null}
          {offline ? (
            <span className={cn(meta, "text-center")}>
              Card adds card processing of {cardRateText(fees.config)}, Stripe&apos;s rate.
            </span>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
