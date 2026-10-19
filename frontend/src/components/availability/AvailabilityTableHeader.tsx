/**
 * AvailabilityTableHeader Component
 * Reusable header component for availability table
 */

import { TableHeader, TableRow, TableHead } from '@/components/ui/table';

interface AvailabilityTableHeaderProps {
  showActions?: boolean;
  appearance: "athlete" | "coach";
}

const head =
  "h-auto px-0 py-3 text-left text-label-xsm text-dark-300";

// `appearance` is kept for API compatibility; both views now share the same columns.
export function AvailabilityTableHeader({ showActions = true }: AvailabilityTableHeaderProps) {
  return (
    <TableHeader className="[&_tr]:border-b-0">
      <TableRow className="border-0 hover:bg-transparent">
        <TableHead className={`${head} w-[110px]`}>Day</TableHead>
        <TableHead className={`${head} w-[150px]`}>Session</TableHead>
        <TableHead className={`${head} w-[100px]`}>Pillar</TableHead>
        <TableHead className={`${head} w-[80px]`}>Price</TableHead>
        <TableHead className={`${head} w-[130px]`}>Time</TableHead>
        <TableHead className={`${head} w-[100px]`}>Type</TableHead>
        <TableHead className={`${head} w-[90px]`}>Location</TableHead>
        {showActions && (
          <TableHead className={head}>
            <span className="sr-only">Actions</span>
          </TableHead>
        )}
      </TableRow>
    </TableHeader>
  );
}

export default AvailabilityTableHeader;
