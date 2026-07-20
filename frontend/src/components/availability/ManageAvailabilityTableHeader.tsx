/**
 * ManageAvailabilityTableHeader Component
 * Reusable header component for manage availability table
 */

interface ManageAvailabilityTableHeaderProps {
  compact?: boolean;
}

export const ManageAvailabilityTableHeader = ({ compact = false }: ManageAvailabilityTableHeaderProps) => {
  const verticalPadding = compact ? 'py-2' : 'py-3';
  const cellClass = `${compact ? 'px-2' : 'px-4'} ${verticalPadding} text-left text-sm font-semibold text-gray-700`;
  const priceClass = compact ? 'w-16' : 'w-20';
  const locationClass = compact ? 'w-28' : '';

  return (
    <thead className="bg-gray-50 border-b sticky top-0 z-10">
      <tr>
        <th className={cellClass}>Day</th>
        <th className={cellClass}>Session Name</th>
        <th className={cellClass}>Pillar</th>
        <th className={`${cellClass} ${priceClass}`}>Session Price</th>
        <th className={cellClass}>Duration</th>
        <th className={cellClass}>Start Time</th>
        <th className={cellClass}>End Time</th>
        <th className={cellClass}>Type</th>
        <th className={`${cellClass} ${locationClass}`}>Location</th>
        <th className={cellClass}>Actions</th>
      </tr>
    </thead>
  );
};
