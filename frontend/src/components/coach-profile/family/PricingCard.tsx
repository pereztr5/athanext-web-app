import { useState } from "react";
import type { Camp } from "@/api/packages";
import { BrandPill } from "@/components/brand";
import { CampCards, type CampRegisterResult } from "@/components/camps/CampCards";
import { packageKind } from "@/components/camps/format";
import { useCamps } from "@/components/camps/useCamps";
import { CoachAcademyPackages } from "@/components/organization/CoachAcademyPackages";
import { secondaryButton, smallButton, textButton } from "@/components/schedule/styles";
import type { CoachPackage } from "@/hooks/useCoachPackages";
import { cn } from "@/lib/utils";
import { CoachProfileCard } from "../CoachProfileCard";
import { caption, cardGap, medium, money, sectionTitle } from "./styles";

export interface SessionRow {
  key: string;
  name: string;
  detail: string;
  price: number;
  /** "per athlete" for group sessions. */
  unit?: string;
}

const SHOWN_SESSIONS = 3;

/**
 * Sessions and pricing (Working Copy `.sp2-pk`, `.sp2-svc`): package cards with Buy, academy
 * packages, the session types, and the cancellation line at the bottom. Booking happens from
 * the header, so there is no Book here.
 */
export const PricingCard = ({
  coachId,
  first,
  packages,
  sessions,
  cancellation,
  paysDirect,
  buying,
  onBuy,
  onAsk,
  onRegister,
  openCamp,
  mostBookedId,
}: {
  coachId: string;
  mostBookedId?: string | null;
  first: string;
  packages: CoachPackage[];
  sessions: SessionRow[];
  cancellation: string;
  /** Booking only coaches take payment themselves: Buy becomes a message. */
  paysDirect: boolean;
  buying: string | null;
  onBuy: (pkg: CoachPackage) => void;
  onAsk?: () => void;
  onRegister: (camp: Camp) => Promise<CampRegisterResult>;
  /** The coach looking at his own public profile: a camp card opens its page, as on Camps. */
  openCamp?: (camp: Camp) => string | null;
}) => {
  const [allSessions, setAllSessions] = useState(false);
  const camps = useCamps(coachId);
  const sorted = packages.filter((pkg) => packageKind(pkg) !== "camp").sort((a, b) => a.total_price - b.total_price);
  const campList = camps.data ?? [];
  if (camps.isLoading && !sorted.length && !sessions.length) return null;
  if (!camps.isLoading && !camps.isError && !sorted.length && !sessions.length && !campList.length) return null;
  const shownSessions = allSessions ? sessions : sessions.slice(0, SHOWN_SESSIONS);

  return (
    <CoachProfileCard className={cardGap} aria-label="Sessions and pricing">
      <h2 className={sectionTitle}>Sessions and pricing</h2>

      {sorted.length ? (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
          {sorted.map((pkg) => {
            const per = pkg.price_per_session ? pkg.price_per_session / 100 : pkg.session_count ? pkg.total_price / 100 / pkg.session_count : 0;
            const best = pkg.id === mostBookedId;
            return (
              <div
                key={pkg.id}
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
                  <span className={medium}>{pkg.package_name}</span>
                  <span className={caption}>
                    {[per ? `${money(per)} a session` : "", pkg.validity_days ? `Valid ${pkg.validity_days} days` : ""].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <span className="text-highlight text-dark tabular-nums">{money(pkg.total_price / 100)}</span>
                <button
                  type="button"
                  onClick={() => (paysDirect ? onAsk?.() : onBuy(pkg))}
                  disabled={paysDirect ? !onAsk : buying !== null}
                  className={cn(secondaryButton, smallButton, "col-span-2 self-start justify-self-start md:self-start")}
                >
                  {paysDirect ? `Ask ${first}` : buying === pkg.id ? "Opening…" : "Buy"}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      <CampCards
        coachId={coachId}
        interactive
        first={first}
        paysDirect={paysDirect}
        onAsk={onAsk}
        onRegister={onRegister}
        openTo={openCamp}
      />

      <CoachAcademyPackages coachId={coachId} canBuy={!paysDirect} />

      {paysDirect && sorted.length ? (
        <p className={caption}>{first} takes payment directly, so packages are arranged with them.</p>
      ) : null}

      {shownSessions.length ? (
        <div className="flex flex-col divide-y divide-light-525">
          {shownSessions.map((row) => (
            <div key={row.key} className="flex items-center gap-3 py-3">
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className={medium}>{row.name}</span>
                <span className={caption}>{row.detail}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <b className="text-subtitle text-dark">{money(row.price)}</b>
                {row.unit ? <span className={caption}>{row.unit}</span> : null}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {sessions.length > SHOWN_SESSIONS ? (
          <button type="button" className={cn(textButton, "text-body-m")} onClick={() => setAllSessions((v) => !v)}>
            {allSessions ? "Show fewer" : `Show all ${sessions.length} session types`}
          </button>
        ) : (
          <span />
        )}
        <span className={caption}>{cancellation}</span>
      </div>
    </CoachProfileCard>
  );
};
