/**
 * AvailabilityTableHeader Component
 * Reusable header component for availability table
 */

import { TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { strings } from '@/config/strings';

interface AvailabilityTableHeaderProps {
  showActions?: boolean;
  appearance: "athlete" | "coach";
}

export function AvailabilityTableHeader({ showActions = true, appearance }: AvailabilityTableHeaderProps) {
  const athlete = appearance === "athlete";
  const head = "h-[54px] bg-[#F4F4EB] px-0 text-[12px] font-medium leading-[13px] tracking-[-0.36px] text-[#767980]";
  return (
    <TableHeader>
      <TableRow className="border-[#EAEADF] hover:bg-transparent">
        <TableHead className={head}>{strings.availability.table.day}</TableHead>
        <TableHead className={head}>{strings.availability.table.sessionName}</TableHead>
        <TableHead className={head}>{strings.availability.table.pillar}</TableHead>
        <TableHead className={head}>{strings.availability.table.price}</TableHead>
        {!athlete && <TableHead className={head}>{strings.availability.table.duration}</TableHead>}
        <TableHead className={head}>{strings.availability.table.startTime}</TableHead>
        <TableHead className={head}>{strings.availability.table.endTime}</TableHead>
        <TableHead className={head}>{strings.availability.table.type}</TableHead>
        <TableHead className={head}>{strings.availability.table.location}</TableHead>
        {showActions && <TableHead className={head}>{strings.availability.table.actions}</TableHead>}
      </TableRow>
    </TableHeader>
  );
}

export default AvailabilityTableHeader;
