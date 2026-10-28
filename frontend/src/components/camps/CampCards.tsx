import { useState } from "react";
import type { Camp } from "@/api/packages";
import { BrandPill } from "@/components/brand";
import { Calendar, Clock, MapPin, Users } from "@/components/icons";
import { secondaryButton, smallButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { CampBubbles } from "./CampBubbles";
import { CampCardLink, campCardActions, campCardHover } from "./CampCardLink";
import { formatCampDates } from "@/utils/camps";
import { campEnded, campMoney, formatAges, formatDailyTime, spotsLabel, todayUtc } from "./format";
import { useCamps } from "./useCamps";

export type CampRegisterResult = { redirect: boolean; message: string | null };

const caption = "text-caption text-dark-300";
const medium = "text-label-sm text-dark";

const Fact = ({ icon: Icon, text }: { icon: typeof Calendar; text: string }) => (
  <span className="flex items-center gap-2 text-caption text-dark-300">
    <Icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
    <span>{text}</span>
  </span>
);

const CampCard = ({
  camp,
  interactive,
  first,
  paysDirect,
  onAsk,
  onRegister,
  openTo,
}: {
  camp: Camp;
  interactive: boolean;
  first: string;
  paysDirect: boolean;
  onAsk?: () => void;
  onRegister?: (camp: Camp) => Promise<CampRegisterResult>;
  /** The camp page: the whole card opens it (the coach's own profile). */
  openTo?: string | null;
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ended = campEnded(camp.endsOn, todayUtc());
  const full = camp.spotsLeft != null && camp.spotsLeft <= 0;
  const spots = spotsLabel(camp.spotsLeft);
  const dates = formatCampDates(camp.startsOn, camp.endsOn);
  const time = formatDailyTime(camp.dailyStart, camp.dailyEnd);
  const ages = formatAges(camp.ageMin, camp.ageMax);
  const namedIds = new Set(camp.coCoaches.map((coach) => coach.id));
  const extra = camp.coCoachIds.filter((id) => !namedIds.has(id)).length;

  const register = async () => {
    if (!onRegister) return;
    setBusy(true);
    setError(null);
    const result = await onRegister(camp);
    if (result.message) setError(result.message);
    if (!result.redirect) setBusy(false);
  };

  const closed = ended || full;
  const label = ended ? "Ended" : full ? "Full" : paysDirect ? `Ask ${first}` : busy ? "Opening…" : "Register";

  return (
    <article
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-card border border-light-525 bg-light px-[14px] pb-[14px] pt-4",
        openTo && cn("relative", campCardHover),
      )}
    >
      <BrandPill tone="teal" className="self-start">
        Camp
      </BrandPill>
      <div className="flex items-start justify-between gap-3">
        {openTo ? (
          <CampCardLink to={openTo} label={`Open ${camp.name}`} radius="after:rounded-card" className={medium}>
            {camp.name}
          </CampCardLink>
        ) : (
          <span className={medium}>{camp.name}</span>
        )}
        <span className="text-highlight tabular-nums text-dark">{campMoney(camp.totalPriceCents / 100)}</span>
      </div>
      {dates || time || camp.location || ages ? (
        <div className="flex flex-col gap-1.5">
          {dates ? <Fact icon={Calendar} text={dates} /> : null}
          {time ? <Fact icon={Clock} text={time} /> : null}
          {camp.location ? <Fact icon={MapPin} text={camp.location} /> : null}
          {ages ? <Fact icon={Users} text={ages} /> : null}
        </div>
      ) : null}
      {camp.description ? <p className="line-clamp-3 text-paragraph-sm text-dark-300">{camp.description}</p> : null}
      <CampBubbles coaches={camp.coCoaches} extra={extra} />
      {interactive ? (
        <div className={cn("mt-auto flex flex-wrap items-center justify-between gap-3", openTo && campCardActions)}>
          <span className={caption}>{spots ?? ""}</span>
          <button
            type="button"
            className={cn(secondaryButton, smallButton)}
            disabled={closed || busy || (paysDirect ? !onAsk : !onRegister)}
            onClick={() => {
              if (closed) return;
              if (paysDirect) onAsk?.();
              else void register();
            }}
          >
            {label}
          </button>
        </div>
      ) : spots ? (
        <span className={caption}>{spots}</span>
      ) : null}
      {error ? (
        <p role="alert" className="text-caption text-error-700">
          {error}
        </p>
      ) : null}
    </article>
  );
};

/** Family and own-profile camp cards. The Camps page has its own list (CampEditorList). */
export const CampCards = ({
  coachId,
  interactive = false,
  first = "the coach",
  paysDirect = false,
  onAsk,
  onRegister,
  openTo,
}: {
  coachId: string;
  interactive?: boolean;
  first?: string;
  paysDirect?: boolean;
  onAsk?: () => void;
  onRegister?: (camp: Camp) => Promise<CampRegisterResult>;
  /** The coach's own views: each card opens its camp page, as on Camps. */
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
  const list = camps.data ?? [];
  if (!list.length) return null;

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-label-xsm text-dark-300">Camps</span>
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {list.map((camp) => (
          <CampCard
            key={camp.id}
            camp={camp}
            interactive={interactive}
            first={first}
            paysDirect={paysDirect}
            onAsk={onAsk}
            onRegister={onRegister}
            openTo={openTo?.(camp) ?? null}
          />
        ))}
      </div>
    </div>
  );
};
