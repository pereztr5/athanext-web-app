/**
 * Coach Home "Coming up" camps: every published camp that hasn't ended, soonest first, with
 * sign-ups, money still to collect, and links to Registrations and its next day on the schedule.
 * Always shows a Camps entry so coaches can reach the editor from Home (phone has no Profile tab).
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronRight } from "@/components/icons";
import { campsAPI } from "@/api/camps";
import { card, label, meta, secondaryButton, smallButton, textButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { formatCampDates } from "@/utils/camps";
import { comingUpCamps } from "@/utils/coachHomeCamps";

export const ComingUpCamps = () => {
  // Same key as the camp list on My profile, so camp edits and registration changes refresh it.
  const camps = useQuery({ queryKey: ["coach-camp-list"], queryFn: () => campsAPI.list(), retry: false });
  const list = camps.data ? comingUpCamps(camps.data) : [];

  return (
    <section className={card} aria-label="Coming up camps">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className={label}>Camps</span>
          <h2 className="text-card-title text-dark">
            {camps.isLoading
              ? "Coming up"
              : list.length === 0
                ? "No camps coming up"
                : list.length === 1
                  ? "1 camp"
                  : `${list.length} camps`}
          </h2>
        </div>
        <Link to={ROUTES.PROFILE} className={textButton}>
          {list.length ? "All camps" : "Manage camps"}
          <ChevronRight strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </div>
      {camps.isError ? (
        <p className="text-body-m text-error-700">Couldn't load camps. Open My profile to manage them.</p>
      ) : null}
      {!camps.isLoading && !camps.isError && list.length === 0 ? (
        <p className={meta}>
          Create a camp on My profile. Families sign up from a link with no account needed.
        </p>
      ) : null}
      {list.length ? (
        <div className="flex flex-col">
          {list.map(({ camp, nextDay, signUps, toCollect }) => (
            <div key={camp.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-light-525 py-3 last:pb-0">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="break-words text-subtitle text-dark">{camp.name}</span>
                <span className={meta}>{formatCampDates(camp.starts_on, camp.ends_on)}</span>
                <span className={meta}>
                  {signUps}
                  {toCollect ? <b className="font-medium text-dark"> · {toCollect}</b> : null}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Link to={`${ROUTES.PROFILE}?camp=${camp.id}&view=registrations`} className={cn(secondaryButton, smallButton)}>
                  Registrations
                </Link>
                <Link to={`${ROUTES.SCHEDULE}?day=${nextDay}`} className={textButton}>
                  On schedule
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
};
