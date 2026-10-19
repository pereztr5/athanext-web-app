/**
 * ManageAvailabilityTableHeader Component
 * Header for the add/edit availability slot editor.
 */

export const ManageAvailabilityTableHeader = () => {
  const cell = "px-0 py-3 text-left text-label-xsm text-dark-300";
  return (
    <thead>
      <tr className="border-b border-light-525">
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
