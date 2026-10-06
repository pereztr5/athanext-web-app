import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, ChevronDown, MessageCircle } from "lucide-react";
import { formatRichTextForRender } from "@/utils/richText";
import "@/styles/richText.css";
import type { ProfileData } from "@/utils/profileCompletion";
import { fetchLocationFromZipCode, formatLocationDisplay } from "@/utils/geolocation";
import { useFAQItems } from "@/hooks/useFAQItems";
import { normalizeCoachFaqs } from "./FAQSection";
import type { CoachPackage } from "@/hooks/useCoachPackages";
import { CoachProfileCard, CoachProfileChip } from "./CoachProfileCard";
import { GearAndDealsCard } from "./GearAndDealsCard";
import { GroupChatsCard } from "./GroupChatsCard";
import { BrandStar } from "@/components/brand";
import { ROUTES } from "@/routes";
import { cn } from "@/lib/utils";
import { isPublicCoachRatingVisible, publicCoachRatingLabel } from "@/utils/publicRating";
import { useCoachBrands } from "@/hooks/useBrands";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { packagesAPI } from "@/api/packages";
import type { Brand } from "@/utils/brands";
import { ageRangeLabel } from "@/utils/coachAges";

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
};

interface CoachProfileViewProps {
  coach: CoachProfileData;
  packages: CoachPackage[];
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  reviews: ProfileReview[];
  onLeaveReview?: () => void;
  availability?: ReactNode;
  /** Guided "Book a session" action for the header (ATH-28). */
  bookAction?: ReactNode;
  /** Opens a chat with the coach. */
  onMessage?: () => void;
  messaging?: boolean;
}

const h2 = "text-[20px] font-medium leading-[22px] tracking-[-1px] text-[#1A202C]";
const caption = "text-[12px] leading-[14px] tracking-[-0.36px] text-[#767980]";
/** Reviewers show as first name and last initial ("Casey S."). */
const shortName = (name?: string) => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A family";
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
};
const money = (dollars: number) => `$${Math.round(dollars).toLocaleString("en-US")}`;

/**
 * A coach's profile as families see it (ATH-95): header with rating, reply time, starting
 * price, Book and Message; their group chats; About with pillars; sessions and packages in one
 * list; two reviews; Good to know; gear folded at the bottom.
 */
export function CoachProfileView({
  coach,
  packages,
  averageRating,
  totalReviews,
  reviews,
  onLeaveReview,
  availability,
  bookAction,
  onMessage,
  messaging = false,
}: CoachProfileViewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [locationLabel, setLocationLabel] = useState<string>(coach.locations?.[0] || "");
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [allRows, setAllRows] = useState(false);
  const [allReviews, setAllReviews] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const { data: faqs = [] } = useFAQItems("general");
  const { data: brands = NO_BRANDS } = useCoachBrands(coach.id);
  const bioHtml = formatRichTextForRender(coach.bio);
  const first = coach.name.split(" ")[0] || "This coach";
  const position = coach.coach_position || coach.position || "Coach";
  const showPublicRating = isPublicCoachRatingVisible(totalReviews, averageRating);
  const photoUrl = coach.profile_image_url || coach.image_url;
  const pillars = (coach.specialties || []).slice(0, 6);

  useEffect(() => {
    let cancelled = false;
    if (!coach.zip_code) {
      setLocationLabel(coach.locations?.[0] || "");
      return;
    }
    fetchLocationFromZipCode(coach.zip_code).then((info) => {
      if (!cancelled) setLocationLabel(info ? formatLocationDisplay(info) : coach.locations?.[0] || "");
    });
    return () => {
      cancelled = true;
    };
  }, [coach.zip_code, coach.locations]);

  const activePackages = packages.filter((pkg) => pkg.is_active !== false);
  const sessionTypes = (coach.session_types || []).map((t) => t.replace(/-/g, " ").toLowerCase());
  const where = sessionTypes.length ? sessionTypes.join(" or ") : "in person";
  const hourly = Number(coach.hourly_rate) || 0;
  const perSession = activePackages.map((pkg) => pkg.price_per_session / 100).filter((n) => n > 0);
  const from = hourly || (perSession.length ? Math.min(...perSession) : 0);
  const responseHours = coach.response_time_hours ?? 24;
  // Booking only coaches (ATH-86) take payment themselves; packages are arranged with them.
  const paysDirect = coach.pay_mode === "self";

  const book = () => {
    if (!user) {
      navigate(`${ROUTES.AUTH}?mode=signin`, { state: { from: { pathname: ROUTES.BOOK, search: `?coach=${coach.id}` } } });
      return;
    }
    navigate(`${ROUTES.BOOK}?coach=${coach.id}`);
  };

  const buy = async (pkg: CoachPackage) => {
    if (!user) {
      navigate(`${ROUTES.AUTH}?mode=signin`);
      return;
    }
    setBuying(pkg.id);
    try {
      const payment = await packagesAPI.createPackagePayment({ package_id: pkg.id, coach_id: pkg.coach_id || coach.id });
      if (payment.error) throw new Error(payment.error.message);
      if (!payment.data?.url) throw new Error("No checkout link came back.");
      window.location.href = payment.data.url;
    } catch (err) {
      toast({ title: "Couldn't start checkout", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
      setBuying(null);
    }
  };

  const rows = [
    ...(hourly
      ? [{ key: "individual", name: "1-on-1 session", detail: `60 min · ${where}`, price: money(hourly), unit: "", action: "Book" as const }]
      : []),
    ...activePackages.map((pkg) => ({
      key: pkg.id,
      name: pkg.package_name,
      detail: [
        pkg.session_count ? `${pkg.session_count} sessions` : "",
        pkg.price_per_session ? `${money(pkg.price_per_session / 100)} per session` : "",
        pkg.description || "",
      ]
        .filter(Boolean)
        .join(" · "),
      price: money(pkg.total_price / 100),
      unit: "",
      action: "Buy" as const,
      pkg,
    })),
  ];
  const shownRows = allRows ? rows : rows.slice(0, 4);

  const ownedFaqs = normalizeCoachFaqs(coach.profile_faqs);
  const faqItems = (ownedFaqs.length
    ? ownedFaqs.filter((faq) => faq.question?.trim())
    : faqs.slice(0, 5).map((faq) => ({
        id: faq.id,
        question: faq.question?.en || Object.values(faq.question || {})[0] || "Question",
        answer: faq.answer?.en || Object.values(faq.answer || {})[0] || "",
      }))
  ).filter((faq) => faq.answer);

  const goodToKnow: [string, string][] = [
    ["Credentials", (coach.certifications || []).map((c) => c.certification_name).filter(Boolean).join(" · ")],
    ["Languages", coach.languages?.join(", ") || ""],
    ["Session types", sessionTypes.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(", ")],
    ["Ages", ageRangeLabel(coach)],
    ["Cancellation", coach.cancellation_policy || "Free cancellation with 24 hours notice"],
    ["Payment", paysDirect ? `Pay ${first} directly${coach.pay_note ? `. ${coach.pay_note}` : ""}` : ""],
  ].filter(([, value]) => value) as [string, string][];

  const shownReviews = allReviews ? reviews : reviews.slice(0, 2);

  return (
    <div className="overflow-x-hidden px-4 pb-16 md:px-10">
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6">
        <Link
          to={ROUTES.COACHES}
          className="inline-flex w-fit items-center gap-1 text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#767980]"
        >
          <ArrowLeft className="size-[15px]" strokeWidth={1.75} />
          All coaches
        </Link>

        <CoachProfileCard className="gap-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative size-[72px] shrink-0 overflow-hidden rounded-full bg-[#C1C1B8]">
              {photoUrl ? (
                <img src={photoUrl} alt={coach.name} className="absolute inset-0 size-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-[20px] font-medium text-[#484D56]">{first.slice(0, 1)}</span>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <h1 className="text-[28px] font-bold leading-[30px] tracking-[-1.2px] text-[#1A202C]">{coach.name}</h1>
                {coach.is_verified ? <BadgeCheck className="size-5 shrink-0 fill-[#0054B4] text-white" aria-label="Verified" /> : null}
              </div>
              <span className="text-[14px] text-[#767980]">{[position, locationLabel].filter(Boolean).join(" · ")}</span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#484D56]">
                {showPublicRating ? (
                  <span className="inline-flex items-center gap-1">
                    <BrandStar size={10} />
                    {publicCoachRatingLabel(averageRating, totalReviews)} · {totalReviews} {totalReviews === 1 ? "review" : "reviews"}
                  </span>
                ) : (
                  <span>New on AthaNext</span>
                )}
                <span>Replies within {responseHours === 1 ? "an hour" : `${responseHours} hours`}</span>
                {from ? <span>From {money(from)}</span> : null}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-[10px]">
            {bookAction}
            {onMessage ? (
              <button
                type="button"
                onClick={onMessage}
                disabled={messaging}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-[#EAEADF] bg-[#F4F4EB] px-4 text-[14px] font-medium text-[#1A202C] hover:bg-[#EAEADF] disabled:opacity-50"
              >
                <MessageCircle className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Message
              </button>
            ) : null}
          </div>
          <GroupChatsCard coachId={coach.id} coachFirst={first} />
        </CoachProfileCard>

        <CoachProfileCard>
          <h2 className={h2}>About</h2>
          {bioHtml ? (
            <div
              className="rich-text-content text-[14px] leading-[20px] tracking-[-0.42px] text-[#484D56]"
              dangerouslySetInnerHTML={{ __html: bioHtml }}
            />
          ) : (
            <p className="text-[14px] text-[#767980]">{position}.</p>
          )}
          {pillars.length ? (
            <div className="flex flex-wrap gap-2">
              {pillars.map((pillar) => <CoachProfileChip key={pillar} label={pillar} />)}
            </div>
          ) : null}
        </CoachProfileCard>

        {rows.length ? (
          <CoachProfileCard>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className={h2}>Sessions and packages</h2>
              <span className={caption}>{coach.cancellation_policy || "Free cancellation with 24 hours notice"}</span>
            </div>
            <ul className="flex flex-col divide-y divide-[#EAEADF]">
              {shownRows.map((row) => (
                <li key={row.key} className="flex items-center gap-3 py-3">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <b className="text-[14px] font-medium text-[#1A202C]">{row.name}</b>
                    {row.detail ? <span className={caption}>{row.detail}</span> : null}
                  </span>
                  <b className="text-[16px] font-semibold text-[#1A202C]">{row.price}</b>
                  {row.action === "Book" ? (
                    <button type="button" onClick={book} className="h-8 rounded-md bg-[#0054B4] px-3 text-[13px] font-medium text-white hover:bg-[#004390]">
                      Book
                    </button>
                  ) : paysDirect ? (
                    <button
                      type="button"
                      onClick={onMessage}
                      disabled={!onMessage || messaging}
                      className="h-8 rounded-md border border-[#EAEADF] bg-[#F4F4EB] px-3 text-[13px] font-medium text-[#1A202C] hover:bg-[#EAEADF] disabled:opacity-50"
                    >
                      Ask {first}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => "pkg" in row && row.pkg && buy(row.pkg)}
                      disabled={buying !== null}
                      className="h-8 rounded-md border border-[#EAEADF] bg-[#F4F4EB] px-3 text-[13px] font-medium text-[#1A202C] hover:bg-[#EAEADF] disabled:opacity-50"
                    >
                      {buying === row.key ? "Opening…" : "Buy"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {paysDirect && activePackages.length ? (
              <p className={caption}>{first} takes payment directly, so packages are arranged with them. Ask to buy one.</p>
            ) : null}
            {rows.length > 4 ? (
              <button type="button" className="self-start text-[14px] font-medium text-[#0054B4] hover:underline" onClick={() => setAllRows((v) => !v)}>
                {allRows ? "Show fewer" : `See all ${rows.length}`}
              </button>
            ) : null}
          </CoachProfileCard>
        ) : null}

        {availability}

        {reviews.length ? (
          <CoachProfileCard>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className={h2}>Reviews</h2>
              {showPublicRating ? (
                <span className="inline-flex items-center gap-1 text-[13px] text-[#484D56]">
                  <BrandStar size={10} />
                  {publicCoachRatingLabel(averageRating, totalReviews)} · {totalReviews} {totalReviews === 1 ? "review" : "reviews"}
                </span>
              ) : null}
            </div>
            <ul className="flex flex-col gap-3">
              {shownReviews.map((review) => (
                <li key={review.id} className="flex flex-col gap-1 rounded-[8px] bg-[#F4F4EB] px-3 py-2.5">
                  {review.review_text ? <span className="text-[14px] leading-[20px] text-[#1A202C]">"{review.review_text}"</span> : null}
                  <span className={caption}>
                    {shortName(review.reviewer_name)} · {new Date(review.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-4">
              {reviews.length > 2 ? (
                <button type="button" className="text-[14px] font-medium text-[#0054B4] hover:underline" onClick={() => setAllReviews((v) => !v)}>
                  {allReviews ? "Show fewer" : `Read all ${reviews.length}`}
                </button>
              ) : null}
              {onLeaveReview ? (
                <button type="button" className="text-[14px] font-medium text-[#0054B4] hover:underline" onClick={onLeaveReview}>
                  Write a review
                </button>
              ) : null}
            </div>
          </CoachProfileCard>
        ) : null}

        <CoachProfileCard>
          <h2 className={h2}>Good to know</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {goodToKnow.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1">
                <span className={caption}>{label}</span>
                <span className="text-[14px] text-[#1A202C]">{value}</span>
              </div>
            ))}
          </div>
          {faqItems.length ? (
            <div className="flex flex-col divide-y divide-[#EAEADF] border-t border-[#EAEADF]">
              {faqItems.map((faq) => {
                const open = openFaq === faq.id;
                return (
                  <div key={faq.id} className="py-3">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 text-left"
                      aria-expanded={open}
                      onClick={() => setOpenFaq(open ? null : faq.id)}
                    >
                      <span className="text-[14px] font-medium text-[#1A202C]">{faq.question}</span>
                      <ChevronDown className={cn("size-4 shrink-0 text-[#767980] transition-transform", open && "rotate-180")} />
                    </button>
                    {open ? <p className="mt-2 text-[14px] leading-[20px] text-[#767980]">{faq.answer}</p> : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </CoachProfileCard>

        <GearAndDealsCard
          coachId={coach.id}
          coachName={coach.name}
          links={coach.affiliate_links}
          dealsEnabled={coach.deals_enabled}
          brandNames={brands.map((brand) => brand.name)}
          folded
        />
      </div>
    </div>
  );
}
