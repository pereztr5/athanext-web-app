import { BrandStar } from "@/components/brand";
import { formatWholePrice } from "@/utils/sessionFormatting";
import { coachPublicLinkLabel } from "@/utils/coachSlug";
import { cn } from "@/lib/utils";

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
        "relative box-border flex h-[1350px] w-[1080px] flex-col overflow-hidden bg-[#1a202c] font-sans text-[#f5f6f8]",
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
              <div className="flex size-[132px] items-center justify-center rounded-[24px] bg-[#222b3c] text-[40px] font-semibold">
                {coach.name.slice(0, 1)}
              </div>
            )}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <div className="text-[40px] font-semibold leading-none tracking-[-0.045em]">
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
              <div className="flex items-center gap-3 text-[19px] tracking-[-0.03em] text-[#c9ced8]">
                <span>{coach.sport}</span>
                <span className="size-[5px] rounded-full bg-[#c9ced8]" />
                <span>{coach.position}</span>
              </div>
              {showRating ? (
                <div className="flex items-center gap-2 text-[17px] tracking-[-0.02em] text-[#c9ced8]">
                  <BrandStar size={16} />
                  <span className="font-medium text-[#f5f6f8]">{coach.rating}</span>
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
                  className="flex h-[38px] items-center whitespace-nowrap rounded-full border border-[#2d3649] bg-[#222b3c] px-[18px] text-[15px] tracking-[-0.02em]"
                >
                  {specialty}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {showSessions && sessions.length > 0 ? (
          <div className="flex flex-col">
            <div className="mb-[34px] mt-[72px] text-[24px] font-semibold tracking-[-0.02em] text-[#8e97a9]">
              Sessions
            </div>
            {sessions.map((row, index) => (
              <div
                key={`${row.title}-${index}`}
                className="flex items-end justify-between border-b border-[#2a3142] pb-5"
                style={{
                  paddingTop: index === 0 ? 0 : 22,
                  borderBottomColor: index === sessions.length - 1 ? "transparent" : "#2a3142",
                }}
              >
                <div className="flex flex-col gap-1.5">
                  <div className="text-[24px] font-medium tracking-[-0.05em]">{row.title}</div>
                  <div className="text-[24px] tracking-[-0.05em] text-[#8e97a9]">{row.meta}</div>
                </div>
                <div className="text-[32px] font-medium tracking-[-0.06em]">{row.price}</div>
              </div>
            ))}
          </div>
        ) : null}

        {showPackages && visiblePackages.length > 0 ? (
          <div className="flex flex-col">
            <div className="mb-[34px] mt-16 text-[24px] font-semibold tracking-[-0.02em] text-[#8e97a9]">
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
                      <span className="absolute right-[18px] top-[18px] rounded-full border border-[#2462b3] bg-[#084184] px-3 py-0.5 text-[11px] font-medium">
                        {pkg.badge}
                      </span>
                    ) : null}
                    <div className="text-[29px] font-medium tracking-[-0.04em]">{pkg.name}</div>
                    <div
                      className="mt-3 h-[72px] text-[17px] leading-[1.18] tracking-[-0.04em]"
                      style={{ color: featured ? "#9aa6ba" : "#8e97a9" }}
                    >
                      {pkg.desc}
                    </div>
                    <div
                      className="mt-[26px] h-px"
                      style={{ background: featured ? "#24466f" : "#353e52" }}
                    />
                    <div className="flex items-baseline gap-3.5 py-7">
                      <span className="text-[38px] font-medium tracking-[-0.07em]">{pkg.price}</span>
                      {pkg.save ? (
                        <span className="text-[15px] font-medium tracking-[-0.02em] text-[#9fc2ff]">
                          {pkg.save}
                        </span>
                      ) : null}
                    </div>
                    <div
                      className="h-px"
                      style={{ background: featured ? "#24466f" : "#353e52" }}
                    />
                    <div
                      className="mt-auto text-[17px] leading-[1.5] tracking-[-0.04em]"
                      style={{ color: featured ? "#9aa6ba" : "#8e97a9" }}
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

        <div className="mt-auto flex flex-col items-center gap-1.5 pb-7 text-[#8e97a9]">
          <div className="flex items-center gap-1.5">
            <svg width="22" height="18" viewBox="0 0 22 18" aria-hidden="true">
              <path
                d="M1 12.5L20.5 1.5 14 17 11 11.5z M11 11.5L20.5 1.5"
                fill="none"
                stroke="#8e97a9"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-[17px] font-medium tracking-[-0.04em]">AthaNext</span>
          </div>
          <span className="text-[14px] tracking-[-0.01em] text-[#6f7788]">
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
