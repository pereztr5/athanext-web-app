import { Navigate } from "react-router-dom";
import { useMemo } from "react";
import { Calendar, CircleDollarSign } from "lucide-react";
import { BrandStar } from "@/components/brand";
import { useRole } from "@/hooks/useRole";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useReviews } from "@/hooks/useReviews";
import { useAuth } from "@/contexts/AuthContext";
import { ROUTES } from "@/routes";
import type { SessionUIModel } from "@/types/sessions-api";

const cardClass =
  "flex min-w-0 flex-col gap-5 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] pb-[25px] pt-[30px]";

function lastSixMonths(now = new Date()) {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleString("en-US", { month: "short" }),
      year: date.getFullYear(),
      month: date.getMonth(),
    };
  });
}

function isFinished(session: SessionUIModel) {
  return session.computedStatus === "past" || session.computedStatus === "completed";
}

function formatDollars(value: number) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

const AnalyticsPage = () => {
  const { isCoach, ready } = useRole();
  const { userProfile } = useAuth();
  const coachId = userProfile?.coach_id;
  const { stats, sessions, isLoading, error } = useDashboardData();
  const { averageRating, totalReviews, ratingDistribution } = useReviews(coachId || "");

  const months = useMemo(() => lastSixMonths(), []);

  const derived = useMemo(() => {
    const finished = sessions.filter(isFinished);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const finishedThisMonth = finished.filter((session) => {
      const end = new Date(session.end);
      return end.getFullYear() === now.getFullYear() && end.getMonth() === now.getMonth();
    });

    const priced = finishedThisMonth.filter((session) => session.rate > 0);
    const avgPrice = priced.length
      ? priced.reduce((sum, session) => sum + session.rate, 0) / priced.length
      : null;

    const monthlySessions = months.map((month) =>
      finished.filter((session) => {
        const end = new Date(session.end);
        return end.getFullYear() === month.year && end.getMonth() === month.month;
      }).length
    );

    const pillarCounts = new Map<string, number>();
    for (const session of finishedThisMonth) {
      const label = session.pillarSlot?.trim() || session.title?.trim() || "Session";
      pillarCounts.set(label, (pillarCounts.get(label) ?? 0) + 1);
    }
    const topSessions = Array.from(pillarCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const athleteSpan = new Map<string, { first: number; last: number }>();
    for (const session of finished) {
      const end = new Date(session.end).getTime();
      for (const name of session.athleteNames ?? []) {
        const trimmed = name.trim();
        if (!trimmed) continue;
        const current = athleteSpan.get(trimmed);
        if (!current) {
          athleteSpan.set(trimmed, { first: end, last: end });
        } else {
          current.first = Math.min(current.first, end);
          current.last = Math.max(current.last, end);
        }
      }
    }

    let returning = 0;
    let newcomers = 0;
    const lapseCutoff = now.getTime() - 60 * 24 * 60 * 60 * 1000;
    let lapsed = 0;
    for (const span of athleteSpan.values()) {
      const first = new Date(span.first);
      const activeThisMonth = span.last >= monthStart.getTime();
      if (activeThisMonth && first < monthStart) returning += 1;
      if (activeThisMonth && first >= monthStart.getTime()) newcomers += 1;
      if (span.last < lapseCutoff) lapsed += 1;
    }
    const activeThisMonth = returning + newcomers;
    const repeatRate = activeThisMonth > 0 ? Math.round((returning / activeThisMonth) * 100) : null;

    return { avgPrice, monthlySessions, topSessions, returning, newcomers, lapsed, repeatRate, activeThisMonth };
  }, [months, sessions]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#EAEADF] border-t-[#0054B4]" />
      </div>
    );
  }

  if (!isCoach) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  const sessionsValue = error ? "—" : isLoading ? "…" : String(stats.sessionsThisMonth);
  const avgValue = error || derived.avgPrice == null ? "—" : isLoading ? "…" : formatDollars(derived.avgPrice);
  const ratingValue = totalReviews > 0 ? averageRating.toFixed(1) : "—";
  const filledStars = totalReviews > 0 ? Math.round(averageRating) : 0;
  const maxRatingCount = Math.max(1, ...[5, 4, 3, 2, 1].map((star) => ratingDistribution[star] ?? 0));
  const maxMonthlySessions = Math.max(1, ...derived.monthlySessions);

  return (
    <div className="overflow-x-hidden px-4 pb-16 md:px-10">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
        <header className="flex flex-col gap-[10px]">
          <h1 className="text-[32px] font-bold leading-[28px] tracking-[-1.6px] text-[#1A202C]">Analytics</h1>
          <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#767980]">
            Track how your coaching business is performing.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon="dollar"
            value="—"
            label="Revenue this month"
            sub="Not connected yet"
          />
          <MetricCard icon="calendar" value={sessionsValue} label="Sessions delivered" sub="This month" />
          <MetricCard icon="dollar" value={avgValue} label="Avg session price" sub="Across all pillars" />
          <MetricCard icon="dollar" value="—" label="Pending payout" sub="Released after feedback" />
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2.08fr)_minmax(0,1fr)]">
          <section className={cardClass}>
            <div className="flex flex-col gap-5">
              <h2 className="text-[20px] font-medium leading-[18px] tracking-[-1px] text-[#1A202C]">Revenue and sessions</h2>
              <p className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">Last 6 months</p>
            </div>
            <RevenueChart months={months} sessionCounts={derived.monthlySessions} maxSessions={maxMonthlySessions} />
          </section>

          <section className={cardClass}>
            <h2 className="text-[20px] font-medium leading-[18px] tracking-[-1px] text-[#1A202C]">Athlete retention</h2>
            <p className="text-[32px] font-bold leading-[30px] tracking-[-0.96px] text-[#1A202C]">
              {isLoading ? "…" : derived.repeatRate == null ? "—" : `${derived.repeatRate}%`}
            </p>
            <p className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">Repeat booking rate</p>
            <div className="flex flex-col gap-[10px]">
              <RetentionLine label="Returning athletes" value={isLoading ? "…" : derived.activeThisMonth === 0 && derived.lapsed === 0 ? "—" : String(derived.returning)} />
              <RetentionLine label="New this month" value={isLoading ? "…" : derived.activeThisMonth === 0 && derived.lapsed === 0 ? "—" : String(derived.newcomers)} />
              <RetentionLine label="Lapsed (60+ days)" value={isLoading ? "…" : derived.activeThisMonth === 0 && derived.lapsed === 0 ? "—" : String(derived.lapsed)} />
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2.08fr)_minmax(0,1fr)]">
          <section className={cardClass}>
            <h2 className="text-[20px] font-medium leading-[18px] tracking-[-1px] text-[#1A202C]">Top performing sessions</h2>
            <p className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">By revenue, this month</p>
            {derived.topSessions.length === 0 ? (
              <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#767980]">
                {isLoading ? "Loading sessions…" : "No delivered sessions this month."}
              </p>
            ) : (
              <div className="flex flex-col gap-[14px]">
                {derived.topSessions.map((row) => (
                  <div key={row.label} className="flex items-center gap-3">
                    <span className="rounded-[4px] border border-[#CCDDF0] bg-[#E5EDF7] px-2 py-1 text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#0054B4]">
                      {row.label}
                    </span>
                    <span className="min-w-0 flex-1 text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">
                      {row.count} {row.count === 1 ? "session" : "sessions"}
                    </span>
                    <span className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#1A202C]">—</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={cardClass}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[20px] font-medium leading-[18px] tracking-[-1px] text-[#1A202C]">Ratings</h2>
              <div className="flex items-center gap-[3px]" aria-hidden>
                {[1, 2, 3, 4, 5].map((star) => (
                  <BrandStar key={star} filled={star <= filledStars} size={12} />
                ))}
              </div>
            </div>
            <p className="text-[32px] font-bold leading-[30px] tracking-[-0.96px] text-[#1A202C]">{ratingValue}</p>
            <p className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">
              {totalReviews > 0
                ? `Based on ${totalReviews} verified ${totalReviews === 1 ? "session" : "sessions"}`
                : "No verified ratings yet"}
            </p>
            <div className="flex flex-col gap-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = ratingDistribution[star] ?? 0;
                const width = totalReviews > 0 ? Math.round((count / maxRatingCount) * 100) : 0;
                return (
                  <div key={star} className="flex items-center gap-[10px]">
                    <span className="w-[38px] shrink-0 text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">
                      {star} star
                    </span>
                    <span className="h-[5px] min-w-0 flex-1 overflow-hidden rounded-[10px] bg-[#D9D9CF]">
                      <span className="block h-[5px] rounded-[10px] bg-[#0054B4]" style={{ width: `${width}%` }} />
                    </span>
                    <span className="w-6 shrink-0 text-right text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

function MetricCard({
  icon,
  value,
  label,
  sub,
}: {
  icon: "dollar" | "calendar";
  value: string;
  label: string;
  sub: string;
}) {
  const Icon = icon === "calendar" ? Calendar : CircleDollarSign;
  return (
    <section className={cardClass}>
      <span className="flex size-8 items-center justify-center rounded-[8px] bg-[#E5EDF7] text-[#0054B4]">
        <Icon className="size-4" strokeWidth={1.5} />
      </span>
      <div className="flex flex-col gap-[3px]">
        <p className="text-[32px] font-bold leading-[30px] tracking-[-0.96px] text-[#1A202C]">{value}</p>
        <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#1A202C]">{label}</p>
        <p className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">{sub}</p>
      </div>
    </section>
  );
}

function RetentionLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">{label}</span>
      <span className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#1A202C]">{value}</span>
    </div>
  );
}

function RevenueChart({
  months,
  sessionCounts,
  maxSessions,
}: {
  months: { key: string; label: string }[];
  sessionCounts: number[];
  maxSessions: number;
}) {
  return (
    <div className="flex flex-col">
      <div className="mb-3 flex gap-[18px] pl-[52px]">
        <span className="inline-flex items-center gap-[6px] text-[12px] font-medium text-[#A3A6AB]">
          <span className="size-[10px] rounded-[2px] bg-[#0054B4]" />
          Earnings
        </span>
        <span className="inline-flex items-center gap-[6px] text-[12px] font-medium text-[#A3A6AB]">
          <span className="size-[10px] rounded-[2px] bg-[#1599BC]" />
          Sessions
        </span>
      </div>
      <div className="flex">
        <div className="flex h-[170px] w-[44px] shrink-0 flex-col justify-between pr-2 text-right text-[11px] leading-none text-[#A3A6AB]">
          <span>$2400</span>
          <span>$1600</span>
          <span>$800</span>
          <span>$0</span>
        </div>
        <div className="relative h-[170px] min-w-0 flex-1">
          {[0, 1, 2, 3].map((line) => (
            <span
              key={line}
              className="absolute left-0 right-0 h-px bg-[#D9D9CF]"
              style={{ top: `${(line / 3) * 100}%` }}
            />
          ))}
          <div className="absolute inset-0 flex items-end justify-around">
            {months.map((month) => (
              <span key={month.key} className="w-[14%] max-w-[52px]" />
            ))}
          </div>
          {sessionCounts.map((count, index) => {
            const y = 170 - (count / maxSessions) * 150;
            return (
              <span
                key={months[index]?.key ?? index}
                className="absolute size-[6px] rounded-full bg-[#1599BC]"
                style={{
                  left: `${((index + 0.5) / months.length) * 100}%`,
                  top: y,
                  transform: "translate(-50%, -50%)",
                }}
              />
            );
          })}
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 170" preserveAspectRatio="none" aria-hidden>
            <polyline
              fill="none"
              stroke="#1599BC"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
              points={sessionCounts
                .map((count, index) => {
                  const x = ((index + 0.5) / months.length) * 100;
                  const y = 170 - (count / maxSessions) * 150;
                  return `${x},${y}`;
                })
                .join(" ")}
            />
          </svg>
        </div>
      </div>
      <div className="mt-[10px] flex pl-[52px]">
        <div className="flex min-w-0 flex-1 justify-around">
          {months.map((month) => (
            <span key={month.key} className="w-[14%] max-w-[52px] text-center text-[11px] text-[#A3A6AB]">
              {month.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AnalyticsPage;
