/**
 * AvailabilityTableRow Component
 * Reusable row component for displaying a single availability slot
 */

import { TableRow, TableCell } from '@/components/ui/table';
import { CoachAvailabilitySlot, DAY_OF_WEEK_MAP, SlotBookingStatus } from '@/types/availability';
import { Loader2, Pencil, Trash2 } from "@/components/icons";
import { BrandPill } from '@/components/brand';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatTimeSpan, formatWholePrice } from '@/utils/sessionFormatting';
import { formatSlotForViewer } from '@/utils/viewerTime';
import { useViewerTimeZone } from '@/hooks/useViewerTimeZone';
import { getTodayISODate, isBookingWindowClosed, parseISODateLocal } from '@/utils/dateHelpers';
import { computeSessionPrice } from "@/utils/referralHelpers";

interface AvailabilityTableRowProps {
  slot: CoachAvailabilitySlot;
  onEdit?: (slot: CoachAvailabilitySlot) => void;
  onBookSlot?: (slot: CoachAvailabilitySlot) => void;
  showActions?: boolean;
  slotStatus?: SlotBookingStatus;
  isStatusLoading?: boolean;
  platformFeePerc?: number;
  stripeFeePerc?: number;
  stripeFeeFixed?: number;
  /** Confirmed coach-client pair: no platform fee (card processing still applies). */
  platformFeeWaived?: boolean;
  appearance: "athlete" | "coach";
  onDelete?: (slot: CoachAvailabilitySlot) => void;
}

export function AvailabilityTableRow({
  slot,
  onEdit,
  onBookSlot,
  showActions = true,
  slotStatus,
  isStatusLoading = false,
  platformFeePerc = 0,
  stripeFeePerc = 0,
  stripeFeeFixed = 0,
  platformFeeWaived = false,
  appearance,
  onDelete,
}: AvailabilityTableRowProps) {
  const timeZone = useViewerTimeZone();
  const todayISO = getTodayISODate();
  const isBookingClosed = isBookingWindowClosed(slot?.occurrence_date, slot?.start_time);
  const isEditDateLocked = slot?.occurrence_date ? slot.occurrence_date < todayISO : false;
  const isCoachDisabled = !slot.is_enabled;
  const isFull = slotStatus?.isFull;
  const bookedByMe = slotStatus?.bookedByMe;
  const hasPendingPayment = slotStatus?.hasPendingPayment;
  const myPendingPayment = slotStatus?.myPendingPayment;
  const isDateLocked = Boolean(onBookSlot) && isBookingClosed && !myPendingPayment;
  const isDisabled = isCoachDisabled || (onBookSlot ? isDateLocked : isEditDateLocked);

  const isChecking = isStatusLoading;
  const isPayNow = Boolean(myPendingPayment);
  const isReserved = Boolean(hasPendingPayment && isFull && !isPayNow && !bookedByMe);
  const isFullyBooked = Boolean(isFull && !isPayNow && !bookedByMe && !isReserved);
  const showBookAction = Boolean(onBookSlot);
  const hasBookings = (slotStatus?.totalCount ?? 0) > 0;
  const isEditLockedByBooking = hasBookings;
  const isEditDisabled = isEditLockedByBooking || isEditDateLocked || isChecking;
  const dateLabel = slot?.occurrence_date
    ? parseISODateLocal(slot.occurrence_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
  const basePrice = Number(slot.price) || 0;
  // Athletes see what Stripe will charge; coaches managing slots see their base price.
  const displayPrice = onBookSlot
    ? computeSessionPrice(basePrice, platformFeePerc || 0, stripeFeePerc || 0, platformFeeWaived, stripeFeeFixed || 0).total
    : basePrice;

  let disableBooking = isDisabled || isChecking;
  let bookLabel = "Book";
  // Non-actionable states render as a neutral pill instead of a disabled button.
  let statusPill: string | null = null;

  if (isDateLocked) {
    statusPill = "Unavailable";
    disableBooking = true;
  } else if (isChecking) {
    disableBooking = true;
  } else if (isPayNow) {
    bookLabel = "Pay now";
  } else if (slotStatus?.myRequested) {
    statusPill = "Requested";
    disableBooking = true;
  } else if (bookedByMe) {
    statusPill = "Already booked";
    disableBooking = true;
  } else if (isReserved) {
    statusPill = "Reserved";
    disableBooking = true;
  } else if (isFullyBooked) {
    statusPill = "Fully booked";
    disableBooking = true;
  } else if (disableBooking) {
    statusPill = "Unavailable";
  }

  // Rows that can't be acted on read as faint text, matching the brand table.
  const isMutedRow = isCoachDisabled || (showBookAction ? Boolean(statusPill) : isEditDateLocked);
  const textTone = isMutedRow ? "text-dark-200" : "text-dark";
  const subTone = isMutedRow ? "" : "text-dark-300";
  const cell = "h-auto border-t border-light-525 bg-transparent px-0 py-4 pr-3 align-middle text-body-m";
  const textCell = `${cell} ${textTone}`;
  const locationLabel = slot.location === "online" ? "Online" : "In person";
  const isIndividual = slot.session_type === 'individual';
  const typeTone = isMutedRow ? "muted" : isIndividual ? "blue" : "teal";
  // Stored as Eastern wall-clock; show it in the viewer's zone (ATH-22).
  const viewerSlot = formatSlotForViewer(slot.occurrence_date, slot.start_time, slot.end_time, timeZone);
  const timeLabel = viewerSlot.span || formatTimeSpan(slot.start_time, slot.end_time);

  return (
    <TableRow className="border-0 hover:bg-transparent">
      <TableCell className={textCell}>
        <div className="font-medium">{DAY_OF_WEEK_MAP[slot.day_of_week]}</div>
        {dateLabel && (
          <div className={`mt-[2px] text-caption ${subTone}`}>{dateLabel}</div>
        )}
      </TableCell>
      <TableCell className={`${textCell} whitespace-nowrap`}>
        {slot.session_name || '-'}
      </TableCell>
      <TableCell className={textCell}>
        {slot.pillar_slot || '-'}
      </TableCell>
      <TableCell className={textCell}>
        {formatWholePrice(displayPrice)}
        {onBookSlot && platformFeeWaived ? (
          <div className="mt-[2px] text-caption text-success-700">No service fee</div>
        ) : null}
      </TableCell>
      <TableCell className={`${textCell} whitespace-nowrap`}>
        {timeLabel}
        <div className={`mt-[2px] text-caption ${subTone}`}>
          {viewerSlot.dayShift ? `${viewerSlot.dayShift} · ` : ""}{slot.duration_minutes} min
        </div>
      </TableCell>
      <TableCell className={cell}>
        <BrandPill tone={typeTone}>{isIndividual ? 'Individual' : 'Group'}</BrandPill>
      </TableCell>
      <TableCell className={textCell}>
        {locationLabel}
      </TableCell>
      {showActions && (
        <TableCell className={`${cell} pr-0`}>
          <div className="flex items-center justify-end gap-3">
            {onEdit && appearance === "coach" ? (
              <button
                type="button"
                onClick={() => !isEditDisabled && onEdit(slot)}
                disabled={isEditDisabled}
                aria-label="Edit slot"
                className="inline-flex size-4 items-center justify-center text-dark-300 hover:text-dark disabled:cursor-not-allowed disabled:text-dark-200"
              >
                <Pencil className="size-4" strokeWidth={1.5} />
              </button>
            ) : null}
            {onDelete && appearance === "coach" ? (
              <button
                type="button"
                onClick={() => !isEditDisabled && onDelete(slot)}
                disabled={isEditDisabled}
                aria-label="Delete slot"
                className="inline-flex size-4 items-center justify-center text-dark-300 hover:text-dark disabled:cursor-not-allowed disabled:text-dark-200"
              >
                <Trash2 className="size-4" strokeWidth={1.5} />
              </button>
            ) : null}
            {showBookAction && (
              statusPill ? (
                <BrandPill tone="neutral">{statusPill}</BrandPill>
              ) : (
                <button
                  type="button"
                  onClick={() => !disableBooking && onBookSlot?.(slot)}
                  disabled={disableBooking}
                  aria-label={isChecking ? "Checking availability" : undefined}
                  className={cn(buttonVariants({ size: "sm" }), "px-4")}
                >
                  {isChecking ? <Loader2 className="size-4 animate-spin" strokeWidth={1.5} /> : bookLabel}
                </button>
              )
            )}
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

export default AvailabilityTableRow;
