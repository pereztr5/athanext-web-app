/**
 * Camps row on My profile's "Sessions, packages and camps" card: each camp with its status,
 * spots, Edit, Registrations and the share link, then Add camp. Camps never touch credits.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Eye, Link as LinkIcon, Plus } from "@/components/icons";
import { campsAPI, type CoachCamp } from "@/api/camps";
import { BrandPill } from "@/components/brand";
import { label, meta, secondaryButton, smallButton, textButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { campPath, campShareUrl, formatCampDates, formatCampMoney, localIsoDay, plural } from "@/utils/camps";

const useCoachCampList = (enabled = true, coachId?: string | null) =>
  useQuery({
    queryKey: ["coach-camp-list", coachId ?? "self"],
    enabled,
    queryFn: () => campsAPI.list(coachId ?? undefined),
  });

const campStatus = (camp: CoachCamp, today: string): { text: string; tone: "green" | "neutral" | "muted" } => {
  if (camp.ends_on && camp.ends_on.slice(0, 10) < today) return { text: "Ended", tone: "muted" };
  if (camp.published) return { text: "Live", tone: "green" };
  return { text: "Draft", tone: "neutral" };
};

export const CampEditorList = ({
  coverFallback,
  onEdit,
  onRegistrations,
  coachId,
  enabled = true,
}: {
  /** The coach's photo: a camp without a cover shows it, like the camp page does. */
  coverFallback: string | null;
  /** Null adds a camp. */
  onEdit: (campId: string | null) => void;
  onRegistrations: (campId: string) => void;
  /** Admin editing another coach: list that coach's camps. */
  coachId?: string | null;
  enabled?: boolean;
}) => {
  const { toast } = useToast();
  const camps = useCoachCampList(enabled, coachId);
  const today = localIsoDay();

  const copy = (camp: CoachCamp) => {
    if (!camp.coach_slug || !camp.slug) return;
    const url = campShareUrl(window.location.origin, camp.coach_slug, camp.slug);
    void navigator.clipboard
      .writeText(url)
      .then(() =>
        toast({
          title: "Camp link copied",
          description: "No account needed to sign up. Families who sign up become your clients.",
        }),
      )
      .catch(() => toast({ title: "Couldn't copy", description: url }));
  };

  const list = camps.data ?? [];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <span className={label}>Camps</span>
        <span className={meta}>One-time fee per athlete. No credits.</span>
      </div>
      {camps.isLoading ? <span className={meta}>Loading camps…</span> : null}
      {camps.isError ? (
        <p role="alert" className="text-caption text-error-700">
          {camps.error instanceof Error ? camps.error.message : "Camps could not be loaded."}
        </p>
      ) : null}
      {list.map((camp) => {
        const status = campStatus(camp, today);
        const spots = camp.groups.reduce((n, g) => n + g.spots, 0) || camp.capacity || 0;
        const cover = camp.cover_url ?? coverFallback;
        const isUploadedCover = Boolean(camp.cover_url);
        const shareable = camp.published && camp.coach_slug && camp.slug && status.text !== "Ended";
        // Same tab: the camp page shows the coach an Edit bar on top (drafts too).
        const familyHref = camp.coach_slug && camp.slug ? campPath(camp.coach_slug, camp.slug) : null;
        const registeredLine = [
          `${camp.taken} registered`,
          spots ? `of ${spots} spots` : null,
          camp.waiting_count ? `${camp.waiting_count} waiting` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <div key={camp.id} className="flex items-start gap-3 rounded-control bg-light-400 p-3 sm:items-stretch">
            <div className="h-[72px] w-[88px] flex-none overflow-hidden rounded-control bg-dark sm:h-[96px] sm:w-[120px]">
              {cover ? (
                <img
                  src={cover}
                  alt=""
                  className="size-full object-cover"
                  style={isUploadedCover ? undefined : { objectPosition: "50% 20%" }}
                />
              ) : null}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 break-words text-label-sm text-dark">{camp.name}</span>
                <BrandPill tone={status.tone} className="flex-none">
                  {status.text}
                </BrandPill>
              </div>
              <span className="text-caption text-dark-300">
                {[formatCampDates(camp.starts_on, camp.ends_on) ?? "Dates not set", formatCampMoney(camp.price_cents)].join(" · ")}
              </span>
              <span className="text-caption font-medium text-dark">
                {registeredLine}
                {camp.groups.length > 1 ? ` · ${plural(camp.groups.length, "group")}` : ""}
              </span>
              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
                {familyHref ? (
                  <Link to={familyHref} className={cn(secondaryButton, smallButton)}>
                    <Eye strokeWidth={1.5} aria-hidden="true" />
                    View as family
                  </Link>
                ) : null}
                <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => onEdit(camp.id)}>
                  Edit
                </button>
                <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => onRegistrations(camp.id)}>
                  Registrations
                </button>
                {shareable ? (
                  <button type="button" className={textButton} onClick={() => copy(camp)}>
                    <LinkIcon strokeWidth={1.5} aria-hidden="true" />
                    Copy link
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
      {!coachId ? (
        <button
          type="button"
          className="flex min-h-[56px] items-center justify-center gap-2 rounded-control border border-dashed border-light-600 bg-light-400 text-label-sm text-primary hover:border-primary-300"
          onClick={() => onEdit(null)}
        >
          <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
          Add camp
        </button>
      ) : null}
    </div>
  );
};
