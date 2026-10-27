/**
 * The camp editor's questions (Michael's "Camps in Create session" + the coach mockup). The
 * desktop sheet shows them all at once; the phone shows one per screen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Cropper, { type Area } from "react-easy-crop";
import { useQuery } from "@tanstack/react-query";
import { FileText, Image as ImageIcon, MapPin, Plus, Search, X } from "@/components/icons";
import { coachesAPI } from "@/api";
import { campsAPI, type CampCoachRef, type CoachCamp } from "@/api/camps";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { chip } from "@/components/schedule/create/classes";
import { input, label, meta, primaryButton, secondaryButton, smallButton, textButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { getCroppedFile } from "@/utils/imageUtils";
import {
  campDayCount,
  campWaiverLabel,
  campWaiverUrl,
  campWaiverUrlError,
  clampSpots,
  formatCampDates,
  formatCampDay,
  formatCampMoney,
  formatCampTime,
  groupEndOptions,
  groupStartOptions,
  localIsoDay,
  moveGroupStart,
  newGroup,
  parsePriceCents,
  perDayCents,
  pickCampDay,
  plural,
  timeToMinutes,
  type CampDraft,
  type CampDraftGroup,
} from "@/utils/camps";
import { CampAvatar } from "../CampFamilyView";

export type Patch = (update: Partial<CampDraft> | ((cur: CampDraft) => Partial<CampDraft>)) => void;

export const fieldBox = "flex min-w-0 flex-col gap-1.5";
export const sectionTitle = "text-subtitle text-dark";
const box = "flex flex-col gap-3 rounded-card border border-light-525 bg-light-300 p-3.5 md:p-4";

export const NameField = ({ draft, patch, autoFocus }: { draft: CampDraft; patch: Patch; autoFocus?: boolean }) => (
  <div className={fieldBox}>
    <label htmlFor="camp-name" className={label}>
      Camp name
    </label>
    <input
      id="camp-name"
      className={input}
      value={draft.name}
      maxLength={100}
      autoFocus={autoFocus}
      placeholder="Thanksgiving high performance camp"
      onChange={(e) => patch({ name: e.target.value })}
    />
  </div>
);

const toDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

export const DatesField = ({ draft, patch, minDay }: { draft: CampDraft; patch: Patch; minDay: string }) => {
  const [open, setOpen] = useState<"start" | "end" | null>(null);
  const days = campDayCount(draft.startsOn, draft.endsOn);
  const tile = (which: "start" | "end") => {
    const value = which === "start" ? draft.startsOn : draft.endsOn;
    const on = open === which;
    return (
      <button
        type="button"
        aria-expanded={on}
        className={cn(
          "flex min-h-[56px] min-w-0 flex-1 flex-col items-start justify-center gap-0.5 rounded-control border px-3 py-2 text-left transition-colors",
          on ? "border-primary bg-primary-50" : "border-light-525 bg-light-300 hover:bg-light-200",
        )}
        onClick={() => setOpen(on ? null : which)}
      >
        <span className="text-label-xsm text-dark-300">{which === "start" ? "Starts" : "Ends"}</span>
        <span className={cn("text-label-sm", value ? "text-dark" : "text-dark-200")}>
          {value ? formatCampDay(value) : "Pick a day"}
        </span>
      </button>
    );
  };
  const selected = open === "start" ? draft.startsOn : draft.endsOn;
  const month = selected ?? draft.startsOn ?? minDay;
  return (
    <div className={fieldBox}>
      <span className={label}>Dates</span>
      <div className="flex gap-2.5">
        {tile("start")}
        {tile("end")}
      </div>
      {open ? (
        <div className="self-start rounded-card border border-light-525 bg-light-300">
          <Calendar
            mode="single"
            selected={selected ? toDate(selected) : undefined}
            defaultMonth={toDate(month)}
            disabled={{ before: toDate(minDay) }}
            onSelect={(date) => {
              if (!date) return;
              const day = localIsoDay(date);
              patch((cur) => pickCampDay({ startsOn: cur.startsOn, endsOn: cur.endsOn }, open, day));
              setOpen(open === "start" ? "end" : null);
            }}
            classNames={{
              day_selected: "bg-primary text-light hover:bg-primary hover:text-light focus:bg-primary focus:text-light",
              day_today: "border border-primary-300 text-primary",
              day_disabled: "text-dark-200 opacity-60",
              caption_label: "text-label-sm text-dark",
              head_cell: "w-9 text-caption font-normal text-dark-300",
            }}
          />
        </div>
      ) : null}
      <span className={meta}>
        {days
          ? `${formatCampDates(draft.startsOn, draft.endsOn)} · ${days === 1 ? "a one-day camp" : plural(days, "day")}`
          : "Pick the same day twice for a one-day camp."}
      </span>
    </div>
  );
};

export const WhereField = ({ draft, patch, places }: { draft: CampDraft; patch: Patch; places: string[] }) => {
  const saved = places.filter((p) => p && p !== "Video call");
  const typed = draft.location && !saved.includes(draft.location) ? draft.location : "";
  return (
    <div className={fieldBox}>
      <span className={label}>Where</span>
      {saved.length ? (
        <div className="flex flex-wrap gap-2">
          {saved.map((place) => (
            <button
              key={place}
              type="button"
              aria-pressed={draft.location === place}
              className={cn(chip(draft.location === place), "max-w-full")}
              onClick={() => patch({ location: place })}
            >
              <MapPin strokeWidth={1.5} aria-hidden="true" />
              <span className="truncate">{place}</span>
            </button>
          ))}
        </div>
      ) : null}
      <input
        className={input}
        value={typed}
        maxLength={200}
        aria-label={saved.length ? "Somewhere else" : "Location"}
        placeholder={saved.length ? "Somewhere else? Type the place" : "Field or address"}
        onChange={(e) => patch({ location: e.target.value })}
      />
      {!saved.length ? <span className={meta}>Places you save under Schedule settings show here to pick.</span> : null}
    </div>
  );
};

const GroupRow = ({
  group,
  index,
  count,
  taken,
  onChange,
  onRemove,
}: {
  group: CampDraftGroup;
  index: number;
  count: number;
  taken: number;
  onChange: (next: CampDraftGroup) => void;
  onRemove: () => void;
}) => {
  const nameMissing = count > 1 && !group.name.trim();
  return (
    <div className={box}>
      <div className="flex items-center justify-between gap-2">
        <b className="text-label-sm">Group {index + 1}</b>
        {count > 1 ? (
          <button type="button" className={cn(textButton, "text-dark-300 hover:text-dark")} disabled={taken > 0} onClick={onRemove} title={taken > 0 ? "Athletes are signed up for this group" : undefined}>
            Remove
          </button>
        ) : null}
      </div>
      <div className={fieldBox}>
        <label htmlFor={`${group.key}-name`} className={label}>
          Group name{count === 1 ? <span className="font-normal"> (optional)</span> : null}
        </label>
        <input
          id={`${group.key}-name`}
          className={cn(input, nameMissing && "border-error-600")}
          value={group.name}
          maxLength={60}
          placeholder={count === 1 ? "All athletes" : "Elite"}
          onChange={(e) => onChange({ ...group, name: e.target.value })}
        />
        {nameMissing ? <span className="text-caption text-error-700">Name each group when there are two or more</span> : null}
      </div>
      <div className="grid grid-cols-[1fr_1fr_80px] gap-2">
        <label className={fieldBox}>
          <span className={label}>From</span>
          <select className={input} value={group.start} onChange={(e) => onChange(moveGroupStart(group, e.target.value))}>
            {groupStartOptions().map((t) => (
              <option key={t} value={t}>
                {formatCampTime(t)}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldBox}>
          <span className={label}>To</span>
          <select className={input} value={group.end} onChange={(e) => onChange({ ...group, end: e.target.value })}>
            {groupEndOptions(group.start).map((t) => (
              <option key={t} value={t}>
                {formatCampTime(t)}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldBox}>
          <span className={label}>Spots</span>
          <input
            className={input}
            type="number"
            inputMode="numeric"
            min={Math.max(1, taken)}
            max={60}
            value={group.spots}
            onChange={(e) => onChange({ ...group, spots: e.target.value === "" ? 1 : clampSpots(Number(e.target.value)) })}
          />
        </label>
      </div>
      {taken > 0 ? <span className={meta}>{plural(taken, "athlete")} signed up</span> : null}
      <div className={fieldBox}>
        <label htmlFor={`${group.key}-desc`} className={label}>
          Short description<span className="font-normal"> (optional)</span>
        </label>
        <input
          id={`${group.key}-desc`}
          className={input}
          value={group.description}
          maxLength={280}
          placeholder="Ages 12 to 15, academy players"
          onChange={(e) => onChange({ ...group, description: e.target.value })}
        />
      </div>
    </div>
  );
};

export const GroupsField = ({ draft, patch, taken }: { draft: CampDraft; patch: Patch; taken: Record<string, number> }) => {
  const update = (key: string, next: CampDraftGroup) => patch((cur) => ({ groups: cur.groups.map((g) => (g.key === key ? next : g)) }));
  const badTimes = draft.groups.some((g) => timeToMinutes(g.end) <= timeToMinutes(g.start));
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <span className={sectionTitle}>Groups</span>
        <span className={meta}>Families pick one when they sign up. Camp days go on your schedule for each group.</span>
      </div>
      {draft.groups.map((group, i) => (
        <GroupRow
          key={group.key}
          group={group}
          index={i}
          count={draft.groups.length}
          taken={group.id ? taken[group.id] ?? 0 : 0}
          onChange={(next) => update(group.key, next)}
          onRemove={() => patch((cur) => ({ groups: cur.groups.filter((g) => g.key !== group.key) }))}
        />
      ))}
      {badTimes ? <span className="text-caption text-error-700">Each group has to end after it starts.</span> : null}
      {draft.groups.length < 4 ? (
        <button
          type="button"
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-control border border-dashed border-light-600 text-label-sm text-dark-300 hover:bg-light-200 hover:text-dark"
          onClick={() => patch((cur) => ({ groups: [...cur.groups, newGroup(cur.groups[cur.groups.length - 1])] }))}
        >
          <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
          Add group
        </button>
      ) : null}
    </div>
  );
};

export const PriceField = ({ draft, patch }: { draft: CampDraft; patch: Patch }) => {
  const cents = parsePriceCents(draft.price);
  const days = campDayCount(draft.startsOn, draft.endsOn);
  return (
    <div className={fieldBox}>
      <label htmlFor="camp-price" className={label}>
        Price per athlete
      </label>
      <div className={cn(input, "flex items-center gap-1 focus-within:border-primary focus-within:outline focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-primary")}>
        <span className="text-dark-300">$</span>
        <input
          id="camp-price"
          className="h-full min-w-0 flex-1 bg-transparent outline-none"
          inputMode="decimal"
          value={draft.price}
          placeholder="260"
          onChange={(e) => patch({ price: e.target.value.replace(/[^\d.]/g, "") })}
        />
      </div>
      <span className={meta}>
        {cents && days > 1
          ? `${formatCampMoney(perDayCents(cents, days))} a day over ${plural(days, "day")}. `
          : draft.price && !cents
            ? "Between $1 and $10,000. "
            : ""}
        One-time fee for the whole camp, paid once at sign-up. No credits.
      </span>
    </div>
  );
};

/** Two most recent camps; "Use this" fills everything but the dates. */
export const RunAgain = ({ camps, onUse }: { camps: CoachCamp[]; onUse: (camp: CoachCamp) => void }) =>
  camps.length ? (
    <div className="flex flex-col gap-2">
      <span className={label}>Run a camp again</span>
      {camps.slice(0, 2).map((camp) => (
        <div key={camp.id} className="flex items-center gap-3 rounded-control border border-light-525 bg-light-300 px-3 py-2.5">
          <span className="flex min-w-0 flex-1 flex-col">
            <b className="truncate text-label-sm">{camp.name}</b>
            <span className={meta}>
              {[formatCampMoney(camp.price_cents), plural(camp.groups.length, "group"), camp.location].filter(Boolean).join(" · ")}
            </span>
          </span>
          <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => onUse(camp)}>
            Use this
          </button>
        </div>
      ))}
    </div>
  ) : null;

const COVER_ASPECT = 16 / 9;

const CoverField = ({ draft, patch, coachPhoto }: { draft: CampDraft; patch: Patch; coachPhoto: string | null }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const shown = draft.coverUrl ?? coachPhoto;
  const objectUrl = useMemo(() => (cropFile ? URL.createObjectURL(cropFile) : null), [cropFile]);
  useEffect(() => () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => setCroppedArea(pixels), []);

  const closeCrop = () => {
    setCropFile(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const uploadCropped = async () => {
    if (!cropFile || !croppedArea) return;
    setBusy(true);
    setError(null);
    try {
      const file = await getCroppedFile(cropFile, croppedArea, "-camp-cover");
      const url = await campsAPI.uploadCover(file);
      patch({ coverUrl: url });
      closeCrop();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The photo didn't upload. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const pick = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setCropFile(file);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
  };

  return (
    <div className={fieldBox}>
      <span className={label}>Cover photo</span>
      <div className="relative h-[150px] overflow-hidden rounded-control bg-dark">
        {shown ? (
          <img
            src={shown}
            alt=""
            className="size-full object-cover"
            style={draft.coverUrl ? undefined : { objectPosition: "50% 22%" }}
          />
        ) : null}
        <div className="absolute bottom-3 right-3 flex gap-2">
          {draft.coverUrl ? (
            <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => patch({ coverUrl: null })}>
              Use my photo
            </button>
          ) : null}
          <button type="button" className={cn(secondaryButton, smallButton)} disabled={busy} onClick={() => fileRef.current?.click()}>
            <ImageIcon strokeWidth={1.5} aria-hidden="true" />
            {busy ? "Uploading…" : "Change photo"}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      <span className={meta}>
        {draft.coverUrl ? "" : "Your profile photo until you pick one. "}A photo of you coaching works best. Skip posters with text on them: the details already show under the photo.
      </span>
      {error ? <span className="text-caption text-error-700">{error}</span> : null}
      {cropFile && objectUrl && typeof document !== "undefined"
        ? createPortal(
            <div className="pointer-events-auto fixed inset-0 z-[2000] flex items-center justify-center bg-dark/50 px-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="camp-cover-crop-title"
                className="w-full max-w-lg rounded-card border border-light-525 bg-light-300 shadow-overlay"
              >
                <div className="flex items-center justify-between gap-2 px-5 py-4">
                  <h3 id="camp-cover-crop-title" className="text-section text-dark">
                    Crop cover photo
                  </h3>
                  <button type="button" className={textButton} onClick={closeCrop} aria-label="Close">
                    <X strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </div>
                <div className="h-px bg-light-525" />
                <div className="flex flex-col gap-4 px-5 py-4">
                  <div className="relative h-[200px] w-full overflow-hidden rounded-control bg-dark">
                    <Cropper
                      image={objectUrl}
                      crop={crop}
                      zoom={zoom}
                      aspect={COVER_ASPECT}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={onCropComplete}
                    />
                  </div>
                  <label className="flex items-center gap-3">
                    <span className="text-label-sm text-dark-400">Zoom</span>
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.01}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="h-[5px] w-full cursor-pointer accent-primary"
                    />
                  </label>
                </div>
                <div className="h-px bg-light-525" />
                <div className="flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:justify-end">
                  <button type="button" className={secondaryButton} onClick={closeCrop} disabled={busy}>
                    Cancel
                  </button>
                  <button type="button" className={primaryButton} disabled={busy || !croppedArea} onClick={() => void uploadCropped()}>
                    {busy ? "Uploading…" : "Save crop"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
};

const IncludedField = ({ draft, patch }: { draft: CampDraft; patch: Patch }) => (
  <div className={fieldBox}>
    <span className={label}>What&apos;s included</span>
    {draft.included.map((item, i) => (
      <div key={i} className="flex items-center gap-2">
        <input
          className={input}
          value={item}
          maxLength={120}
          aria-label={`Included item ${i + 1}`}
          placeholder="Camp jersey"
          onChange={(e) => patch((cur) => ({ included: cur.included.map((line, j) => (j === i ? e.target.value : line)) }))}
        />
        <button
          type="button"
          className="inline-flex size-control flex-none items-center justify-center rounded-control text-dark-300 hover:bg-light-400 hover:text-dark"
          aria-label={`Remove ${item || "item"}`}
          onClick={() => patch((cur) => ({ included: cur.included.filter((_, j) => j !== i) }))}
        >
          <X className="size-4" strokeWidth={1.5} />
        </button>
      </div>
    ))}
    {draft.included.length < 12 ? (
      <button type="button" className={cn(textButton, "self-start")} onClick={() => patch((cur) => ({ included: [...cur.included, ""] }))}>
        <Plus strokeWidth={1.5} aria-hidden="true" />
        Add item
      </button>
    ) : null}
  </div>
);

const LinkCoachField = ({ draft, patch, selfId }: { draft: CampDraft; patch: Patch; selfId: string | null }) => {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const coaches = useQuery({
    queryKey: ["camp-link-coaches"],
    enabled: searching,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await coachesAPI.getPublicCoaches();
      if (res.error) throw new Error(res.error.message);
      return (res.data ?? []).map(
        (c): CampCoachRef => ({ id: c.id, name: c.name, slug: c.slug ?? null, photo_url: c.profile_image_url || c.image_url || null }),
      );
    },
  });
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return (coaches.data ?? []).filter((c) => c.id !== selfId && c.name.toLowerCase().includes(q)).slice(0, 5);
  }, [coaches.data, query, selfId]);
  const linked = draft.linkedCoach;
  return (
    <div className={fieldBox}>
      <span className={label}>Link a coach on AthaNext</span>
      {linked ? (
        <div className="flex items-center gap-2.5 rounded-control border border-primary bg-primary-50 px-2.5 py-2">
          <CampAvatar name={linked.name} photo={linked.photo_url} />
          <span className="flex min-w-0 flex-1 flex-col">
            <b className="truncate text-label-sm">{linked.name}</b>
            <span className={meta}>Families see their photo and can open their profile.</span>
          </span>
          <button type="button" className={cn(textButton, "text-dark-300 hover:text-dark")} onClick={() => patch({ linkedCoach: null })}>
            Remove
          </button>
        </div>
      ) : (
        <>
          <div className={cn(input, "flex items-center gap-2")}>
            <Search className="size-4 flex-none text-dark-300" strokeWidth={1.5} aria-hidden="true" />
            <input
              className="h-full min-w-0 flex-1 bg-transparent outline-none"
              value={query}
              placeholder="Search coaches by name"
              aria-label="Search coaches by name"
              onFocus={() => setSearching(true)}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {coaches.isError ? <span className="text-caption text-error-700">Coaches couldn&apos;t be loaded. Try again.</span> : null}
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              className="flex items-center gap-2.5 rounded-control border border-light-525 bg-light-300 px-2.5 py-2 text-left hover:bg-light-200"
              onClick={() => {
                patch({ linkedCoach: c });
                setQuery("");
              }}
            >
              <CampAvatar name={c.name} photo={c.photo_url} />
              <span className="truncate text-label-sm">{c.name}</span>
            </button>
          ))}
          {query.trim().length >= 2 && coaches.data && !matches.length ? <span className={meta}>No coach by that name.</span> : null}
          <span className={meta}>A nutrition coach or a guest coach working the camp. They show on the camp page.</span>
        </>
      )}
    </div>
  );
};

const PayDirectField = ({ draft, patch }: { draft: CampDraft; patch: Patch }) => (
  <label className="flex cursor-pointer items-start gap-3 rounded-card border border-light-525 bg-light-300 p-3.5 md:p-4">
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <b className="text-label-sm">Let families pay you directly (cash, Zelle, Venmo)</b>
      <span className={meta}>
        Any family can choose it at sign-up. Their spot shows as Waiting until you mark it paid. Card payments stay in the app.
      </span>
    </span>
    <Switch
      checked={draft.payDirect}
      onCheckedChange={(on) => patch({ payDirect: on })}
      aria-label="Let families pay you directly (cash, Zelle, Venmo)"
    />
  </label>
);

const WaiverField = ({ draft, patch }: { draft: CampDraft; patch: Patch }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const saved = campWaiverUrl(draft.waiverUrl);
  const linkError = campWaiverUrlError(draft.waiverUrl);
  const uploaded = saved?.includes("/camp-waivers/") ?? false;
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setUploadError(null);
    try {
      patch({ waiverUrl: await campsAPI.uploadWaiver(file) });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "The waiver didn't upload. Try again.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  return (
    <div className={fieldBox}>
      <label htmlFor="camp-waiver" className={label}>
        Waiver <span className="font-normal text-dark-300">(optional)</span>
      </label>
      {uploaded && saved ? (
        <div className="flex items-center gap-2.5 rounded-control border border-light-525 bg-light-300 px-2.5 py-2">
          <FileText className="size-5 flex-none text-dark-300" strokeWidth={1.5} aria-hidden="true" />
          <a href={saved} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-label-sm underline underline-offset-2 hover:text-primary">
            {campWaiverLabel(saved)}
          </a>
          <button type="button" className={cn(textButton, "text-dark-300 hover:text-dark")} onClick={() => patch({ waiverUrl: "" })}>
            Remove
          </button>
        </div>
      ) : (
        <input
          id="camp-waiver"
          className={input}
          type="url"
          inputMode="url"
          maxLength={1000}
          placeholder="Paste a link, like https://…"
          value={draft.waiverUrl}
          aria-invalid={linkError ? "true" : undefined}
          aria-describedby={linkError ? "camp-waiver-error" : undefined}
          onChange={(e) => patch({ waiverUrl: e.target.value })}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={cn(secondaryButton, smallButton)} disabled={busy} onClick={() => fileRef.current?.click()}>
          <FileText strokeWidth={1.5} aria-hidden="true" />
          {busy ? "Uploading…" : uploaded ? "Replace PDF" : "Upload a PDF"}
        </button>
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
      </div>
      <span className={meta}>A PDF up to 10 MB or a link. Families open it from the waiver checkbox when they sign up.</span>
      {linkError ? (
        <span id="camp-waiver-error" className="text-caption text-error-700">
          {linkError}
        </span>
      ) : null}
      {uploadError ? <span className="text-caption text-error-700">{uploadError}</span> : null}
    </div>
  );
};

/** Optional details: cover, included, linked coach, pay directly, waiver. */
export const DetailsFields = ({
  draft,
  patch,
  coachPhoto,
  selfId,
}: {
  draft: CampDraft;
  patch: Patch;
  coachPhoto: string | null;
  selfId: string | null;
}) => (
  <div className="flex flex-col gap-5">
    <CoverField draft={draft} patch={patch} coachPhoto={coachPhoto} />
    <IncludedField draft={draft} patch={patch} />
    <LinkCoachField draft={draft} patch={patch} selfId={selfId} />
    <PayDirectField draft={draft} patch={patch} />
    <WaiverField draft={draft} patch={patch} />
  </div>
);

