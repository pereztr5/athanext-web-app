import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
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
import { BuyPackagesDialog } from "@/components/book/BuyPackagesDialog";
import type { Brand } from "@/utils/brands";
import { agesLine, cancellationLine, coachesLine, repliesLabel, withBaseService } from "./own/shared";
import { coachAcademy, organizationPath } from "@/utils/coachAcademy";
import { CoachIntroCallCard } from "@/components/intro-calls";
import { WhoCard } from "./family/WhoCard";
import { AboutCard } from "./family/AboutCard";
import { OrganizationsCard } from "./OrganizationsCard";
import { organizationsForProfile } from "./organizationLogos";
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
  const [city, setCity] = useState<string>("");
  const [buying, setBuying] = useState<string | null>(null);
  const { data: brands = NO_BRANDS } = useCoachBrands(coach.id);
  const { data: fullReviews } = useFamilyReviews(coach.id);
  const extras = useCoachExtras(coach.id);
  const isMyCoach = useIsMyCoach(coach.id);
  const first = coach.name.split(" ")[0] || "This coach";
  const role = coach.coach_position || coach.position || "Coach";
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

  const orgName = extras?.organization?.name || coachAcademy(coach.company);
  const academy = orgName
    ? { name: orgName, to: extras?.organization?.slug ? `/organizations/${extras.organization.slug}` : organizationPath(orgName) }
    : null;

  const facts: [string, string][] = (
    [
      ["1-on-1 from", from ? money(from) : ""],
      ["Where", place],
      ["Replies", repliesLabel(coach.response_time_hours)],
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

  const back = () => {
    if (location.key !== "default") navigate(-1);
    else navigate(ROUTES.COACHES);
  };

  const book = () => {
    if (!user) {
      navigate(`${ROUTES.AUTH}?mode=signin`, { state: { from: { pathname: ROUTES.BOOK, search: `?coach=${coach.id}` } } });
      return;
    }
    navigate(`${ROUTES.BOOK}?coach=${coach.id}`, { state: { from: location } });
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
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
        <button
          type="button"
          onClick={back}
          className="inline-flex w-fit items-center gap-1 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#767980] hover:text-[#1A202C]"
        >
          <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden="true" />
          Back
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
          intro={<CoachIntroCallCard coachId={coach.id} mode="family" coachFirstName={first} />}
        />

        <OrganizationsCard brands={organizationsForProfile(coach.id, brands)} />

        <AboutCard
          coaches={coaches}
          ages={agesLine(coach)}
          levels={coach.pathway_tags ?? []}
          pillars={(coach.specialties ?? []).filter(Boolean)}
          bioHtml={formatRichTextForRender(coach.bio)}
          credentials={credentials}
        />

        {sessions.length || activePackages.length ? (
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
            mostBookedId={extras?.mostBookedPackageId}
          />
        ) : null}

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
