/**
 * Edit profile (Working Copy c-profile with `prof.edit`, `AN.profileBody(p, 'edit')`): one card
 * with cover, photo, Title and ZIP, pillars, levels, About you and facts; sessions and packages
 * with show/hide per session type; credentials; reviews. The right column has completeness,
 * quick info, the FAQ editor and gear. Text fields save on Done; packages, session types,
 * cover, video, credentials and deals save as soon as their editor closes.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Award, BadgeCheck, Check, Image as ImageIcon, Layers, Pencil, Plus, ShieldCheck, Trash2, Upload, Video } from "@/components/icons";
import { BASE_SERVICE_ID, coachProfileAPI, type ProfileService } from "@/api/coachProfile";
import { packagesAPI } from "@/api/packages";
import { BrandPill } from "@/components/brand";
import { ToastAction } from "@/components/ui/toast";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/ui/page-header";
import { card, iconButton, input, label, primaryButton, secondaryButton, smallButton, textButton } from "@/components/schedule/styles";
import { LEVEL_OPTIONS, LEVEL_TAGS, sanitizePathwayTags, type LevelTag } from "@/constants/pathwayTags";
import type { CoachPackage } from "@/hooks/useCoachPackages";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import type { Brand } from "@/utils/brands";
import { AGE_AND_UP } from "@/utils/coachAges";
import { hasRichTextMarkup, stripRichTextToPlainText } from "@/utils/richText";
import { BrandLogos } from "../BrandLogos";
import { organizationsForProfile } from "../organizationLogos";
import type { CoachProfileData, ProfileReview } from "../CoachProfileView";
import { GearAndDealsCard } from "../GearAndDealsCard";
import { CompletenessList } from "./Completeness";
import { OwnReviews } from "./OwnReviews";
import { ServiceEditorDialog } from "./ServiceEditorDialog";
import { useSaveServices, type StepName } from "./hooks";
import { Avatar } from "./parts";
import { caption, chip, money, repliesLabel, sessionTypesFromWhere } from "./shared";
import type { Camp } from "@/api/packages";
import { CampEditorDialog } from "@/components/camps/CampEditorDialog";
import { CampEditorList } from "@/components/camps/CampEditorList";
import { packageKind } from "@/components/camps/format";

const AGE_OPTIONS = Array.from({ length: 28 }, (_, i) => i + 5);
const BIO_MAX = 600;
const h2 = "flex items-center gap-2 text-card-title text-dark [&>svg]:size-5 [&>svg]:text-dark-300";
const field = "flex flex-col gap-1.5";
const help = "text-caption text-dark-300";

type EditCoach = CoachProfileData & {
  image_url?: string | null;
  profile_image_url?: string | null;
  cover_image_urls?: string[] | null;
};

export const OwnProfileEditor = ({
  coach,
  packages,
  storedServices,
  services,
  mostBookedId,
  pillarOptions,
  brands,
  averageRating,
  totalReviews,
  showRating,
  reviews,
  locationLabel,
  completeness,
  cancelHours,
  windowWeeks,
  coachingVideoUrl,
  saving,
  onStep,
  onDone,
  onField,
  onPhotoSelect,
  onEditPackage,
  onEditCertifications,
  onManageBrands,
  onSharePricing,
  onVideo,
  onCoachUpdated,
}: {
  /** The coach with the draft applied. */
  coach: EditCoach;
  packages: CoachPackage[];
  /** coaches.profile_services as saved. */
  storedServices: ProfileService[];
  /** Every session type, base 1-on-1 row first. */
  services: ProfileService[];
  mostBookedId: string | null;
  pillarOptions: { id: string; title: string }[];
  brands: Brand[];
  averageRating: number;
  totalReviews: number;
  showRating: boolean;
  reviews: ProfileReview[];
  locationLabel: string;
  completeness: { steps: [StepName, boolean][]; done: number };
  cancelHours: number;
  windowWeeks: number;
  coachingVideoUrl: string | null;
  saving: boolean;
  onStep: (step: StepName) => void;
  onDone: () => void;
  onField: (field: string, value: unknown) => void;
  onPhotoSelect: (file: File) => void;
  onEditPackage: (pkg: CoachPackage | null) => void;
  onEditCertifications: () => void;
  onManageBrands: () => void;
  onSharePricing: (() => void) | null;
  onVideo: () => void;
  onCoachUpdated: () => void;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const saveServices = useSaveServices(coach.id);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverSaving, setCoverSaving] = useState(false);
  const [languagesDraft, setLanguagesDraft] = useState((coach.languages || []).join(", "));
  const [placesDraft, setPlacesDraft] = useState((coach.locations || []).join(", "));
  const [editingService, setEditingService] = useState<ProfileService | null>(null);
  const [campDraft, setCampDraft] = useState<Camp | null | undefined>(undefined);

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const pillars = coach.specialties || [];
  const levels = sanitizePathwayTags(coach.pathway_tags);
  const photo = photoPreview || coach.profile_image_url || coach.image_url;
  const cover = coverPreview || coach.cover_image_urls?.[0];
  const bio = hasRichTextMarkup(coach.bio) ? stripRichTextToPlainText(coach.bio) : coach.bio ?? "";
  const individual = services.filter((s) => s.on && s.format === "individual" && s.price > 0);
  const from = individual.length ? Math.min(...individual.map((s) => s.price)) : 0;
  const sortedPackages = packages.filter((pkg) => packageKind(pkg) !== "camp").sort((a, b) => a.total_price - b.total_price);

  const togglePillar = (title: string) => {
    const on = pillars.includes(title);
    if (on && pillars.length === 1) {
      toast({ title: "Keep at least one pillar" });
      return;
    }
    onField("specialties", on ? pillars.filter((p) => p !== title) : [...pillars, title]);
  };

  // The four levels from sign-up; anything else stored earlier drops off on the next change.
  const toggleLevel = (level: LevelTag) => {
    const current = levels.filter((l): l is LevelTag => (LEVEL_TAGS as readonly string[]).includes(l));
    const on = current.includes(level);
    if (on && current.length === 1) {
      toast({ title: "Keep at least one level" });
      return;
    }
    onField("pathway_tags", LEVEL_TAGS.filter((l) => (l === level ? !on : current.includes(l))));
  };

  const uploadCover = async (file: File) => {
    setCoverSaving(true);
    try {
      await coachProfileAPI.setCover(coach.id, file, coach.cover_image_urls ?? []);
      setCoverPreview(URL.createObjectURL(file));
      toast({ title: "Cover photo updated" });
      onCoachUpdated();
    } catch (err) {
      toast({ title: "Couldn't upload the cover", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
    } finally {
      setCoverSaving(false);
    }
  };

  /* Session types. The base row's price and place are coach fields saved on Done; the rest live in profile_services. */
  const persist = async (next: ProfileService[]) => {
    try {
      await saveServices(next);
      return true;
    } catch (err) {
      toast({ title: "Couldn't save session types", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
      return false;
    }
  };
  const withStored = (s: ProfileService) =>
    storedServices.some((x) => x.id === s.id) ? storedServices.map((x) => (x.id === s.id ? s : x)) : s.id === BASE_SERVICE_ID ? [s, ...storedServices] : [...storedServices, s];

  const saveService = async (next: ProfileService) => {
    if (next.id !== BASE_SERVICE_ID) return persist(withStored(next));
    const base = services.find((s) => s.id === BASE_SERVICE_ID);
    if (next.price !== (Number(coach.hourly_rate) || 0)) onField("hourly_rate", next.price);
    if (next.where !== base?.where) onField("session_types", sessionTypesFromWhere(next.where));
    const sameDetails = base && next.name === base.name && next.minutes === base.minutes;
    const stored = storedServices.some((x) => x.id === BASE_SERVICE_ID);
    // A stored base row overrides session_types for "where", so it has to follow a place change.
    if (sameDetails && (!stored || next.where === base.where)) return true;
    return persist(withStored({ ...next, price: 0 }));
  };
  const toggleService = (s: ProfileService) => void persist(withStored({ ...s, on: !s.on, price: s.id === BASE_SERVICE_ID ? 0 : s.price }));
  const deleteService = (id: string) => persist(storedServices.filter((s) => s.id !== id));

  const setPackageActive = async (pkg: CoachPackage, active: boolean) => {
    const res = await packagesAPI.updateCoachPackage(pkg.id, { is_active: active });
    if (res.error) {
      toast({ title: "Couldn't update the package", description: res.error.message, variant: "destructive" });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["coach-packages", coach.id] });
    if (!active)
      toast({
        title: "Package removed",
        description: "Families who bought it keep their credits. It just stops being sold.",
        action: (
          <ToastAction altText="Undo remove package" onClick={() => void setPackageActive(pkg, true)}>
            Undo
          </ToastAction>
        ),
      });
  };


  const serviceRow = (s: ProfileService) => (
    <div key={s.id} className="flex items-center gap-[10px] py-[10px] [&+&]:border-t [&+&]:border-light-525">
      <div className={cn("flex min-w-0 flex-1 flex-col gap-1", !s.on && "opacity-55")}>
        <span className="text-label-sm text-dark">{s.name}</span>
        <span className={caption}>
          {s.minutes} min · {s.where}
        </span>
      </div>
      <span className={cn("text-label-sm tabular-nums text-dark", !s.on && "opacity-55")}>{s.price ? money(s.price) : "Not set"}</span>
      <Switch checked={s.on} onCheckedChange={() => toggleService(s)} aria-label={`Show ${s.name}`} />
      <button type="button" className={cn(iconButton, "size-[30px] border-0 bg-transparent")} aria-label={`Edit ${s.name}`} onClick={() => setEditingService(s)}>
        <Pencil strokeWidth={1.5} />
      </button>
    </div>
  );
  const serviceCol = (title: string, sub: string, list: ProfileService[]) =>
    list.length ? (
      <div className="flex min-w-0 flex-col rounded-card bg-light-400 px-[14px] pb-1 pt-3">
        <div className="flex items-baseline justify-between gap-2 pb-1">
          <span className={label}>{title}</span>
          {sub ? <span className={caption}>{sub}</span> : null}
        </div>
        {list.map(serviceRow)}
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-card border border-primary-300 bg-primary-50 px-4 py-3 text-primary-700">
        <Pencil className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
        <p className="min-w-0 flex-1 text-body-m">
          <b className="font-medium">Editing your profile.</b> Changes save when you press Done.
        </p>
        <button type="button" className={cn(primaryButton, smallButton)} onClick={onDone} disabled={saving}>
          {saving ? "Saving…" : "Done"}
        </button>
      </div>

      <PageHeader title="My profile" subtitle="Update anything families see. Turn off what you don't want shown." />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_317px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className={card} aria-label="Your profile">
            <div
              className={cn(
                "relative flex h-[150px] items-center justify-center gap-2 overflow-hidden rounded-control px-4 text-center font-medium",
                cover ? "bg-light-550 text-dark-400" : "border border-dashed border-light-600 bg-light-400 text-dark-300"
              )}
            >
              {cover ? (
                <img src={cover} alt="" className="absolute inset-0 size-full object-cover" />
              ) : (
                <>
                  <ImageIcon className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  <span>No cover photo yet</span>
                </>
              )}
              <label className={cn(secondaryButton, smallButton, "absolute bottom-3 right-3 cursor-pointer", coverSaving && "pointer-events-none opacity-50")}>
                <Upload strokeWidth={1.5} aria-hidden="true" />
                {coverSaving ? "Uploading…" : cover ? "Change cover" : "Add cover"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void uploadCover(file);
                  }}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-start gap-3">
              <div className="flex flex-col items-center gap-1.5">
                <Avatar name={coach.name} src={photo} size={64} />
                <label className={cn(textButton, "cursor-pointer text-caption")}>
                  {photo ? "Change photo" : "Add photo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      onPhotoSelect(file);
                      setPhotoPreview(URL.createObjectURL(file));
                    }}
                  />
                </label>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-section text-dark">{coach.name}</span>
                  {coach.is_verified ? <BadgeCheck className="size-5 shrink-0 text-primary" strokeWidth={1.5} aria-label="Verified" /> : null}
                  {coach.sport ? <BrandPill tone="teal">{coach.sport.charAt(0).toUpperCase() + coach.sport.slice(1)}</BrandPill> : null}
                </div>
                <div className="grid max-w-[420px] grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className={field}>
                    <span className={label}>Title</span>
                    <input
                      className={input}
                      placeholder="Private coach"
                      value={coach.coach_position ?? coach.position ?? ""}
                      onChange={(e) => onField("coach_position", e.target.value)}
                    />
                  </label>
                  <label className={field}>
                    <span className={label}>ZIP code</span>
                    <input
                      className={input}
                      inputMode="numeric"
                      maxLength={5}
                      placeholder="78701"
                      value={coach.zip_code ?? ""}
                      onChange={(e) => onField("zip_code", e.target.value.replace(/\D/g, "").slice(0, 5))}
                    />
                    {locationLabel ? <span className={help}>Shows as {locationLabel}</span> : null}
                  </label>
                </div>
              </div>
            </div>

            <div className={field}>
              <span className={label}>Pillars you coach</span>
              <div className="flex flex-wrap gap-2">
                {(pillarOptions.length ? pillarOptions.map((o) => o.title) : pillars).map((title) => {
                  const on = pillars.includes(title);
                  return (
                    <button key={title} type="button" aria-pressed={on} className={chip(on)} onClick={() => togglePillar(title)}>
                      {on ? <Check strokeWidth={2} aria-hidden="true" /> : null}
                      {title}
                    </button>
                  );
                })}
              </div>
              <span className={help}>Families filter the marketplace by pillar.</span>
            </div>

            <div className={field}>
              <span className={label}>Levels you coach</span>
              <div className="flex flex-wrap gap-2">
                {LEVEL_OPTIONS.map(({ label: levelName, tag }) => {
                  const on = levels.includes(tag);
                  return (
                    <button key={tag} type="button" aria-pressed={on} className={chip(on)} onClick={() => toggleLevel(tag)}>
                      {on ? <Check strokeWidth={2} aria-hidden="true" /> : null}
                      {levelName}
                    </button>
                  );
                })}
              </div>
              <span className={help}>Shown on your profile. The same four levels athletes pick when they sign up.</span>
            </div>

            <label className={field}>
              <span className={label}>About you</span>
              <textarea
                className={cn(input, "h-auto py-2 text-paragraph")}
                rows={4}
                maxLength={Math.max(BIO_MAX, bio.length)}
                placeholder="Your background, who you coach and how a session runs"
                value={bio}
                onChange={(e) => onField("bio", e.target.value)}
              />
              <span className={cn(help, bio.length > BIO_MAX && "text-error-700")}>
                {bio.length} of {BIO_MAX} characters
              </span>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-control bg-light-400 px-4 py-3">
              <span className="flex min-w-0 items-center gap-2.5">
                <Video className="size-4 shrink-0 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-label-sm text-dark">Coaching video</span>
                  <span className={cn(caption, "truncate")}>{coachingVideoUrl || "A 30 to 90 second clip of you coaching"}</span>
                </span>
              </span>
              <button type="button" className={cn(secondaryButton, smallButton)} onClick={onVideo}>
                {coachingVideoUrl ? "Change" : "Add video"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-light-525 pt-[14px] md:grid-cols-4">
              {[
                ["Individual sessions", from ? `From ${money(from)}` : "Not set"],
                ["Locations", (coach.locations ?? []).join(", ") || locationLabel || "Not set"],
                ["Usually replies", repliesLabel(coach.response_time_hours)],
                ["Verified", coach.is_verified ? "Yes" : "Not yet"],
              ].map(([l, v]) => (
                <div key={l} className="flex min-w-0 flex-col gap-1">
                  <span className={label}>{l}</span>
                  <span className="break-words text-label-sm text-dark">{v}</span>
                </div>
              ))}
            </div>
          </section>

          <section className={card} aria-label="Sessions and packages">
            <div className="flex items-center justify-between gap-3">
              <h2 className={h2}>
                <Layers strokeWidth={1.5} aria-hidden="true" />
                Sessions and packages
              </h2>
              {onSharePricing ? (
                <button type="button" className={cn(secondaryButton, smallButton)} onClick={onSharePricing}>
                  <Upload strokeWidth={1.5} aria-hidden="true" />
                  Share pricing
                </button>
              ) : null}
            </div>
            <span className={label}>Packages</span>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
              {sortedPackages.map((p) => (
                <div key={p.id} className="flex flex-col gap-1.5 rounded-control bg-light-400 px-4 py-[14px]">
                  {p.id === mostBookedId ? (
                    <BrandPill tone="blue" className="self-start">
                      Most booked
                    </BrandPill>
                  ) : null}
                  {!p.is_active ? (
                    <BrandPill tone="muted" className="self-start">
                      Not for sale
                    </BrandPill>
                  ) : null}
                  <span className={cn("text-label-sm text-dark", !p.is_active && "opacity-60")}>{p.package_name}</span>
                  <span className={cn("text-highlight text-dark", !p.is_active && "opacity-60")}>{money(p.total_price / 100)}</span>
                  <span className={caption}>
                    {money(p.total_price / 100 / Math.max(1, p.session_count))} per session · valid {p.validity_days} days
                  </span>
                  <div className="flex items-center gap-3 pt-1">
                    <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => onEditPackage(p)}>
                      Edit
                    </button>
                    {p.is_active ? (
                      <button type="button" className={cn(textButton, "text-dark-300")} onClick={() => void setPackageActive(p, false)}>
                        Remove
                      </button>
                    ) : (
                      <button type="button" className={textButton} onClick={() => void setPackageActive(p, true)}>
                        Sell again
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="flex min-h-[80px] items-center justify-center gap-2 rounded-control border border-dashed border-light-600 bg-light-400 text-label-sm text-primary hover:border-primary-300"
                onClick={() => onEditPackage(null)}
              >
                <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Add package
              </button>
              <button
                type="button"
                className="flex min-h-[80px] items-center justify-center gap-2 rounded-control border border-dashed border-light-600 bg-light-400 text-label-sm text-primary hover:border-primary-300"
                onClick={() => setCampDraft(null)}
              >
                <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Add camp
              </button>
            </div>

            <CampEditorList coachId={coach.id} mostBookedId={mostBookedId} onEdit={(camp) => setCampDraft(camp)} />

            <span className={cn(label, "-mb-1.5")}>Single sessions</span>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
              {serviceCol("1-on-1", "", services.filter((s) => s.format !== "group"))}
              {serviceCol("Group", "Price per athlete", services.filter((s) => s.format === "group"))}
            </div>
            <button
              type="button"
              className={cn(textButton, "self-start")}
              onClick={() => setEditingService({ id: "new", name: "", format: "individual", minutes: 60, where: "In person", price: 0, on: true })}
            >
              <Plus strokeWidth={1.5} aria-hidden="true" />
              Add session type
            </button>
            <div className="flex items-start gap-[10px] rounded-control bg-light-400 px-[14px] py-3 text-caption text-dark-300">
              <ShieldCheck className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span>
                {cancelHours} hours notice for a session credit. Booking up to {windowWeeks} weeks ahead.{" "}
                <Link to={ROUTES.SCHEDULE_SETTINGS} className="font-medium text-primary hover:underline">
                  Edit booking rules
                </Link>
              </span>
            </div>
          </section>

          <section className={card} aria-label="Certifications and credentials">
            <h2 className={h2}>
              <Award strokeWidth={1.5} aria-hidden="true" />
              Certifications and credentials
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(coach.certifications ?? [])
                .filter((cert) => (cert.certification_name ?? "").trim().toLowerCase() !== "background check")
                .map((cert, i) => (
                <div key={cert.id ?? i} className="flex items-center gap-3 rounded-card border border-light-525 bg-light-400 p-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-control border border-success-300 bg-success-100 text-success-700">
                    <Check className="size-4" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-subtitle">{cert.certification_name || "Certification"}</span>
                    {cert.issuing_organization ? <span className={caption}>{cert.issuing_organization}</span> : null}
                  </span>
                </div>
              ))}
              <button
                type="button"
                className="flex min-h-[80px] items-center justify-center gap-2 rounded-control border border-dashed border-light-600 bg-light-400 text-label-sm text-primary hover:border-primary-300"
                onClick={onEditCertifications}
              >
                {coach.certifications?.length ? <Pencil className="size-4" strokeWidth={1.5} aria-hidden="true" /> : <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />}
                {coach.certifications?.length ? "Add or edit credentials" : "Add credential"}
              </button>
            </div>
          </section>

          <OwnReviews coachId={coach.id} averageRating={averageRating} totalReviews={totalReviews} showRating={showRating} fallback={reviews} />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <section className={card} aria-label="Profile completeness">
            <CompletenessList {...completeness} onStep={onStep} />
            <span className={caption}>Complete profiles show first in marketplace search.</span>
          </section>

          {/* Quick info and FAQs are managed by AthaNext in the database, not typed in by coaches
              (Michael's change log, 2026-10-19). Families still see them on the profile. */}
          <section className={card} aria-label="Quick info and FAQs">
            <h2 className={h2}>Quick info and FAQs</h2>
            <p className={help}>AthaNext keeps these up to date for every coach. To change yours, message support from Help.</p>
          </section>

          <GearAndDealsCard
            coachId={coach.id}
            coachName={coach.name}
            links={coach.affiliate_links}
            dealsEnabled={coach.deals_enabled}
            brandNames={brands.map((b) => b.name)}
            isOwner
            editing
            onDealsEnabledChange={(on) => onField("deals_enabled", on)}
            onSaved={onCoachUpdated}
          />

          <section className={card} aria-label="Organizations">
            <div className="flex items-center justify-between gap-3">
              <h2 className={h2}>Organizations</h2>
              <button type="button" className={cn(secondaryButton, smallButton)} onClick={onManageBrands}>
                Manage
              </button>
            </div>
            <BrandLogos brands={organizationsForProfile(coach.id, brands)} />
            <span className={caption}>Logos show near the top of your profile. Matching gear shows first under Gear and deals.</span>
          </section>
        </div>
      </div>

      <ServiceEditorDialog service={editingService} onClose={() => setEditingService(null)} onSave={saveService} onDelete={deleteService} />
      <CampEditorDialog
        open={campDraft !== undefined}
        camp={campDraft ?? null}
        coachId={coach.id}
        onOpenChange={(open) => {
          if (!open) setCampDraft(undefined);
        }}
      />
    </div>
  );
};
