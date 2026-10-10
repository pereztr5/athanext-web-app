import { BrandPill } from "@/components/brand";
import type { ScheduleBooking } from "@/api/schedule";
import { fillBar, fillTrack } from "./styles";

const OUTSIDE = new Set(["outside", "direct"]);

/** Day row pay pill (Working Copy): Credit, Awaiting payment, Paid outside or Paid. */
export const PayPill = ({ booking }: { booking: ScheduleBooking | undefined }) => {
  if (!booking) return null;
  if (booking.paymentStatus === "credit") return <BrandPill tone="green">Credit</BrandPill>;
  if (OUTSIDE.has(booking.paymentStatus)) return <BrandPill tone="neutral">Paid outside</BrandPill>;
  if (booking.paymentStatus === "paid") return <BrandPill tone="green">Paid</BrandPill>;
  return <BrandPill tone="amber">Awaiting payment</BrandPill>;
};

/** Group sheet pill per athlete: Credit, Paid outside, Paid in app or Awaiting payment. */
export const GroupPayPill = ({ booking }: { booking: ScheduleBooking }) => {
  if (booking.paymentStatus === "credit") return <BrandPill tone="green">Credit</BrandPill>;
  if (OUTSIDE.has(booking.paymentStatus)) return <BrandPill tone="green">Paid outside</BrandPill>;
  if (booking.paymentStatus === "paid") return <BrandPill tone="green">Paid in app</BrandPill>;
  if (booking.status === "pending_payment" || booking.paymentStatus === "unpaid") return <BrandPill tone="amber">Awaiting payment</BrandPill>;
  return <BrandPill tone="neutral">Booked</BrandPill>;
};

export const FillBar = ({ booked, capacity }: { booked: number; capacity: number }) => (
  <span className={fillTrack} aria-hidden="true">
    <i className={fillBar} style={{ width: `${Math.min(100, (booked / Math.max(1, capacity)) * 100)}%` }} />
  </span>
);
