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
  appearance,
  onDelete,
}: AvailabilityTableProps) => {
  const hasActions = showActions || !!onBookSlot;
  const athlete = appearance === "athlete";

  const sortedSlots = [...slots].sort((a, b) => a.day_of_week - b.day_of_week);

  return (
    <div className="overflow-hidden rounded-[10px] border border-[#EAEADF] bg-[#F1F1E6]">
      <div className="overflow-x-auto">
        <Table className="min-w-[960px]">
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
                appearance={appearance}
                onDelete={onDelete}
              />
            ))}

            {sortedSlots.length === 0 && (
              <TableRow>
                <TableCell colSpan={hasActions ? (athlete ? 9 : 10) : (athlete ? 8 : 9)} className="py-8 text-center text-[#A3A6AB]">
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
