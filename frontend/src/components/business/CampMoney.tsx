/**
 * My Business "Camps": registrations this month, money paid by card in the app, money paid to the
 * coach directly (marked paid), and held spots still to collect. From camp_registrations only;
 * camp days on the schedule carry no session money, so nothing here is counted twice.
 */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "@/components/icons";
import { campsAPI } from "@/api/camps";
import { card, meta } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { campMoneySummary } from "@/utils/campSessions";
import { money } from "@/utils/payments";
import { plural } from "@/utils/schedule";

const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="flex flex-col gap-1 rounded-control border border-light-525 bg-light-400 px-3 py-2.5">
    <span className={meta}>{label}</span>
    <b className="text-highlight tabular-nums">{value}</b>
    {sub ? <span className={meta}>{sub}</span> : null}
  </div>
);

export const CampMoney = ({ coachId }: { coachId: string }) => {
  const rows = useQuery({ queryKey: ["coach-camp-money", coachId], queryFn: () => campsAPI.moneyRows(coachId) });
  const data = rows.data ? campMoneySummary(rows.data) : null;

  // Coaches without camp sign-ups don't get an empty card.
  if (rows.isSuccess && !rows.data.length) return null;

  return (
    <section className={cn(card, "gap-4")} aria-label="Camps">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-card-title text-dark">
          <CalendarDays className="size-5 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
          Camps
        </h2>
        <Link to={ROUTES.PROFILE} className={cn(meta, "hover:underline")}>
          {data ? `${plural(data.registrationsThisMonth, "registration")} this month` : "Registrations"}
        </Link>
      </div>
      {rows.isError ? (
        <p className="text-body-m text-error-700">Couldn't load camp payments. Try again in a moment.</p>
      ) : !data ? (
        <div className="h-24 animate-pulse rounded-control bg-light-400" />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Paid in app" value={money(data.paidInApp)} />
          <Stat label="Paid to you directly" value={money(data.paidDirect)} />
          <Stat
            label="Still to collect"
            value={money(data.toCollect)}
            sub={data.toCollectCount ? plural(data.toCollectCount, "family", "families") : undefined}
          />
        </div>
      )}
    </section>
  );
};
