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
}

export const AvailabilityTable = ({
  slots,
  onEdit,
  onBookSlot,
  showActions = true,
  slotStatusMap,
  slotStatusLoading = false,
  platformFeePerc = 0,
}: AvailabilityTableProps) => {
  const hasActions = showActions || !!onBookSlot;

  const sortedSlots = [...slots].sort((a, b) => a.day_of_week - b.day_of_week);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <Table className="min-w-[960px]">
          <AvailabilityTableHeader showActions={hasActions} />
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
              />
            ))}

            {sortedSlots.length === 0 && (
              <TableRow>
                <TableCell colSpan={hasActions ? 10 : 9} className="py-8 text-center text-gray-500">
                  No time slots available for this period
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AvailabilityTable;
