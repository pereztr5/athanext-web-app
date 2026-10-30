import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { type Camp } from "@/api/packages";
import type { CampRegisterResult } from "@/components/camps/CampCards";
import { ChevronLeft } from "@/components/icons";
import { formatRichTextForRender } from "@/utils/richText";
import type { ProfileData } from "@/utils/profileCompletion";
import { fetchLocationFromZipCode, formatLocationDisplay } from "@/utils/geolocation";
import { normalizeCoachFaqs } from "./FAQSection";
import type { CoachPackage } from "@/hooks/useCoachPackages";
import { ROUTES } from "@/routes";
import { isPublicCoachRatingVisible } from "@/utils/publicRating";
import { useCoachBrands } from "@/hooks/useBrands";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useBack } from "@/hooks/useBack";
import { BuyPackagesDialog } from "@/components/book/BuyPackagesDialog";
import type { Brand } from "@/utils/brands";
import { agesLine, cancellationLine, coachesLine, coachTitle, withBaseService } from "./own/shared";
import { campPagePathFor, ownCampPath } from "@/utils/camps";
import { detectCoachSport } from "@/utils/coachSport";
import { CoachIntroCallCard } from "@/components/intro-calls";
import { WhoCard } from "./family/WhoCard";
import { AboutCard } from "./family/AboutCard";
import { OrganizationsCard } from "./OrganizationsCard";
import { useCoachOrganizations } from "./useCoachOrganizations";
import { PricingCard, type SessionRow } from "./family/PricingCard";
import { REVIEWS_ANCHOR, ReviewsCard } from "./family/ReviewsCard";
import { MoreList } from "./family/MoreList";
import { useCoachExtras, useFamilyReviews, useIsMyCoach } from "./family/hooks";
import { money } from "./family/styles";

const NO_BRANDS: Brand[] = [];

export interface ProfileReview {
  id: string;
  coach_id: string;
  rating: number;
  review_text?: string;
  created_at: string;
  reviewer_name?: string;
}

export type CoachProfileData = ProfileData & {
    id: string;
    name: string;
    slug?: string;
    bio?: string;
    coach_position?: string;
    position?: string;
    /** Picked on Edit profile; coachTitle() falls back to the positions they coach. */
    title?: string | null;
    specialties?: string[];
    pathway_tags?: string[];
    session_types?: string[];
    languages?: string[];
    locations?: string[];
    zip_code?: string;
    cancellation_policy?: string;
    response_time_hours?: number;
    profile_faqs?: { id: string; question: string; answer: string }[] | null;
    company?: string;
    affiliate_links?: unknown;
    is_verified?: boolean;
    hourly_rate?: number;
    sport?: string | null;
    certifications?: {
      id?: string;
      certification_name?: string;
      issuing_organization?: string | null;
    }[];
    rating?: number;
    deals_enabled?: boolean | null;
    pay_mode?: string | null;
    pay_note?: string | null;
    age_min?: number | null;
    age_max?: number | null;
    new_family_booking?: string | null;
    cancel_notice_hours?: number | null;
    favourite_positions?: string[] | null;
    positions?: string[] | null;
    instagram_handle?: string | null;
};

interface CoachProfileViewProps {
  coach: CoachProfileData;
  packages: CoachPackage[];
  averageRating: number;
  totalReviews: number;
  /** Shown until the full review rows (with replies) load. */
  reviews: ProfileReview[];
  /** Families can book; coaches looking at another coach can't. */
  canBook: boolean;
  /** Opens a chat with the coach. */
  onMessage?: () => void;
  messaging?: boolean;
}

/**
 * A coach's profile as families see it (Working Copy `a-coach`, `AN.simpleProfile`): who with
 * Book and Message, About, Sessions and pricing, Reviews, and a short More list, in one 720px column.
 */
export function CoachProfileView({
  coach,
  packages,
  averageRating,
  totalReviews,
  reviews: fallbackReviews,
  canBook,
  onMessage,
  messaging = false,
}: CoachProfileViewProps) {
  const { user, userProfile } = useAuth();
  const isOwn = Boolean(userProfile?.coach_id) && userProfile?.coach_id === coach.id;
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { back, canGoBack } = useBack(ROUTES.COACHES);
  const [city, setCity] = useState<string>("");
  const [buying, setBuying] = useState<string | null>(null);
  const { data: brands = NO_BRANDS } = useCoachBrands(coach.id);
  const organizations = useCoachOrganizations(coach.id);
  const { data: fullReviews } = useFamilyReviews(coach.id);
  const extras = useCoachExtras(coach.id);
  const isMyCoach = useIsMyCoach(coach.id);
  const first = coach.name.split(" ")[0] || "This coach";
  const role = coachTitle(coach);
  const showRating = isPublicCoachRatingVisible(totalReviews, averageRating);
  const reviews = fullReviews ?? fallbackReviews;

  useEffect(() => {
    let cancelled = false;
    if (!coach.zip_code) {
      setCity("");
      return;
    }
    fetchLocationFromZipCode(coach.zip_code).then((info) => {
      if (!cancelled) setCity(info ? formatLocationDisplay(info) : "");
    });
    return () => {
      cancelled = true;
    };
  }, [coach.zip_code]);

  const activePackages = packages.filter((pkg) => pkg.is_active !== false);
  const hourly = Number(coach.hourly_rate) || 0;
  const heroCity = coach.locations?.[0] || city;
  const place = (coach.locations ?? []).filter((l) => l && l !== "Video call").join(", ") || city;
  const paysDirect = coach.pay_mode === "self";

  // Same rows the coach sees on their own profile: the base 1-on-1 priced from hourly_rate, then the rest.
  const sessions: SessionRow[] = withBaseService(extras?.services ?? [], coach)
    .filter((s) => s.on)
    .map((s) => ({
      key: s.id,
      name: s.name,
      detail: `${s.minutes} min · ${s.where}`,
      price: s.price,
      unit: s.format === "group" ? "per athlete" : "",
    }));
  const individualPrices = sessions.filter((s) => !s.unit && s.price > 0).map((s) => s.price);
  const from = individualPrices.length ? Math.min(...individualPrices) : hourly;

  const listedOrg = organizations[0];
  const academy = listedOrg ? { name: listedOrg.name, to: `/organizations/${listedOrg.slug}` } : null;

  const facts: [string, string][] = (
    [
      ["1-on-1 from", from ? money(from) : ""],
      ["Where", place],
      ["Speaks", (coach.languages ?? []).join(", ")],
    ] as [string, string][]
  ).filter(([, value]) => value);

  const needsRequest = coach.new_family_booking === "request" && !isMyCoach;
  const cancellation = cancellationLine(coach.cancel_notice_hours, coach.cancellation_policy);

  const coaches = coachesLine(coach);
  const credentials = (coach.certifications ?? [])
    .map((c) => c.certification_name?.trim() ?? "")
    .filter((name) => name && name.toLowerCase() !== "background check");
  const faqs = normalizeCoachFaqs(coach.profile_faqs).filter((faq) => faq.question?.trim() && faq.answer?.trim());

  const book = () => {
    if (!user) {
      navigate(`${ROUTES.AUTH}?mode=signin`, { state: { from: { pathname: ROUTES.BOOK, search: `?coach=${coach.id}` } } });
      return;
    }
    navigate(`${ROUTES.BOOK}?coach=${coach.id}`, { state: { from: location } });
  };

  const registerCamp = async (camp: Camp): Promise<CampRegisterResult> => {
    if (isOwn) {
      // Same camp page as on Camps, with the coach's Edit camp / Registrations bar.
      const own = ownCampPath(coach.slug, camp.slug);
      if (own) {
        navigate(own);
        return { redirect: true, message: null };
      }
      toast({ title: "This is your own profile", description: "Families register for your camps here." });
      return { redirect: false, message: null };
    }
    // Camps always use /:coach/:camp → camp-signup. Never open package Checkout (dual capacity).
    const page = campPagePathFor(coach.slug, camp);
    if (page) {
      navigate(page);
      return { redirect: true, message: null };
    }
    return {
      redirect: false,
      message: "This camp isn't open for registration yet. Ask the coach for their camp link.",
    };
  };

  const buy = (pkg: CoachPackage) => {
    if (isOwn) {
      toast({ title: "This is your own profile", description: "Families buy your packages here." });
      return;
    }
    if (!user) {
      navigate(`${ROUTES.AUTH}?mode=signin`);
      return;
    }
    setBuying(pkg.id);
  };

  const scrollToReviews = () => document.getElementById(REVIEWS_ANCHOR)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-wrapper flex-col gap-4">
        <button
          type="button"
          onClick={back}
          className="inline-flex w-fit items-center gap-1 text-label-sm text-dark-300 hover:text-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden="true" />
          {canGoBack ? "Back" : "All coaches"}
        </button>

        <WhoCard
          name={coach.name}
          photoUrl={coach.profile_image_url || coach.image_url}
          verified={Boolean(coach.is_verified)}
          role={role}
          city={heroCity}
          academy={academy}
          rating={averageRating}
          totalReviews={totalReviews}
          showRating={showRating}
          onReviews={scrollToReviews}
          onBook={canBook ? book : null}
          bookLabel={needsRequest ? "Request a session" : "Book a session"}
          onMessage={isOwn ? undefined : onMessage}
          messaging={messaging}
          facts={facts}
          instagram={coach.instagram_handle}
          intro={<CoachIntroCallCard coachId={coach.id} mode="family" coachFirstName={first} />}
        />

        <OrganizationsCard brands={organizations} />

        <AboutCard
          coaches={coaches}
          ages={agesLine(coach)}
          levels={coach.pathway_tags ?? []}
          pillars={(coach.specialties ?? []).filter(Boolean)}
          bioHtml={formatRichTextForRender(coach.bio)}
          credentials={credentials}
        />

        <PricingCard
          coachId={coach.id}
          first={first}
          packages={activePackages}
          sessions={sessions}
          cancellation={cancellation}
          paysDirect={paysDirect}
          buying={null}
          onBuy={buy}
          onAsk={onMessage}
          onRegister={registerCamp}
          openCamp={(camp) => (isOwn ? ownCampPath(coach.slug, camp.slug) : campPagePathFor(coach.slug, camp))}
          coverFallback={coach.profile_image_url || coach.image_url || null}
          mostBookedId={extras?.mostBookedPackageId}
        />

        {totalReviews > 0 || reviews.length ? (
          <ReviewsCard first={first} reviews={reviews} rating={averageRating} totalReviews={totalReviews} showRating={showRating} />
        ) : null}

        <MoreList
          coachId={coach.id}
          first={first}
          faqs={faqs}
          affiliateLinks={coach.affiliate_links}
          dealsEnabled={coach.deals_enabled}
          brandNames={brands.map((brand) => brand.name)}
          coachSport={detectCoachSport(coach)}
        />
      </div>
      <BuyPackagesDialog
        coach={buying ? { id: coach.id, name: coach.name, slug: coach.slug ?? null, paysDirect, credits: 0 } : null}
        initialPackageId={buying}
        onClose={() => setBuying(null)}
      />
    </div>
  );
}
