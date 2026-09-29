/**
 * AvailabilityTable Component
 * Reusable table component for displaying availability time slots
 * Used in both coach and athlete profiles
 */

import { Table, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { AvailabilityTableHeader } from '@/components/availability/AvailabilityTableHeader';
import { AvailabilityTableRow } from '@/components/availability/AvailabilityTableRow';
import { CoachAvailabilitySlot, SlotBookingStatus } from '@/types/availability';

interface AvailabilityTableProps {
  slots: CoachAvailabilitySlot[];
  onEdit?: (slot: CoachAvailabilitySlot) => void;
  onBookSlot?: (slot: CoachAvailabilitySlot) => void;
  showActions?: boolean;
  slotStatusMap?: Record<string, SlotBookingStatus>;
  slotStatusLoading?: boolean;
  platformFeePerc?: number;
  stripeFeePerc?: number;
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
  platformFeePerc = 0,
  stripeFeePerc = 0,
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
              platformFeePerc={platformFeePerc}
              stripeFeePerc={stripeFeePerc}
              platformFeeWaived={platformFeeWaived}
              appearance={appearance}
              onDelete={onDelete}
            />
          ))}

          {sortedSlots.length === 0 && (
            <TableRow className="border-0 hover:bg-transparent">
              <TableCell
                colSpan={hasActions ? 8 : 7}
                className="border-t border-[#EAEADF] px-0 py-8 text-center text-[14px] leading-[18px] tracking-[-0.03em] text-[#A3A6AB]"
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
