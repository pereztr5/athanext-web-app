import type { CampCoach } from "@/api/packages";
import { cn } from "@/lib/utils";
import { campInitials } from "./format";

/** Overlapping coach photos. The name is the tooltip and the accessible name. */
export const CampBubbles = ({ coaches, extra = 0 }: { coaches: CampCoach[]; extra?: number }) => {
  if (!coaches.length && extra <= 0) return null;
  const names = coaches.map((coach) => coach.name);
  const label = names.length
    ? `Also coaching: ${names.join(", ")}${extra > 0 ? `, and ${extra} more` : ""}`
    : `${extra} other ${extra === 1 ? "coach" : "coaches"}`;

  return (
    <div className="flex items-center" aria-label={label}>
      {coaches.map((coach, index) => (
        <span
          key={coach.id}
          title={coach.name}
          aria-label={coach.name}
          className={cn(
            "relative inline-flex size-7 items-center justify-center overflow-hidden rounded-full border border-light-550 bg-light-400 text-label-xsm text-dark",
            index > 0 && "-ml-2",
          )}
          style={{ zIndex: coaches.length - index }}
        >
          {coach.photoUrl ? (
            <img src={coach.photoUrl} alt="" className="size-full object-cover" />
          ) : (
            campInitials(coach.name)
          )}
        </span>
      ))}
      {extra > 0 ? (
        <span
          className="relative -ml-2 inline-flex size-7 items-center justify-center rounded-full border border-light-550 bg-light-400 text-label-xsm text-dark-300"
          aria-label={`${extra} more coaches`}
        >
          +{extra}
        </span>
      ) : null}
    </div>
  );
};
