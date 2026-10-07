/**
 * My Profile when not editing (Working Copy): what families see on the left (cover, name,
 * pillars, bio, facts, group chats, sessions and packages, credentials, reviews) and, on the
 * right, profile completeness, ratings, quick info, FAQ and gear.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Award, BadgeCheck, Check, ChevronDown, Eye, Hash, Image as ImageIcon, Layers, ShieldCheck, Upload } from "lucide-react";
import { payoutsAPI } from "@/api/payouts";
import type { CoachPackage } from "@/hooks/useCoachPackages";
import { BrandStar } from "@/components/brand";
import { ReviewsCard } from "@/components/reviews/ReviewsCard";
import { card, meta, secondaryButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { ageRangeLabel } from "@/utils/coachAges";
import { formatRichTextForRender } from "@/utils/richText";
import { isPublicCoachRatingVisible, publicCoachRatingLabel } from "@/utils/publicRating";
import "@/styles/richText.css";
import type { CoachProfileData, ProfileReview } from "./CoachProfileView";
import type { CoachFaqItem } from "./FAQSection";
import { GearAndDealsCard } from "./GearAndDealsCard";
import { chatAPI } from "@/api/chat";

const money = (dollars: number) => `$${Math.round(dollars).toLocaleString("en-US")}`;
const h2 = "flex items-center gap-2 text-[20px] font-medium leading-[22px] tracking-[-1px] text-[#1A202C]";

export const OwnProfilePreview = ({
  coach,
  packages,
  averageRating,
  totalReviews,
  ratingDistribution,
  reviews,
  locationLabel,
  faqs,
  brandNames,
  onSharePricing,
  onStartEdit,
  onCoachUpdated,
}: {
  coach: CoachProfileData & { cover_image_urls?: string[] | null; deals_enabled?: boolean | null };
  packages: CoachPackage[];
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  reviews: ProfileReview[];
  locationLabel: string;
  faqs: CoachFaqItem[];
  brandNames: string[];
  onSharePricing: () => void;
  onStartEdit: () => void;
  onCoachUpdated: () => void;
}) => {
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const channel = useQuery({ queryKey: ["coach-channel", coach.id, "owner"], queryFn: () => chatAPI.getCoachChannel(coach.id), staleTime: 5 * 60_000 });
  const payout = useQuery({ queryKey: ["payout-account"], queryFn: () => payoutsAPI.status(), retry: false, staleTime: 5 * 60_000 });
  const showRating = isPublicCoachRatingVisible(totalReviews, averageRating);
  const photo = coach.profile_image_url || coach.image_url;
  const cover = coach.cover_image_urls?.[0];
  const first = coach.name.split(" ")[0] || coach.name;
  const position = coach.coach_position || coach.position || "Coach";
  const pillars = coach.specialties || [];
  const hourly = Number(coach.hourly_rate) || 0;
  const active = packages.filter((p) => p.is_active !== false);
  const sessionTypes = (coach.session_types || []).map((t) => t.replace(/-/g, " "));
  const where = sessionTypes.length ? sessionTypes.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(" or ") : "In person";
  const bioHtml = formatRichTextForRender(coach.bio);
  const response = coach.response_time_hours ?? 24;

  const facts: [string, string][] = [
    ["Individual sessions", hourly ? `From ${money(hourly)}` : "Not set"],
    ["Locations", locationLabel || "Not set"],
    ["Usually replies", `Within ${response === 1 ? "an hour" : `${response} hours`}`],
    ["Verified", coach.is_verified ? "AthaNext verified" : "Not yet"],
  ];

  const checks: [string, boolean, string | null][] = [
    ["Profile photo", Boolean(photo), null],
    ["Bio", Boolean(coach.bio?.trim()), null],
    ["Pillars and pricing", pillars.length > 0 && hourly > 0, null],
    ["Locations", Boolean(coach.locations?.length || coach.zip_code), null],
    ["Ages you coach", coach.age_min != null || coach.age_max != null, null],
    ["Certifications", Boolean(coach.certifications?.length), null],
    ...(coach.pay_mode === "self"
      ? []
      : [["Payout details", Boolean(payout.data?.connected && payout.data.transfersActive), `${ROUTES.SETTINGS}?tab=booking`] as [string, boolean, string]]),
  ];
  const done = checks.filter(([, ok]) => ok).length;

  const quickInfo: [string, string][] = [
    ["Response time", `Within ${response === 1 ? "an hour" : `${response} hours`}`],
    ["Session types", where],
    ["Languages", coach.languages?.join(", ") || "Not set"],
    ["Ages", ageRangeLabel(coach) || "Not set"],
    ["Location", locationLabel || "Not set"],
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_317px]">
      <div className="flex min-w-0 flex-col gap-6">
        <section className={card}>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-[4px] bg-[#F1F1E6] px-2 py-1 text-[12px] font-medium text-[#484D56]">
            <Eye className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
            This is what families see
          </span>
          <div className="relative flex h-[160px] items-center justify-center overflow-hidden rounded-[10px] bg-[#D9D9CF] text-[14px] text-[#484D56]">
            {cover ? (
              <img src={cover} alt="" className="absolute inset-0 size-full object-cover" />
            ) : (
              <span className="flex items-center gap-2">
                <ImageIcon className="size-4" strokeWidth={1.5} aria-hidden="true" />
                No cover photo yet
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-start gap-4">
            {photo ? (
              <img src={photo} alt="" className="size-16 shrink-0 rounded-full bg-[#C1C1B8] object-cover" />
            ) : (
              <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[#E5EDF7] text-[20px] font-semibold text-[#0054B4]">
                {first.slice(0, 1)}
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex flex-wrap items-center gap-2">
                <b className="text-[24px] font-semibold tracking-[-0.04em]">{coach.name}</b>
                {coach.is_verified ? <BadgeCheck className="size-5 fill-[#0054B4] text-white" aria-label="Verified" /> : null}
                {coach.sport ? (
                  <span className="rounded-[4px] bg-[#E7F4F8] px-2 py-[3px] text-[12px] font-medium text-[#117A96]">
                    {coach.sport.charAt(0).toUpperCase() + coach.sport.slice(1)}
                  </span>
                ) : null}
              </span>
              <span className={meta}>{[position, locationLabel].filter(Boolean).join(", ")}</span>
            </div>
          </div>
          <button type="button" disabled title="Families use this button to book you" className="h-[34px] w-fit rounded-[8px] bg-[#0054B4] px-4 text-[14px] font-medium text-[#F1F1E6] opacity-50">
            Book a session
          </button>
          {showRating ? (
            <span className="flex items-center gap-2 text-[14px]">
              <BrandStar size={14} />
              <b className="font-medium">{publicCoachRatingLabel(averageRating, totalReviews)}</b>
              <span className={meta}>{totalReviews} reviews</span>
            </span>
          ) : (
            <span className={meta}>No reviews yet</span>
          )}
          {pillars.length ? (
            <div className="flex flex-wrap gap-1.5">
              {pillars.map((p) => (
                <span key={p} className="rounded-[4px] bg-[#E5EDF7] px-2 py-[3px] text-[12px] font-medium text-[#0054B4]">{p}</span>
              ))}
            </div>
          ) : null}
          {bioHtml ? (
            <div className="rich-text-content text-[14px] leading-[20px] text-[#484D56]" dangerouslySetInnerHTML={{ __html: bioHtml }} />
          ) : null}
          <div className="grid grid-cols-2 gap-4 border-t border-[#EAEADF] pt-4 sm:grid-cols-4">
            {facts.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1">
                <span className={meta}>{label}</span>
                <span className="text-[14px] font-medium">{value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={card}>
          <div className="flex flex-col gap-1">
            <h2 className={h2}>Group chats families can join</h2>
            <span className={meta}>These show on your public profile with a Join button.</span>
          </div>
          {channel.data ? (
            <Link to={`/chat?conversationId=${channel.data.conversationId}`} className="flex items-center gap-3 rounded-[8px] border border-[#EAEADF] bg-[#F9F9F5] px-3 py-2.5 hover:bg-[#F4F4EB]">
              <span className="inline-flex size-8 items-center justify-center rounded-[8px] bg-[#E5EDF7] text-[#0054B4]">
                <Hash className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-col">
                <b className="truncate text-[14px] font-medium">{channel.data.title || `${first}'s group chat`}</b>
                <span className={meta}>
                  {channel.data.memberCount} {channel.data.memberCount === 1 ? "family" : "families"}
                </span>
              </span>
            </Link>
          ) : (
            <p className={meta}>{channel.isLoading ? "Loading…" : "No group chat yet. Open My community in Messages to start one."}</p>
          )}
        </section>

        <section className={card}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={h2}>
              <Layers className="size-5 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
              Sessions and packages
            </h2>
            <button type="button" className={cn(secondaryButton, "h-[30px] px-3")} onClick={onSharePricing}>
              <Upload strokeWidth={1.5} aria-hidden="true" />
              Share pricing
            </button>
          </div>
          {hourly ? (
            <div className="flex items-center justify-between gap-3 border-b border-[#EAEADF] pb-3">
              <span className="flex flex-col">
                <b className="text-[14px] font-medium">Individual session</b>
                <span className={meta}>60 min · {where}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="rounded-[4px] bg-[#E5EDF7] px-2 py-[3px] text-[12px] font-medium text-[#0054B4]">Individual</span>
                <b className="text-[14px] font-semibold">{money(hourly)}</b>
              </span>
            </div>
          ) : (
            <p className={meta}>Add your session price so families can book you.</p>
          )}
          {active.length ? (
            <>
              <span className={meta}>Packages</span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((p) => (
                  <div key={p.id} className="flex flex-col gap-1 rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] p-3">
                    <b className="text-[14px] font-medium">{p.package_name}</b>
                    <span className="text-[24px] font-bold tracking-[-0.04em]">{money(p.total_price / 100)}</span>
                    <span className={meta}>
                      {money(p.total_price / 100 / Math.max(1, p.session_count))} per session · valid {p.validity_days} days
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
          <p className="flex items-start gap-2 rounded-[8px] bg-[#E5EDF7] px-3 py-2.5 text-[13px] text-[#00326C]">
            <ShieldCheck className="mt-px size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            {coach.cancellation_policy || "Free cancellation with 24 hours notice."}
          </p>
        </section>

        {coach.certifications?.length ? (
          <section className={card}>
            <h2 className={h2}>
              <Award className="size-5 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
              Certifications and credentials
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {coach.certifications.map((c, i) => (
                <div key={c.id ?? i} className="flex items-center gap-3 rounded-[10px] border border-[#EAEADF] bg-[#F4F4EB] p-4">
                  <span className="flex size-8 items-center justify-center rounded-[8px] bg-[#CBE7D1] text-[#1E7431]">
                    <Check className="size-4" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className="flex flex-col">
                    <b className="text-[14px] font-medium">{c.certification_name}</b>
                    {c.issuing_organization ? <span className={meta}>{c.issuing_organization}</span> : null}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <ReviewsCard
          averageRating={averageRating}
          totalReviews={totalReviews}
          distribution={ratingDistribution}
          reviews={reviews}
          showRating={showRating}
        />
      </div>

      <div className="flex flex-col gap-6">
        <section className={card}>
          <h2 className={h2}>Profile completeness</h2>
          <div className="flex items-center justify-between text-[14px]">
            <span className="font-medium">Profile completeness</span>
            <span className={meta}>{done} of {checks.length}</span>
          </div>
          <span className="h-[6px] overflow-hidden rounded-full bg-[#EAEADF]">
            <i className="block h-full bg-[#0054B4]" style={{ width: `${(done / checks.length) * 100}%` }} />
          </span>
          <ul className="flex flex-col gap-2.5">
            {checks.map(([label, ok, link]) => (
              <li key={label} className="flex items-center gap-2.5 text-[14px]">
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full",
                    ok ? "bg-[#CBE7D1] text-[#1E7431]" : "border border-dashed border-[#C1C1B8]"
                  )}
                >
                  {ok ? <Check className="size-3" strokeWidth={2.5} aria-hidden="true" /> : null}
                </span>
                <span className={cn("flex-1", ok ? "text-[#484D56]" : "text-[#1A202C]")}>{label}</span>
                {!ok ? (
                  link ? (
                    <Link to={link} className="text-[13px] font-medium text-[#0054B4] hover:underline">Add</Link>
                  ) : (
                    <button type="button" className="text-[13px] font-medium text-[#0054B4] hover:underline" onClick={onStartEdit}>Add</button>
                  )
                ) : null}
              </li>
            ))}
          </ul>
          <span className={meta}>Complete profiles show first in marketplace search.</span>
        </section>

        <section className={card}>
          <h2 className={h2}>Quick info</h2>
          <div className="flex flex-col gap-2.5">
            {quickInfo.map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-3 text-[14px]">
                <span className={meta}>{k}</span>
                <span className="text-right">{v}</span>
              </div>
            ))}
          </div>
        </section>

        {faqs.length ? (
          <section className={card}>
            <h2 className={h2}>FAQ</h2>
            <div className="flex flex-col divide-y divide-[#EAEADF]">
              {faqs.map((faq) => {
                const open = openFaq === faq.id;
                return (
                  <div key={faq.id} className="py-2.5">
                    <button type="button" className="flex w-full items-center justify-between gap-2 text-left" aria-expanded={open} onClick={() => setOpenFaq(open ? null : faq.id)}>
                      <span className="text-[14px] font-medium">{faq.question}</span>
                      <ChevronDown className={cn("size-4 shrink-0 text-[#767980] transition-transform", open && "rotate-180")} />
                    </button>
                    {open ? <p className="mt-2 text-[14px] leading-[20px] text-[#767980]">{faq.answer}</p> : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <GearAndDealsCard
          coachId={coach.id}
          coachName={coach.name}
          links={coach.affiliate_links}
          dealsEnabled={coach.deals_enabled}
          brandNames={brandNames}
          isOwner
          editing={false}
          onSaved={onCoachUpdated}
        />
      </div>
    </div>
  );
};
