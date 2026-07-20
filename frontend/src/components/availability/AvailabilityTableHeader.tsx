/**
 * AvailabilityTableHeader Component
 * Reusable header component for availability table
 */

import { TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { strings } from '@/config/strings';

interface AvailabilityTableHeaderProps {
  showActions?: boolean;
}

export function AvailabilityTableHeader({ showActions = true }: AvailabilityTableHeaderProps) {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>{strings.availability.table.day}</TableHead>
        <TableHead>{strings.availability.table.sessionName}</TableHead>
        <TableHead>{strings.availability.table.pillar}</TableHead>
        <TableHead>{strings.availability.table.price}</TableHead>
        <TableHead>{strings.availability.table.duration}</TableHead>
        <TableHead>{strings.availability.table.startTime}</TableHead>
        <TableHead>{strings.availability.table.endTime}</TableHead>
        <TableHead>{strings.availability.table.type}</TableHead>
        <TableHead>{strings.availability.table.location}</TableHead>
        {showActions && <TableHead>{strings.availability.table.actions}</TableHead>}
      </TableRow>
    </TableHeader>
  );
}

export default AvailabilityTableHeader;
