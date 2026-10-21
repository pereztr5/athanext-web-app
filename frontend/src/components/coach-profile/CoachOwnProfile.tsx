/**
 * My Profile for coaches (Working Copy c-profile). The view is what families see in one column;
 * Edit profile opens the full editor. Text fields are a draft that Profile.tsx saves on Done.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchLocationFromZipCode, formatLocationDisplay } from "@/utils/geolocation";
import { useFAQItems } from "@/hooks/useFAQItems";
import type { CoachPackage } from "@/hooks/useCoachPackages";
import { useToast } from "@/hooks/use-toast";
import { useCoachBrands } from "@/hooks/useBrands";
import { isPublicCoachRatingVisible } from "@/utils/publicRating";
import { coachProfilePath, coachProfileUrl } from "@/utils/coachSlug";
import { recordCoachShareEvent } from "@/api/coachShare";
import { ROUTES } from "@/routes";
import type { Brand } from "@/utils/brands";
import { ManageBrandsDialog } from "./ManageBrandsDialog";
import { OwnProfilePreview } from "./OwnProfilePreview";
import { SharePricingDialog } from "./SharePricingDialog";
import type { CoachFaqItem } from "./FAQSection";
import type { CoachProfileData, ProfileReview } from "./CoachProfileView";
import { OwnProfileEditor } from "./own/OwnProfileEditor";
import { useBookingRules, useCompleteness, useOwnOrganization, useProfileExtras, type StepName } from "./own/hooks";
import { withBaseService } from "./own/shared";

const NO_BRANDS: Brand[] = [];

/** The coach's editable fields while Edit profile is on. */
export type CoachDraft = Partial<CoachProfileData> & {
  profile_faqs?: CoachFaqItem[] | null;
  deals_enabled?: boolean | null;
};

interface CoachOwnProfileProps {
  coach: CoachProfileData;
  packages: CoachPackage[];
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  reviews: ProfileReview[];
  pillarOptions: { id: string; title: string }[];
  editing: boolean;
  draft: CoachDraft | null;
  saving: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onDone: () => void;
  onField: (field: string, value: unknown) => void;
  onPhotoSelect: (file: File) => void;
  onEditPackage: (pkg: CoachPackage | null) => void;
  onEditCertifications: () => void;
  onCoachUpdated: () => void;
}

export function CoachOwnProfile({
  coach,
  packages,
  averageRating,
  totalReviews,
  reviews,
  pillarOptions,
  editing,
  draft,
  saving,
  onStartEdit,
  onDone,
  onField,
  onPhotoSelect,
  onEditPackage,
  onEditCertifications,
  onCoachUpdated,
}: CoachOwnProfileProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const c: CoachProfileData & CoachDraft = editing && draft ? { ...coach, ...draft } : coach;
  const [locationLabel, setLocationLabel] = useState(coach.locations?.[0] || "");
  const [sharePricingOpen, setSharePricingOpen] = useState(false);
  const [brandsOpen, setBrandsOpen] = useState(false);
  const [slug, setSlug] = useState(coach.slug || "");
  const { data: platformFaqs = [] } = useFAQItems("general");
  const { data: brands = NO_BRANDS } = useCoachBrands(coach.id);
  const { data: extras } = useProfileExtras(coach.id);
  const organization = useOwnOrganization(extras);
  const { cancelHours, cancellation, windowWeeks } = useBookingRules();
  const completeness = useCompleteness(coach, extras);
  const showRating = isPublicCoachRatingVisible(totalReviews, averageRating);

  useEffect(() => setSlug(coach.slug || ""), [coach.slug]);

  const zip = c.zip_code;
  useEffect(() => {
    let cancelled = false;
    if (!zip || zip.length < 5) {
      setLocationLabel(coach.locations?.[0] || "");
      return;
    }
    fetchLocationFromZipCode(zip).then((info) => {
      if (!cancelled) setLocationLabel(info ? formatLocationDisplay(info) : coach.locations?.[0] || "");
    });
    return () => {
      cancelled = true;
    };
  }, [zip, coach.locations]);

  const shownFaqs = useMemo(() => {
    const owned = (Array.isArray(coach.profile_faqs) ? coach.profile_faqs : []).filter((faq) => faq.question?.trim() && faq.answer?.trim());
    if (owned.length) return owned;
    return platformFaqs.slice(0, 5).map((faq) => ({
      id: faq.id,
      question: faq.question?.en || Object.values(faq.question || {})[0] || "",
      answer: faq.answer?.en || Object.values(faq.answer || {})[0] || "",
    })).filter((faq) => faq.question && faq.answer);
  }, [coach.profile_faqs, platformFaqs]);

  const storedServices = extras?.services ?? [];
  const visibleServices = withBaseService(storedServices, coach).filter((s) => s.on);

  const handleShare = async () => {
    if (slug) {
      setSharePricingOpen(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(coachProfileUrl(coach.id));
      void recordCoachShareEvent(coach.id, "profile_share");
      toast({ title: "Profile link copied" });
    } catch {
      toast({ title: "Could not copy link", variant: "destructive" });
    }
  };

  const onStep = (step: StepName) => {
    if (step === "Certifications") onEditCertifications();
    else if (step === "Payout details") navigate(`${ROUTES.SETTINGS}?tab=booking`);
    else if (step === "Availability") navigate(ROUTES.SCHEDULE);
    else {
      if (!editing) onStartEdit();
      toast({ title: step === "Profile photo" ? "Use Add photo under your picture" : "Fill it in on your profile" });
    }
  };

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto w-full max-w-wrapper">
        {editing ? (
          <OwnProfileEditor
            coach={c}
            packages={packages}
            storedServices={storedServices}
            services={withBaseService(storedServices, c, true)}
            mostBookedId={extras?.mostBookedPackageId ?? null}
            pillarOptions={pillarOptions}
            brands={brands}
            averageRating={averageRating}
            totalReviews={totalReviews}
            showRating={showRating}
            reviews={reviews}
            locationLabel={locationLabel}
            completeness={completeness}
            cancelHours={cancelHours}
            windowWeeks={windowWeeks}
            saving={saving}
            onStep={onStep}
            onDone={onDone}
            onField={onField}
            onPhotoSelect={onPhotoSelect}
            onEditPackage={onEditPackage}
            onEditCertifications={onEditCertifications}
            onManageBrands={() => setBrandsOpen(true)}
            onSharePricing={slug ? () => setSharePricingOpen(true) : null}
            onCoachUpdated={onCoachUpdated}
          />
        ) : (
          <OwnProfilePreview
            coach={coach}
            packages={packages}
            services={visibleServices}
            extras={extras}
            averageRating={averageRating}
            totalReviews={totalReviews}
            showRating={showRating}
            reviews={reviews}
            locationLabel={locationLabel}
            organization={organization}
            faqs={shownFaqs}
            brandNames={brands.map((brand) => brand.name)}
            cancellation={cancellation}
            completeness={completeness}
            previewHref={coachProfilePath(slug || coach.id)}
            onStep={onStep}
            onStartEdit={onStartEdit}
            onShare={() => void handleShare()}
          />
        )}
      </div>

      <ManageBrandsDialog open={brandsOpen} onOpenChange={setBrandsOpen} coachId={coach.id} currentBrands={brands} />

      {slug ? (
        <SharePricingDialog
          open={sharePricingOpen}
          onOpenChange={setSharePricingOpen}
          coach={{
            id: coach.id,
            name: coach.name,
            slug,
            sport: coach.sport,
            coach_position: coach.coach_position,
            position: coach.position,
            specialties: coach.specialties,
            session_types: coach.session_types,
            hourly_rate: coach.hourly_rate,
            profile_image_url: coach.profile_image_url,
            image_url: coach.image_url,
            is_verified: coach.is_verified,
          }}
          packages={packages.filter((pkg) => pkg.is_active)}
          averageRating={averageRating}
          totalReviews={totalReviews}
          canEditSlug
          onSlugUpdated={setSlug}
        />
      ) : null}
    </div>
  );
}
