import { BrandStar } from "@/components/brand";
import { formatWholePrice } from "@/utils/sessionFormatting";
import { coachPublicLinkLabel } from "@/utils/coachSlug";
import { cn } from "@/lib/utils";
import logoMarkWhite from "@/assets/logo-mark-white.svg";

/*
 * The share image is a fixed 1080px Instagram canvas exported with html2canvas, not app UI,
 * so its type is sized for that canvas instead of the app type ramp, and its dark panels use
 * export-only colours that have no light-theme token.
 */
const SURFACE = "#222b3c";
const SURFACE_LINE = "#2d3649";
const ROW_LINE = "#2a3142";
const BADGE = "#084184";
const BADGE_LINE = "#2462b3";
const exportType = (size: number, weight: number, tracking = "-0.05em", lineHeight?: number): React.CSSProperties => ({
  fontSize: size,
  fontWeight: weight,
  letterSpacing: tracking,
  ...(lineHeight ? { lineHeight } : {}),
});

export interface PricingShareSession {
  title: string;
  meta: string;
  price: string;
}

export interface PricingSharePackage {
  name: string;
  desc: string;
  price: string;
  save?: string;
  count: string;
  cadence: string;
  badge?: string;
}

export interface PricingShareCoach {
  name: string;
  sport: string;
  position: string;
  photo?: string | null;
  rating: string;
  reviews: number;
  slug: string;
  specialties: string[];
  verified?: boolean;
}

interface PricingShareCardProps {
  coach: PricingShareCoach;
  sessions: PricingShareSession[];
  packages: PricingSharePackage[];
  showSessions: boolean;
  showPackages: boolean;
  showSpecialties: boolean;
  showRating: boolean;
  accent?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function PricingShareCard({
  coach,
  sessions,
  packages,
  showSessions,
  showPackages,
  showSpecialties,
  showRating,
  accent = "#0052b5",
  className,
  style,
}: PricingShareCardProps) {
  const visiblePackages = packages.slice(0, 3);

  return (
    <div
      className={cn(
        "relative box-border flex h-[1350px] w-[1080px] flex-col overflow-hidden bg-dark font-sans text-light-400",
        className
      )}
      style={style}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-[-260px] h-[560px] w-[760px] -translate-x-1/2 rounded-full"
        style={{
          background: `radial-gradient(closest-side, ${accent} 0%, rgba(3, 82, 174, 0.55) 35%, rgba(26, 32, 44, 0) 100%)`,
        }}
      />
      <div className="relative flex h-full flex-col px-[50px] pb-0 pt-[80px]">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-7">
            {coach.photo ? (
              <img
                src={coach.photo}
                alt={coach.name}
                className="block size-[132px] rounded-[24px] object-cover object-top"
              />
            ) : (
              <div className="flex size-[132px] items-center justify-center rounded-[24px]"
                style={{ ...exportType(40, 600), background: SURFACE }}>
                {coach.name.slice(0, 1)}
              </div>
            )}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <div style={exportType(40, 600, "-0.045em", 1)}>
                  {coach.name}
                </div>
                {coach.verified ? (
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-label="Verified" role="img" className="mt-1.5">
                    <circle cx="10" cy="10" r="10" fill={accent} />
                    <path
                      d="M6 10.2l2.7 2.6L14 7.6"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </div>
              <div className="flex items-center gap-3 text-light-600" style={exportType(19, 400, "-0.03em")}>
                <span>{coach.sport}</span>
                <span className="size-[5px] rounded-full bg-light-600" />
                <span>{coach.position}</span>
              </div>
              {showRating ? (
                <div className="flex items-center gap-2 text-light-600" style={exportType(17, 400, "-0.02em")}>
                  <BrandStar size={16} />
                  <span className="font-medium text-light-400">{coach.rating}</span>
                  <span>· {coach.reviews} reviews</span>
                </div>
              ) : null}
            </div>
          </div>
          {showSpecialties && coach.specialties.length > 0 ? (
            <div className="flex flex-col items-end gap-3">
              {coach.specialties.slice(0, 3).map((specialty) => (
                <span
                  key={specialty}
                  className="flex h-[38px] items-center whitespace-nowrap rounded-full border px-[18px]"
                  style={{ ...exportType(15, 400, "-0.02em"), background: SURFACE, borderColor: SURFACE_LINE }}
                >
                  {specialty}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {showSessions && sessions.length > 0 ? (
          <div className="flex flex-col">
            <div className="mb-[34px] mt-[72px] text-section text-dark-250">
              Sessions
            </div>
            {sessions.map((row, index) => (
              <div
                key={`${row.title}-${index}`}
                className="flex items-end justify-between border-b pb-5"
                style={{
                  paddingTop: index === 0 ? 0 : 22,
                  borderBottomColor: index === sessions.length - 1 ? "transparent" : ROW_LINE,
                }}
              >
                <div className="flex flex-col gap-1.5">
                  <div style={exportType(24, 500)}>{row.title}</div>
                  <div className="text-dark-250" style={exportType(24, 400)}>{row.meta}</div>
                </div>
                <div style={exportType(32, 500, "-0.06em")}>{row.price}</div>
              </div>
            ))}
          </div>
        ) : null}

        {showPackages && visiblePackages.length > 0 ? (
          <div className="flex flex-col">
            <div className="mb-[34px] mt-16 text-section text-dark-250">
              Packages
            </div>
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: `repeat(${Math.max(visiblePackages.length, 1)}, minmax(0, 1fr))` }}
            >
              {visiblePackages.map((pkg) => {
                const featured = Boolean(pkg.badge);
                return (
                  <div
                    key={pkg.name}
                    className="relative flex h-[385px] flex-col rounded-[20px] border px-7 pb-[30px] pt-[34px]"
                    style={{
                      background: featured ? "#123056" : "#242b3d",
                      borderColor: featured ? "#1d4677" : "#2d3649",
                    }}
                  >
                    {featured ? (
                      <span className="absolute right-[18px] top-[18px] rounded-full border px-3 py-0.5"
                        style={{ ...exportType(11, 500, "normal"), background: BADGE, borderColor: BADGE_LINE }}>
                        {pkg.badge}
                      </span>
                    ) : null}
                    <div style={exportType(29, 500, "-0.04em")}>{pkg.name}</div>
                    <div
                      className="mt-3 h-[72px]"
                      style={{ ...exportType(17, 400, "-0.04em", 1.18), color: featured ? "#9aa6ba" : "#8e97a9" }}
                    >
                      {pkg.desc}
                    </div>
                    <div
                      className="mt-[26px] h-px"
                      style={{ background: featured ? "#24466f" : "#353e52" }}
                    />
                    <div className="flex items-baseline gap-3.5 py-7">
                      <span style={exportType(38, 500, "-0.07em")}>{pkg.price}</span>
                      {pkg.save ? (
                        <span className="text-primary-200" style={exportType(15, 500, "-0.02em")}>
                          {pkg.save}
                        </span>
                      ) : null}
                    </div>
                    <div
                      className="h-px"
                      style={{ background: featured ? "#24466f" : "#353e52" }}
                    />
                    <div
                      className="mt-auto"
                      style={{ ...exportType(17, 400, "-0.04em", 1.5), color: featured ? "#9aa6ba" : "#8e97a9" }}
                    >
                      {pkg.count}
                      <br />
                      {pkg.cadence}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-auto flex flex-col items-center gap-1.5 pb-7 text-dark-250">
          <div className="flex items-center gap-1.5">
            <img
              src={logoMarkWhite}
              alt=""
              width={22}
              height={22}
              className="block size-[22px] object-contain"
              aria-hidden="true"
            />
            <span style={exportType(17, 500, "-0.04em")}>AthaNext</span>
          </div>
          <span className="text-body-m text-dark-300">
            Book at {coachPublicLinkLabel(coach.slug)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function buildPricingSharePackages(
  packages: {
    package_name: string;
    description: string | null;
    session_count: number;
    total_price: number;
    price_per_session: number;
    display_order?: number;
  }[]
): PricingSharePackage[] {
  const ordered = [...packages].sort(
    (a, b) => (a.display_order ?? 99) - (b.display_order ?? 99)
  );
  const bestIndex =
    ordered.length > 1
      ? ordered.reduce(
          (best, pkg, index, list) =>
            pkg.session_count > list[best].session_count ? index : best,
          0
        )
      : -1;

  return ordered.slice(0, 3).map((pkg, index) => {
    const listCents =
      pkg.price_per_session > 0 && pkg.session_count > 0
        ? pkg.price_per_session * pkg.session_count
        : 0;
    const saveCents = listCents > pkg.total_price ? listCents - pkg.total_price : 0;
    return {
      name: pkg.package_name,
      desc: pkg.description || `${pkg.session_count} sessions`,
      price: formatWholePrice(pkg.total_price / 100),
      save: saveCents > 0 ? `Save ${formatWholePrice(saveCents / 100)}` : undefined,
      count: `${pkg.session_count} sessions`,
      cadence: `Booked across ${pkg.session_count} days`,
      badge: index === bestIndex ? "Best value" : undefined,
    };
  });
}
