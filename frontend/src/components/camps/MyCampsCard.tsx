/**
 * Family portal (mockup screen 6): camps the family signed up for, on Home and My sessions,
 * with dates, each athlete's group time, the location and what to bring.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MapPin } from "@/components/icons";
import { campsAPI, type MyCamp } from "@/api/camps";
import { BrandPill } from "@/components/brand";
import { card, label, meta } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { campPath, formatCampDates, formatCampDay, formatCampTimes, localIsoDay } from "@/utils/camps";

const dayBox = (iso: string | null) => {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return {
    weekday: date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    day: String(d),
  };
};

const useMyCamps = (enabled = true) =>
  useQuery({ queryKey: ["my-camps"], enabled, staleTime: 60_000, queryFn: () => campsAPI.myCamps() });

const CampItem = ({ camp }: { camp: MyCamp }) => {
  const box = dayBox(camp.starts_on);
  const coachFirst = camp.coach.name.split(/\s+/)[0] || camp.coach.name;
  const included = camp.included.filter(Boolean);
  const page = camp.coach.slug && camp.slug ? campPath(camp.coach.slug, camp.slug) : null;
  return (
    <li className="flex flex-col gap-3 border-t border-light-525 pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-3">
        {box ? (
          <span className="flex size-11 flex-none flex-col items-center justify-center rounded-control bg-light-400">
            <small className="text-label-xsm text-dark-300">{box.weekday}</small>
            <b className="text-subtitle">{box.day}</b>
          </span>
        ) : null}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          {page ? (
            <Link to={page} className="break-words text-label-sm text-dark hover:text-primary">
              {camp.name} with {coachFirst}
            </Link>
          ) : (
            <b className="break-words text-label-sm">
              {camp.name} with {coachFirst}
            </b>
          )}
          <span className={meta}>{formatCampDates(camp.starts_on, camp.ends_on)}</span>
          {camp.location ? (
            <span className={cn(meta, "flex items-center gap-1")}>
              <MapPin className="size-3 flex-none" strokeWidth={2} aria-hidden="true" />
              <span className="min-w-0 break-words">{camp.location}</span>
            </span>
          ) : null}
        </span>
        <BrandPill tone="teal" className="flex-none">
          Camp
        </BrandPill>
      </div>
      <ul className="flex flex-col gap-1.5">
        {camp.athletes.map((a) => (
          <li key={a.registration_id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-m">
            <b className="font-medium">{a.first_name}</b>
            <span className="text-dark-300">
              {[a.group_name, formatCampTimes(a.start_time, a.end_time)].filter(Boolean).join(" · ")}
            </span>
            {a.status === "held" ? (
              <BrandPill tone="amber">{camp.starts_on ? `Pay ${coachFirst} before ${formatCampDay(camp.starts_on)}` : `Pay ${coachFirst}`}</BrandPill>
            ) : a.status === "pending_payment" ? (
              <BrandPill tone="muted">Payment going through</BrandPill>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-1 rounded-control bg-light-400 px-3 py-2.5">
        <span className={label}>What to bring</span>
        <span className="text-body-m text-dark">Your gear and water.{included.length ? ` Included: ${included.join(", ")}.` : ""}</span>
      </div>
    </li>
  );
};

/** Nothing when the family has no camp coming up. */
export const MyCampsCard = ({ className }: { className?: string }) => {
  const camps = useMyCamps();
  const today = localIsoDay();
  const upcoming = (camps.data ?? []).filter((c) => !c.ends_on || c.ends_on.slice(0, 10) >= today);
  if (camps.isError) {
    return (
      <p role="alert" className={cn(meta, "text-error-700", className)}>
        Your camps couldn&apos;t be loaded. Refresh to try again.
      </p>
    );
  }
  if (!upcoming.length) return null;
  return (
    <section className={cn(card, className)} aria-label="Camps coming up">
      <span className="text-card-title text-dark">Coming up</span>
      <ul className="flex flex-col gap-3">
        {upcoming.map((camp) => (
          <CampItem key={camp.camp_id} camp={camp} />
        ))}
      </ul>
    </section>
  );
};
