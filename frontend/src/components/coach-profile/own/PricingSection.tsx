/**
 * Sessions and pricing on the coach's own profile (Working Copy `sp2-pk` / `sp2-svc`): package
 * tiles by price with "Most booked", academy packages, the session types and the cancellation line.
 * On phones each package becomes a name and price row.
 */
import { useState } from "react";
import type { CoachPackage } from "@/hooks/useCoachPackages";
import type { ProfileService } from "@/api/coachProfile";
import { BrandPill } from "@/components/brand";
import { CampCards } from "@/components/camps/CampCards";
import { packageKind } from "@/components/camps/format";
import { CoachAcademyPackages } from "@/components/organization/CoachAcademyPackages";
import { card, textButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { ownCampPath } from "@/utils/camps";
import { caption, money, sectionTitle, sp2Card } from "./shared";

export const PricingSection = ({
  coachId,
  packages,
  services,
  mostBookedId,
  cancellation,
  onEdit,
  coachSlug,
}: {
  coachId: string;
  packages: CoachPackage[];
  /** Visible session types, base 1-on-1 row first. */
  services: ProfileService[];
  mostBookedId: string | null;
  cancellation: string;
  onEdit: () => void;
  /** Each camp opens its page, the same one a camp opens on Camps. */
  coachSlug?: string | null;
}) => {
  const [all, setAll] = useState(false);
  const sorted = packages.filter((p) => p.is_active && packageKind(p) !== "camp").sort((a, b) => a.total_price - b.total_price);
  const shown = all ? services : services.slice(0, 3);

  return (
    <section aria-label="Sessions and pricing" className={cn(card, sp2Card)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={sectionTitle}>Sessions and pricing</h2>
        <button type="button" className={textButton} onClick={onEdit}>
          Edit
        </button>
      </div>

      {sorted.length ? (
        <div className="grid grid-cols-1 gap-[10px] md:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
          {sorted.map((p) => {
            const best = p.id === mostBookedId;
            return (
              <div
                key={p.id}
                className={cn(
                  "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-card border px-[14px] pb-[14px] pt-4 md:flex md:flex-col md:items-stretch",
                  best ? "border-primary-200 bg-light-300" : "border-light-525 bg-light"
                )}
              >
                {best ? (
                  <BrandPill tone="blue" className="col-span-2 self-start justify-self-start">
                    Most booked
                  </BrandPill>
                ) : null}
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-label-sm text-dark">{p.package_name}</span>
                  <span className={caption}>
                    {money(p.total_price / 100 / Math.max(1, p.session_count))} a session · Valid {p.validity_days} days
                  </span>
                </div>
                <span className="text-highlight tabular-nums text-dark">{money(p.total_price / 100)}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      <CampCards coachId={coachId} openTo={(camp) => ownCampPath(coachSlug, camp.slug)} />

      <CoachAcademyPackages coachId={coachId} canBuy={false} />

      {services.length ? (
        <div className="flex flex-col">
          {shown.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-3 [&+&]:border-t [&+&]:border-light-525">
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-label-sm text-dark">{s.name}</span>
                <span className={caption}>
                  {s.minutes} min · {s.where}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <b className="text-subtitle text-dark">{money(s.price)}</b>
                {s.format === "group" ? <span className={caption}>per athlete</span> : null}
              </span>
            </div>
          ))}
        </div>
      ) : !sorted.length ? (
        <p className={caption}>Add your session price so families can book you.</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {services.length > 3 ? (
          <button type="button" className={cn(textButton, "text-body-m")} onClick={() => setAll((v) => !v)}>
            {all ? "Show fewer" : `Show all ${services.length} session types`}
          </button>
        ) : (
          <span />
        )}
        <span className={caption}>{cancellation}</span>
      </div>
    </section>
  );
};
