/**
 * Add camp / Edit camp (coach mockup "2 · Add camp" and Michael's "Camps in Create session").
 * Desktop: one sheet, the form next to a live family preview. Phone: one question per screen
 * (name, dates, where, groups, price, optional details, review) under a five-part progress bar.
 * Opened from My profile (Add camp / Edit), My schedule → Create session → Camp, and Home.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Pencil } from "@/components/icons";
import { campsAPI, CampError, type CoachCamp } from "@/api/camps";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { closeButtonOverride, label, meta, modalSurface, primaryButton, secondaryButton, textButton } from "@/components/schedule/styles";
import { useAuth } from "@/contexts/AuthContext";
import { useCoachDetails } from "@/hooks/useCoachDetails";
import { useFeeConfig } from "@/hooks/useFeeConfig";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  CAMP_PROGRESS_STEPS,
  CAMP_STEPS,
  campDayCount,
  campMissing,
  campOverlapNotice,
  campStepAnswered,
  campWaiverUrl,
  draftFromCamp,
  draftToPayload,
  emptyCampDraft,
  formatCampDates,
  formatCampMoney,
  formatCampTimes,
  localIsoDay,
  missingLine,
  parsePriceCents,
  plural,
  runAgainDraft,
  type CampDraft,
  type CampStep,
} from "@/utils/camps";
import { feeLine } from "@/utils/fees";
import { CampFamilyView } from "./CampFamilyView";
import type { CampView } from "./campView";
import { DatesField, DetailsFields, GroupsField, NameField, PriceField, RunAgain, WhereField, sectionTitle, type Patch } from "./editor/fields";

type CoachInfo = { id: string | null; name: string; photo: string | null; bio: string | null; slug: string | null; places: string[] };

const STEP_TITLES: Record<CampStep, string> = {
  name: "What's the camp called?",
  dates: "When is it?",
  where: "Where is it?",
  groups: "Groups and times",
  price: "Price per athlete",
  details: "Anything else?",
  review: "Review",
};

const viewFromDraft = (draft: CampDraft, coach: CoachInfo, taken: Record<string, number>): CampView => ({
  name: draft.name.trim(),
  coverUrl: draft.coverUrl ?? coach.photo,
  coachName: coach.name,
  coachPhoto: coach.photo,
  coachBio: coach.bio,
  coachSlug: coach.slug,
  linkedCoach: draft.linkedCoach,
  tags: [],
  priceCents: parsePriceCents(draft.price) ?? 0,
  days: Math.max(1, campDayCount(draft.startsOn, draft.endsOn)),
  startsOn: draft.startsOn,
  endsOn: draft.endsOn,
  location: draft.location.trim() || null,
  groups: draft.groups.map((g) => {
    const signed = g.id ? taken[g.id] ?? 0 : 0;
    return {
      id: g.key,
      name: g.name.trim() || (draft.groups.length === 1 ? "All athletes" : "Group name"),
      description: g.description.trim() || null,
      start: g.start,
      end: g.end,
      spots: g.spots,
      spotsLeft: g.id ? Math.max(0, g.spots - signed) : null,
      full: Boolean(g.id) && g.spots - signed <= 0,
    };
  }),
  included: draft.included.map((i) => i.trim()).filter(Boolean),
});

/** The pay step as families see it, under the preview: card processing, and the pay-directly link. */
const PayPreview = ({ draft }: { draft: CampDraft }) => {
  const { config } = useFeeConfig();
  const cents = parsePriceCents(draft.price);
  // Camps have no platform fee for anyone: card processing only.
  const fee = cents && config ? feeLine(cents, "camp", config) : null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-label-xsm text-dark-300">Pay with</span>
      <div className="flex items-center justify-between gap-3 rounded-control border border-primary bg-primary-50 px-3 py-2.5">
        <span className="text-label-sm">Card, Apple Pay or Google Pay</span>
        {fee ? <span className="flex-none text-caption text-dark-300">+ {formatCampMoney(fee.totalCents - fee.listCents)} card processing</span> : null}
      </div>
      {draft.payDirect ? <span className="text-caption text-primary">Paying in cash?</span> : null}
    </div>
  );
};

export const CampEditorDialog = ({
  open,
  campId,
  onOpenChange,
}: {
  open: boolean;
  /** Null adds a camp. */
  campId: string | null;
  onOpenChange: (open: boolean) => void;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { userProfile } = useAuth();
  const coachId = userProfile?.coach_id ?? null;
  const coachDetails = useCoachDetails(open && coachId ? coachId : undefined);
  const coach: CoachInfo = useMemo(() => {
    const c = coachDetails.coach;
    return {
      id: coachId,
      name: c?.name || userProfile?.name || "You",
      photo: c?.profile_image_url || c?.image_url || null,
      bio: c?.bio ?? null,
      slug: c?.slug ?? null,
      places: Array.isArray(c?.locations) ? (c?.locations as string[]) : [],
    };
  }, [coachDetails.coach, coachId, userProfile?.name]);

  const [savedId, setSavedId] = useState<string | null>(campId);
  const editing = useQuery({
    queryKey: ["camp-editor", savedId],
    enabled: open && Boolean(savedId),
    staleTime: 0,
    retry: false,
    queryFn: () => campsAPI.editor(savedId as string),
  });
  const runAgain = useQuery({
    queryKey: ["camp-run-again"],
    enabled: open && !campId,
    staleTime: 60_000,
    queryFn: () => campsAPI.runAgain(),
  });

  const [draft, setDraft] = useState<CampDraft>(emptyCampDraft);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loadedFrom, setLoadedFrom] = useState<CoachCamp | null>(null);
  const [step, setStep] = useState<CampStep>("name");
  const [backToReview, setBackToReview] = useState(false);
  const [busy, setBusy] = useState<"save" | "publish" | "unpublish" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const loadedVersion = useRef<string | null>(null);
  const phoneBody = useRef<HTMLDivElement>(null);

  useEffect(() => {
    phoneBody.current?.scrollTo({ top: 0 });
  }, [step]);

  // Fresh form every time the editor opens.
  useEffect(() => {
    if (!open) return;
    setSavedId(campId);
    setDraft(emptyCampDraft());
    setUpdatedAt(null);
    setLoadedFrom(null);
    setStep("name");
    setBackToReview(false);
    setBusy(null);
    setError(null);
    setNotice(null);
    setShowDetails(false);
    loadedVersion.current = null;
  }, [open, campId]);

  // Fill from the saved camp once its data (with the groups) is here. Save stays off until then.
  useEffect(() => {
    const camp = editing.data;
    if (!open || !camp || loadedVersion.current === camp.updated_at) return;
    loadedVersion.current = camp.updated_at;
    setDraft(draftFromCamp(camp));
    setUpdatedAt(camp.updated_at);
    setLoadedFrom(camp);
    if (campId) setStep("review");
  }, [editing.data, open, campId]);

  const patch: Patch = (update) => setDraft((cur) => ({ ...cur, ...(typeof update === "function" ? update(cur) : update) }));

  const today = localIsoDay();
  // A camp already running keeps its first day.
  const minDay = loadedFrom?.starts_on && loadedFrom.starts_on.slice(0, 10) < today ? loadedFrom.starts_on.slice(0, 10) : today;
  const missing = campMissing(draft, minDay);
  const waitingForCamp = Boolean(savedId) && !loadedFrom;
  const published = Boolean(loadedFrom?.published);
  const taken = useMemo(() => Object.fromEntries((loadedFrom?.groups ?? []).map((g) => [g.id, g.taken])), [loadedFrom]);
  const canSaveDraft =
    !waitingForCamp && campStepAnswered("name", draft, minDay) && campStepAnswered("groups", draft, minDay) && campStepAnswered("price", draft, minDay);
  const view = viewFromDraft(draft, coach, taken);

  // Open times the camp would close, and booked sessions in its way, for the dates and groups as typed.
  const overlapTimes = useMemo(() => draft.groups.map((g) => ({ start_time: g.start, end_time: g.end })), [draft.groups]);
  const overlaps = useQuery({
    queryKey: ["camp-overlaps", draft.startsOn, draft.endsOn, overlapTimes],
    queryFn: () => campsAPI.overlaps(draft.startsOn as string, draft.endsOn, overlapTimes),
    enabled: open && Boolean(coachId) && Boolean(draft.startsOn) && overlapTimes.length > 0,
    retry: false,
    staleTime: 30_000,
  });
  const overlapNotice = campOverlapNotice(overlaps.data);
  const scheduleNotice =
    overlapNotice.blocks || overlapNotice.closes ? (
      <div className="flex flex-col gap-1 rounded-control border border-info-300 bg-info-50 px-3 py-2.5 text-body-m text-info-800">
        {overlapNotice.blocks ? <p role="alert">{overlapNotice.blocks}</p> : null}
        {overlapNotice.closes ? <p role="status">{overlapNotice.closes}</p> : null}
      </div>
    ) : null;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["coach-camp-list"] }),
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] }),
      queryClient.invalidateQueries({ queryKey: ["camp-registrations"] }),
      queryClient.invalidateQueries({ queryKey: ["coach-camps"] }),
      queryClient.invalidateQueries({ queryKey: ["camp-overlaps"] }),
    ]);
  };

  const fail = async (err: unknown) => {
    if (err instanceof CampError && err.code === "stale") {
      setNotice("This camp was changed in another tab. We loaded the latest version: check it and save again.");
      setError(null);
      loadedVersion.current = null;
      await editing.refetch();
      return;
    }
    setError(err instanceof Error ? err.message : "That didn't save. Try again.");
  };

  const save = async (publish: boolean) => {
    if (waitingForCamp) return;
    setBusy(publish ? "publish" : "save");
    setError(null);
    setNotice(null);
    try {
      const { camp, groups } = draftToPayload(draft);
      const saved = await campsAPI.save(savedId, camp, groups, updatedAt);
      setSavedId(saved.id);
      setUpdatedAt(saved.updated_at);
      loadedVersion.current = saved.updated_at;
      setLoadedFrom(saved);
      let result = saved;
      if (publish && !saved.published) result = await campsAPI.publish(saved.id);
      await refresh();
      toast(
        publish
          ? {
              title: published ? "Camp updated" : "Camp published",
              description:
                result.schedule_sessions != null
                  ? `${plural(result.schedule_sessions, "camp session")} on your schedule.`
                  : "Camp days are on your schedule for each group.",
            }
          : { title: "Draft saved", description: "Families can't see it until you publish." },
      );
      onOpenChange(false);
    } catch (err) {
      await fail(err);
    } finally {
      setBusy(null);
    }
  };

  const unpublish = async () => {
    if (!savedId) return;
    setBusy("unpublish");
    setError(null);
    try {
      await campsAPI.unpublish(savedId);
      await refresh();
      toast({ title: "Camp unpublished", description: "The link stops taking sign-ups. Athletes already in keep their spot." });
      onOpenChange(false);
    } catch (err) {
      await fail(err);
    } finally {
      setBusy(null);
    }
  };

  const applyRunAgain = (camp: CoachCamp) => {
    setDraft(runAgainDraft(camp));
    if (isMobile) setStep("dates");
    toast({ title: "Filled from " + camp.name, description: "Pick the new dates." });
  };

  const close = (next: boolean) => {
    if (!busy) onOpenChange(next);
  };

  const title = savedId ? (published ? "Edit camp" : "Edit draft camp") : "Add camp";
  const loadError = editing.isError ? (editing.error instanceof Error ? editing.error.message : "Could not open this camp.") : null;

  const banners = (
    <>
      {notice ? (
        <p role="status" className="rounded-control border border-info-300 bg-info-50 px-3 py-2.5 text-body-m text-info-800">
          {notice}
        </p>
      ) : null}
      {loadError ? (
        <p role="alert" className="rounded-control border border-error-300 bg-error-100 px-3 py-2.5 text-body-m text-error-700">
          {loadError}
        </p>
      ) : null}
      {waitingForCamp && !loadError ? <p className={meta}>Loading the camp…</p> : null}
    </>
  );

  const publishLabel = busy === "publish" ? "Publishing…" : published ? "Save changes" : "Publish camp";

  // ---------------------------------------------------------------- phone
  if (isMobile) {
    const index = CAMP_STEPS.indexOf(step);
    const answered = campStepAnswered(step, draft, minDay);
    const goNext = () => {
      if (backToReview) {
        setBackToReview(false);
        setStep("review");
        return;
      }
      setStep(CAMP_STEPS[Math.min(index + 1, CAMP_STEPS.length - 1)]);
    };
    const goBack = () => {
      if (backToReview) {
        setBackToReview(false);
        setStep("review");
        return;
      }
      if (index > 0) setStep(CAMP_STEPS[index - 1]);
    };
    const edit = (to: CampStep) => {
      setBackToReview(true);
      setStep(to);
    };
    const filled = Math.min(index + 1, CAMP_PROGRESS_STEPS);

    return (
      <Dialog open={open} onOpenChange={close}>
        <DialogContent
          className={cn(
            modalSurface,
            closeButtonOverride,
            "!inset-0 !left-0 !top-0 flex !h-[100dvh] !max-h-none !w-full !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 !rounded-none p-0",
          )}
        >
          <div className="flex flex-col gap-3 border-b border-light-525 px-4 pb-3 pt-4 pr-14">
            <DialogTitle className="text-card-title text-dark">{title}</DialogTitle>
            <DialogDescription className="sr-only">One question per screen.</DialogDescription>
            <div className="flex items-center gap-1.5" aria-label={`Question ${filled} of ${CAMP_PROGRESS_STEPS}`}>
              {Array.from({ length: CAMP_PROGRESS_STEPS }, (_, k) => (
                <i key={k} className={cn("h-1 flex-1 rounded-pill", k < filled ? "bg-primary" : "bg-light-550")} />
              ))}
            </div>
          </div>
          <div ref={phoneBody} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-5">
            {banners}
            {step !== "review" ? <h2 className="text-page-title-phone text-dark">{STEP_TITLES[step]}</h2> : null}
            {step === "name" ? (
              <>
                <NameField draft={draft} patch={patch} />
                {!savedId && runAgain.data?.length ? <RunAgain camps={runAgain.data} onUse={applyRunAgain} /> : null}
              </>
            ) : null}
            {step === "dates" ? <DatesField draft={draft} patch={patch} minDay={minDay} /> : null}
            {step === "where" ? <WhereField draft={draft} patch={patch} places={coach.places} /> : null}
            {step === "groups" ? <GroupsField draft={draft} patch={patch} taken={taken} /> : null}
            {step === "price" ? <PriceField draft={draft} patch={patch} /> : null}
            {step === "details" ? (
              <>
                <p className={meta}>All optional. Families see these on the camp page.</p>
                <DetailsFields draft={draft} patch={patch} coachPhoto={coach.photo} selfId={coach.id} />
              </>
            ) : null}
            {step === "review" ? <Review draft={draft} view={view} onEdit={edit} /> : null}
            {step === "review" || step === "dates" || step === "groups" ? scheduleNotice : null}
            {error ? (
              <p role="alert" className="text-body-m text-error-700">
                {error}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2.5 border-t border-light-525 bg-light-300 px-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))] pt-3">
            {step === "details" || step === "review" ? (
              missing.length ? <span className="text-caption text-dark-300">{missingLine(missing)}</span> : null
            ) : null}
            {step === "review" ? (
              <>
                <button type="button" className={cn(primaryButton, "h-11 w-full")} disabled={Boolean(busy) || waitingForCamp || missing.length > 0} onClick={() => void save(true)}>
                  {publishLabel}
                </button>
                <div className="flex items-center justify-between">
                  <button type="button" className={textButton} onClick={() => setStep("details")}>
                    <ChevronLeft strokeWidth={1.5} aria-hidden="true" />
                    Back
                  </button>
                  {published ? (
                    <button type="button" className={cn(textButton, "text-dark-300 hover:text-dark")} disabled={Boolean(busy)} onClick={() => void unpublish()}>
                      Unpublish
                    </button>
                  ) : (
                    <button type="button" className={textButton} disabled={Boolean(busy) || !canSaveDraft} onClick={() => void save(false)}>
                      {busy === "save" ? "Saving…" : "Save draft"}
                    </button>
                  )}
                </div>
              </>
            ) : step === "details" && !backToReview ? (
              <div className="flex items-center gap-3">
                <button type="button" className={cn(secondaryButton, "h-11")} onClick={goBack}>
                  Back
                </button>
                <button type="button" className={cn(primaryButton, "h-11 flex-1")} disabled={missing.length > 0} onClick={() => setStep("review")}>
                  Review camp
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {index > 0 || backToReview ? (
                  <button type="button" className={cn(secondaryButton, "h-11")} onClick={goBack}>
                    Back
                  </button>
                ) : null}
                <button type="button" className={cn(primaryButton, "h-11 flex-1")} disabled={!answered} onClick={goNext}>
                  {backToReview ? "Back to review" : "Next"}
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ---------------------------------------------------------------- desktop
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        className={cn(
          modalSurface,
          closeButtonOverride,
          "flex h-[min(900px,calc(100dvh-32px))] w-[calc(100vw-32px)] max-w-[1000px] flex-col gap-0 overflow-hidden p-0",
        )}
      >
        <div className="flex flex-col gap-1 border-b border-light-525 px-[25px] py-5 pr-14">
          <DialogTitle className="text-section text-dark">{title}</DialogTitle>
          <DialogDescription className="text-body-m text-dark-300">
            One price per athlete for the whole camp. No credits, nothing to book day by day.
          </DialogDescription>
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto px-[25px] pb-7 pt-5">
            {banners}
            {!savedId && runAgain.data?.length ? <RunAgain camps={runAgain.data} onUse={applyRunAgain} /> : null}
            <NameField draft={draft} patch={patch} />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <DatesField draft={draft} patch={patch} minDay={minDay} />
              <PriceField draft={draft} patch={patch} />
            </div>
            <WhereField draft={draft} patch={patch} places={coach.places} />
            <GroupsField draft={draft} patch={patch} taken={taken} />
            {scheduleNotice}
            <div className="flex flex-col gap-4 border-t border-light-525 pt-5">
              <button
                type="button"
                className="flex items-center justify-between gap-3 text-left"
                aria-expanded={showDetails}
                onClick={() => setShowDetails((v) => !v)}
              >
                <span className="flex flex-col gap-0.5">
                  <span className={sectionTitle}>More details</span>
                  <span className={meta}>Cover photo, what&apos;s included, a linked coach, paying you directly, a waiver</span>
                </span>
                <span className={cn(textButton)}>{showDetails ? "Hide" : "Show"}</span>
              </button>
              {showDetails ? <DetailsFields draft={draft} patch={patch} coachPhoto={coach.photo} selfId={coach.id} /> : null}
            </div>
          </div>
          <aside className="flex w-[400px] flex-none flex-col gap-3 overflow-y-auto border-l border-light-525 bg-light-400 px-6 py-5 max-lg:w-[340px]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-label-sm text-dark">What families see</span>
              <span className={meta}>Updates as you type</span>
            </div>
            <CampFamilyView view={view} compact>
              <PayPreview draft={draft} />
            </CampFamilyView>
          </aside>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-light-525 px-[25px] py-4">
          <span className="min-w-0 flex-1 text-caption text-dark-300">
            {missingLine(missing) ?? "Camp days go on your schedule for each group. Families can sign up from your profile or a shared link."}
          </span>
          {error ? (
            <p role="alert" className="w-full text-body-m text-error-700">
              {error}
            </p>
          ) : null}
          <div className="flex items-center gap-2.5">
            {published ? (
              <button type="button" className={cn(textButton, "text-dark-300 hover:text-dark")} disabled={Boolean(busy)} onClick={() => void unpublish()}>
                {busy === "unpublish" ? "Unpublishing…" : "Unpublish"}
              </button>
            ) : (
              <button type="button" className={secondaryButton} disabled={Boolean(busy) || !canSaveDraft} onClick={() => void save(false)}>
                {busy === "save" ? "Saving…" : "Save draft"}
              </button>
            )}
            <button type="button" className={primaryButton} disabled={Boolean(busy) || waitingForCamp || missing.length > 0} onClick={() => void save(true)}>
              {publishLabel}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/** Phone review: the family view, then each answer with Edit. */
const Review = ({ draft, view, onEdit }: { draft: CampDraft; view: CampView; onEdit: (step: CampStep) => void }) => {
  const cents = parsePriceCents(draft.price);
  const rows: { step: CampStep; label: string; value: string }[] = [
    { step: "name", label: "Name", value: draft.name.trim() || "Not set" },
    { step: "dates", label: "Dates", value: formatCampDates(draft.startsOn, draft.endsOn) ?? "Not set" },
    { step: "where", label: "Where", value: draft.location.trim() || "Not set" },
    {
      step: "groups",
      label: "Groups",
      value: draft.groups.map((g) => `${g.name.trim() || "All athletes"} · ${formatCampTimes(g.start, g.end)} · ${plural(g.spots, "spot")}`).join("\n"),
    },
    { step: "price", label: "Price per athlete", value: cents ? formatCampMoney(cents) : "Not set" },
    {
      step: "details",
      label: "Details",
      value:
        [
          draft.coverUrl ? "Cover photo" : "Your profile photo as the cover",
          draft.included.filter((i) => i.trim()).length ? plural(draft.included.filter((i) => i.trim()).length, "included item") : null,
          draft.linkedCoach ? `With ${draft.linkedCoach.name}` : null,
          draft.payDirect ? "Families can pay you directly" : null,
          campWaiverUrl(draft.waiverUrl) ? "Waiver" : null,
        ]
          .filter(Boolean)
          .join(" · ") || "None",
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-page-title-phone text-dark">Review</h2>
        <span className={meta}>What families see</span>
      </div>
      <CampFamilyView view={view} compact />
      <div className="flex flex-col divide-y divide-light-525 rounded-card border border-light-525 bg-light-300 px-4">
        {rows.map((row) => (
          <div key={row.step} className="flex items-start gap-3 py-3">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={label}>{row.label}</span>
              <span className="whitespace-pre-line break-words text-body-m text-dark">{row.value}</span>
            </span>
            <button type="button" className={textButton} onClick={() => onEdit(row.step)}>
              <Pencil strokeWidth={1.5} aria-hidden="true" />
              Edit
            </button>
          </div>
        ))}
      </div>
      <p className={meta}>Camp days go on your schedule for each group. Families can sign up from your profile or a shared link.</p>
    </div>
  );
};
