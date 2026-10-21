/**
 * AvailabilityTable Component
 * Reusable table component for displaying availability time slots
 * Used in both coach and athlete profiles
 */

import { Table, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { AvailabilityTableHeader } from '@/components/availability/AvailabilityTableHeader';
import { AvailabilityTableRow } from '@/components/availability/AvailabilityTableRow';
import { CoachAvailabilitySlot, SlotBookingStatus } from '@/types/availability';
import type { FeeConfig } from '@/utils/fees';

interface AvailabilityTableProps {
  slots: CoachAvailabilitySlot[];
  onEdit?: (slot: CoachAvailabilitySlot) => void;
  onBookSlot?: (slot: CoachAvailabilitySlot) => void;
  showActions?: boolean;
  slotStatusMap?: Record<string, SlotBookingStatus>;
  slotStatusLoading?: boolean;
  /** Fee rates for the athlete price (null while loading). */
  feeConfig?: FeeConfig | null;
  feeError?: boolean;
  platformFeeWaived?: boolean;
  appearance: "athlete" | "coach";
  onDelete?: (slot: CoachAvailabilitySlot) => void;
}

export const AvailabilityTable = ({
  slots,
  onEdit,
  onBookSlot,
  showActions = true,
  slotStatusMap,
  slotStatusLoading = false,
  feeConfig = null,
  feeError = false,
  platformFeeWaived = false,
  appearance,
  onDelete,
}: AvailabilityTableProps) => {
  const hasActions = showActions || !!onBookSlot;

  const sortedSlots = [...slots].sort((a, b) => a.day_of_week - b.day_of_week);

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[860px] border-collapse">
        <AvailabilityTableHeader showActions={hasActions} appearance={appearance} />
        <TableBody>
          {sortedSlots.map((slot) => (
            <AvailabilityTableRow
              key={slot.id}
              slot={slot}
              onEdit={onEdit}
              onBookSlot={onBookSlot}
              showActions={hasActions}
              slotStatus={slotStatusMap?.[slot.id]}
              isStatusLoading={slotStatusLoading && slotStatusMap?.[slot.id] === undefined}
              feeConfig={feeConfig}
              feeError={feeError}
              platformFeeWaived={platformFeeWaived}
              appearance={appearance}
              onDelete={onDelete}
            />
          ))}

          {sortedSlots.length === 0 && (
            <TableRow className="border-0 hover:bg-transparent">
              <TableCell
                colSpan={hasActions ? 8 : 7}
                className="border-t border-light-525 px-0 py-8 text-center text-body-m text-dark-300"
              >
                No time slots available for this period
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default AvailabilityTable;
