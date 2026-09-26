/**
 * AvailabilityTableRow Component
 * Reusable row component for displaying a single availability slot
 */

import { Button } from '@/components/ui/button';
import { TableRow, TableCell } from '@/components/ui/table';
import { CoachAvailabilitySlot, DAY_OF_WEEK_MAP, SlotBookingStatus } from '@/types/availability';
import { Loader2, SquarePen, Trash2 } from 'lucide-react';
import { getTodayISODate, hasSlotStarted, parseISODateLocal } from '@/utils/dateHelpers';

interface AvailabilityTableRowProps {
  slot: CoachAvailabilitySlot;
  onEdit?: (slot: CoachAvailabilitySlot) => void;
  onBookSlot?: (slot: CoachAvailabilitySlot) => void;
  showActions?: boolean;
  slotStatus?: SlotBookingStatus;
  isStatusLoading?: boolean;
  platformFeePerc?: number;
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
  appearance,
  onDelete,
}: AvailabilityTableRowProps) {
  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const todayISO = getTodayISODate();
  const isPastDate = slot?.occurrence_date ? slot.occurrence_date < todayISO : false;
  const isSameDayStarted = slot?.occurrence_date === todayISO
    ? hasSlotStarted(slot.occurrence_date, slot.start_time)
    : false;
  const isDateLocked = isPastDate || isSameDayStarted;
  const isEditDateLocked = slot?.occurrence_date ? slot.occurrence_date < todayISO : false;
  const isCoachDisabled = !slot.is_enabled;
  const isDisabled = isCoachDisabled || (onBookSlot ? isDateLocked : isEditDateLocked);
  const isFull = slotStatus?.isFull;
  const bookedByMe = slotStatus?.bookedByMe;
  const hasPendingPayment = slotStatus?.hasPendingPayment;
  const myPendingPayment = slotStatus?.myPendingPayment;

  const isChecking = isStatusLoading;
  const isPayNow = Boolean(myPendingPayment);
  const isReserved = Boolean(hasPendingPayment && isFull && !isPayNow && !bookedByMe);
  const isFullyBooked = Boolean(isFull && !isPayNow && !bookedByMe && !isReserved);
  const showBookAction = Boolean(onBookSlot && !isDateLocked);
  const hasBookings = (slotStatus?.totalCount ?? 0) > 0;
  const isEditLockedByBooking = hasBookings;
  const isEditDisabled = isEditLockedByBooking || isEditDateLocked || isChecking;
  const dateLabel = slot?.occurrence_date
    ? parseISODateLocal(slot.occurrence_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
  const basePrice = Number(slot.price) || 0;
  const displayPrice = onBookSlot
    ? basePrice * (1 + (platformFeePerc || 0) / 100)
    : basePrice;

  const athlete = appearance === "athlete";
  let disableBooking = isDisabled || isChecking;
  let bookLabel: string | JSX.Element = "Book";

  if (isDateLocked) {
    bookLabel = "Unavailable";
    disableBooking = true;
  } else if (isChecking) {
    bookLabel = (
      <Loader2 className="w-4 h-4 animate-spin" />
    );
    disableBooking = true;
  } else if (isPayNow) {
    bookLabel = "Pay Now";
  } else if (bookedByMe) {
    bookLabel = "Already Booked";
    disableBooking = true;
  } else if (isReserved) {
    bookLabel = "Reserved";
    disableBooking = true;
  } else if (isFullyBooked) {
    bookLabel = "Booked";
    disableBooking = true;
  }

  const cell = "h-[70px] border-[#EAEADF] bg-[#F7F7F0] px-2 text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#1A202C]";
  const locationLabel = slot.location === "online" ? "Online" : "In person";

  return (
    <TableRow className="border-[#EAEADF] hover:bg-[#F7F7F0]">
      <TableCell className={cell}>
        <div className="flex flex-col leading-tight">
          <span>{DAY_OF_WEEK_MAP[slot.day_of_week]}</span>
          {dateLabel && <span className="text-[12px] text-[#1A202C]">{dateLabel}</span>}
        </div>
      </TableCell>
      <TableCell className={`${cell} whitespace-nowrap`}>
        {slot.session_name || '-'}
      </TableCell>
      <TableCell className={cell}>
        {slot.pillar_slot ? (
          <span className="inline-flex rounded-[4px] border border-[#CCDDF0] bg-[#E5EDF7] px-2 py-1 text-[12px] font-medium leading-[13px] tracking-[-0.36px] text-[#0054B4]">
            {slot.pillar_slot}
          </span>
        ) : (
          "-"
        )}
      </TableCell>
      <TableCell className={cell}>
        ${displayPrice.toFixed(2)}
      </TableCell>
      {!athlete && (
      <TableCell className={cell}>
        {slot.duration_minutes} min
      </TableCell>
      )}
      <TableCell className={`${cell} whitespace-nowrap`}>
        {formatTime(slot.start_time)}
      </TableCell>
      <TableCell className={`${cell} whitespace-nowrap`}>
        {formatTime(slot.end_time)}
      </TableCell>
      <TableCell className={cell}>
        {slot.session_type === 'individual' ? 'Individual' : 'Group'}
      </TableCell>
      <TableCell className={cell}>
        {locationLabel}
      </TableCell>
      {showActions && (
        <TableCell className={cell}>
          <div className="flex items-center gap-2">
            {onEdit && appearance === "coach" ? (
              <button
                type="button"
                onClick={() => !isEditDisabled && onEdit(slot)}
                disabled={isEditDisabled}
                aria-label="Edit slot"
                className="inline-flex size-4 items-center justify-center text-[#767980] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <SquarePen className="size-4" strokeWidth={1.75} />
              </button>
            ) : null}
            {onDelete && appearance === "coach" ? (
              <button
                type="button"
                onClick={() => !isEditDisabled && onDelete(slot)}
                disabled={isEditDisabled}
                aria-label="Delete slot"
                className="inline-flex size-4 items-center justify-center text-[#767980] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="size-4" strokeWidth={1.75} />
              </button>
            ) : null}
            {showBookAction && (
              <Button
                size="sm"
                onClick={() => !disableBooking && onBookSlot(slot)}
                className="h-auto rounded-[8px] border border-[#6698D2] bg-[#0054B4] px-4 py-[6px] text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#F1F1E6] hover:bg-[#0054B4] disabled:border-[#EAEADF] disabled:bg-[#EAEADF] disabled:text-[#767980]"
                disabled={disableBooking}
              >
                {bookLabel}
              </Button>
            )}
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

export default AvailabilityTableRow;
