/**
 * ManageAvailabilityTableHeader Component
 * Header for the add/edit availability slot editor.
 */

export const ManageAvailabilityTableHeader = () => {
  const cell = "px-0 py-3 text-left text-[12px] font-medium leading-[13px] tracking-[-0.03em] text-[#767980]";
  return (
    <thead>
      <tr className="border-b border-[#EAEADF]">
        <th className={cell}>Day</th>
        <th className={cell}>Session</th>
        <th className={cell}>Pillar</th>
        <th className={cell}>Price</th>
        <th className={cell}>Duration</th>
        <th className={cell}>Time</th>
        <th className={cell}>Type</th>
        <th className={cell}>Location</th>
        <th className={cell}>
          <span className="sr-only">Actions</span>
        </th>
      </tr>
    </thead>
  );
};
