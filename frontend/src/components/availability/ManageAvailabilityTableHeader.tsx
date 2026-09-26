/**
 * ManageAvailabilityTableHeader Component
 * Header for the add/edit availability slot editor.
 */

export const ManageAvailabilityTableHeader = () => {
  const cell = "px-0 py-3 text-left text-[12px] font-medium leading-[13px] tracking-[-0.36px] text-[#767980]";
  return (
    <thead>
      <tr className="border-b border-[#EAEADF]">
        <th className={cell}>Day</th>
        <th className={cell}>Session name</th>
        <th className={cell}>Pillar</th>
        <th className={cell}>Price</th>
        <th className={cell}>Duration</th>
        <th className={cell}>Start time</th>
        <th className={cell}>End time</th>
        <th className={cell}>Type</th>
        <th className={cell}>Location</th>
        <th className={cell}>Actions</th>
      </tr>
    </thead>
  );
};
