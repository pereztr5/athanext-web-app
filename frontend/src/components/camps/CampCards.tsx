import { useState } from "react";
import type { Camp } from "@/api/packages";
import { BrandPill } from "@/components/brand";
import { primaryButton, smallButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { CampCardLink, campCardActions, campCardHover } from "./CampCardLink";
import { formatCampDates } from "@/utils/camps";
import { campEnded, campMoney, formatAges, formatDailyTime, spotsLabel, todayUtc } from "./format";
import { useCamps } from "./useCamps";

export type CampRegisterResult = { redirect: boolean; message: string | null };

/**
 * One camp, laid out like the coach's own list on Camps (cover, name, dates and price, details),
 * with a single Register for event that opens the camp page (ATH-107).
 */
const CampCard = ({
  camp,
  interactive,
  coverFallback,
  onRegister,
  openTo,
}: {
  camp: Camp;
  interactive: boolean;
  /** The coach's photo, for a camp without a cover (as the camp page does). */
  coverFallback: string | null;
  onRegister?: (camp: Camp) => Promise<CampRegisterResult>;
  /** The camp page: the whole card opens it. */
  openTo?: string | null;
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ended = campEnded(camp.endsOn, todayUtc());
  const full = camp.spotsLeft != null && camp.spotsLeft <= 0;
  const spots = spotsLabel(camp.spotsLeft);
  const dates = formatCampDates(camp.startsOn, camp.endsOn) ?? "Dates to be announced";
  const details = [formatDailyTime(camp.dailyStart, camp.dailyEnd), camp.location, formatAges(camp.ageMin, camp.ageMax)].filter(Boolean).join(" · ");
  const cover = camp.coverUrl ?? coverFallback;

  const register = async () => {
    if (!onRegister) return;
    setBusy(true);
    setError(null);
    const result = await onRegister(camp);
    if (result.message) setError(result.message);
    if (!result.redirect) setBusy(false);
  };

  const closed = ended || full;

  return (
    <article
      className={cn(
        "relative flex items-start gap-3 rounded-control border border-transparent bg-light-400 p-3 sm:items-stretch",
        openTo && campCardHover,
      )}
    >
      <div className="h-[72px] w-[88px] flex-none overflow-hidden rounded-control bg-dark sm:h-[96px] sm:w-[120px]">
        {cover ? (
          <img
            src={cover}
            alt=""
            className="size-full object-cover"
            style={camp.coverUrl ? undefined : { objectPosition: "50% 20%" }}
          />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          {openTo ? (
            <CampCardLink to={openTo} label={`Open ${camp.name}`} className="min-w-0 break-words text-label-sm text-dark">
              {camp.name}
            </CampCardLink>
          ) : (
            <span className="min-w-0 break-words text-label-sm text-dark">{camp.name}</span>
          )}
          {closed ? <BrandPill tone="muted">{ended ? "Ended" : "Full"}</BrandPill> : null}
        </div>
        <span className="text-caption text-dark-300">{[dates, campMoney(camp.totalPriceCents / 100)].join(" · ")}</span>
        {details || (spots && !closed) ? (
          <span className="text-caption font-medium text-dark">{[details, closed ? null : spots].filter(Boolean).join(" · ")}</span>
        ) : null}
        {interactive && !closed ? (
          <div className={cn("mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 self-start pt-1", campCardActions)}>
            <button type="button" className={cn(primaryButton, smallButton)} disabled={busy || !onRegister} onClick={() => void register()}>
              {busy ? "Opening…" : "Register for event"}
            </button>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className={cn("text-caption text-error-700", campCardActions)}>
            {error}
          </p>
        ) : null}
      </div>
    </article>
  );
};

/** Family and own-profile camp cards. The Camps page has its own list (CampEditorList). */
export const CampCards = ({
  coachId,
  interactive = false,
  coverFallback = null,
  onRegister,
  openTo,
}: {
  coachId: string;
  interactive?: boolean;
  coverFallback?: string | null;
  onRegister?: (camp: Camp) => Promise<CampRegisterResult>;
  /** Each card opens its camp page (the coach's own views get the Edit bar there). */
  openTo?: (camp: Camp) => string | null;
}) => {
  const camps = useCamps(coachId);
  if (camps.isLoading) return null;
  if (camps.isError) {
    return (
      <p role="alert" className="text-caption text-error-700">
        Camps could not be loaded.
      </p>
    );
  }
  // Ended camps stay on Camps for the coach; families can't sign up, so the profile leaves them out.
  const today = todayUtc();
  const list = (camps.data ?? []).filter((camp) => !campEnded(camp.endsOn, today));
  if (!list.length) return null;

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-label-xsm text-dark-300">Camps</span>
      <div className="flex flex-col gap-2.5">
        {list.map((camp) => (
          <CampCard
            key={camp.id}
            camp={camp}
            interactive={interactive}
            coverFallback={coverFallback}
            onRegister={onRegister}
            openTo={openTo?.(camp) ?? null}
          />
        ))}
      </div>
    </div>
  );
};
