/**
 * AvailabilityTableRow Component
 * Reusable row component for displaying a single availability slot
 */

import { Button } from '@/components/ui/button';
import { TableRow, TableCell } from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CoachAvailabilitySlot, DAY_OF_WEEK_MAP, SlotBookingStatus } from '@/types/availability';
import { Edit, ToggleRight, Loader2 } from 'lucide-react';
import { RiReservedLine } from 'react-icons/ri';
import { getTodayISODate, hasSlotStarted, parseISODateLocal } from '@/utils/dateHelpers';

interface AvailabilityTableRowProps {
  slot: CoachAvailabilitySlot;
  onEdit?: (slot: CoachAvailabilitySlot) => void;
  onBookSlot?: (slot: CoachAvailabilitySlot) => void;
  showActions?: boolean;
  slotStatus?: SlotBookingStatus;
  isStatusLoading?: boolean;
  platformFeePerc?: number;
}

export function AvailabilityTableRow({
  slot,
  onEdit,
  onBookSlot,
  showActions = true,
  slotStatus,
  isStatusLoading = false,
  platformFeePerc = 0,
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
  const isUnavailable = isDisabled || bookedByMe || isReserved || isFullyBooked || isChecking;
  const showBookAction = Boolean(onBookSlot && !isDateLocked);
  const hasBookings = (slotStatus?.totalCount ?? 0) > 0;
  const isEditLockedByBooking = hasBookings;
  const isEditDisabled = isEditLockedByBooking || isEditDateLocked || isChecking;
  const editDisabledMessage = isChecking
    ? 'Checking slot status...'
    : isEditDateLocked
      ? 'Cannot edit slots for past dates'
      : isEditLockedByBooking
        ? 'Editing is disabled because this slot is already booked/reserved'
        : isCoachDisabled
          ? 'Enable time slot'
          : 'Edit time slot';
  const cellClassName = isUnavailable ? "text-gray-400" : "text-gray-700";
  const rowClasses = isUnavailable ? "opacity-80 bg-gray-50" : "";
  const dateLabel = slot?.occurrence_date
    ? parseISODateLocal(slot.occurrence_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
  const basePrice = Number(slot.price) || 0;
  const displayPrice = onBookSlot
    ? basePrice * (1 + (platformFeePerc || 0) / 100)
    : basePrice;

  let disableBooking = isDisabled || isChecking;
  let bookLabel: string | JSX.Element = "Book Now";

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

  return (
    <TableRow className={rowClasses}>
      <TableCell className={`font-medium ${isDisabled ? "text-gray-400" : "text-gray-900"}`}>
        <div className="flex flex-col leading-tight">
          <span>{DAY_OF_WEEK_MAP[slot.day_of_week]}</span>
          {dateLabel && <span className="text-xs text-gray-500">{dateLabel}</span>}
        </div>
      </TableCell>
      <TableCell className={`${cellClassName} whitespace-nowrap`}>
        {slot.session_name || '-'}
      </TableCell>
      <TableCell className={cellClassName}>
        {slot.pillar_slot || '-'}
      </TableCell>
      <TableCell className={cellClassName}>
        ${displayPrice.toFixed(2)}
      </TableCell>
      <TableCell className={cellClassName}>
        {slot.duration_minutes} min
      </TableCell>
      <TableCell className={`${cellClassName} whitespace-nowrap`}>
        {formatTime(slot.start_time)}
      </TableCell>
      <TableCell className={`${cellClassName} whitespace-nowrap`}>
        {formatTime(slot.end_time)}
      </TableCell>
      <TableCell className={cellClassName}>
        {slot.session_type === 'individual' ? 'Individual' : 'Group'}
      </TableCell>
      
      <TableCell className={`${cellClassName} capitalize`}>
        {slot.location === 'online' ? 'Online' : 'In-Person'}
      </TableCell>
      {showActions && (
        <TableCell>
          <div className="flex items-center gap-2">
            {onEdit && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={`inline-flex ${isEditDisabled ? 'cursor-not-allowed' : ''}`}>
                      <Button
                        variant={isCoachDisabled ? "outline" : "ghost"}
                        size="sm"
                        onClick={() => onEdit(slot)}
                        disabled={isEditDisabled}
                        className={`${isCoachDisabled ? "text-green-600 border-green-200 hover:border-green-300 hover:bg-green-50" : "text-blue-600 hover:text-blue-700 hover:bg-blue-50"} ${isEditDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
                      >
                        {isChecking ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : hasBookings ? (
                          <RiReservedLine className="w-4 h-4" />
                        ) : isCoachDisabled ? (
                          <>
                            <ToggleRight className="w-4 h-4 mr-1" />
                          </>
                        ) : (
                          <Edit className="w-4 h-4" />
                        )}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{editDisabledMessage}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {showBookAction && (
              <Button
                size="sm"
                onClick={() => !disableBooking && onBookSlot(slot)}
                className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300"
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
