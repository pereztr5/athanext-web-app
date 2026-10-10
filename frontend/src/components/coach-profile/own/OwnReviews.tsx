/**
 * Reviews on the coach's own profile (Working Copy `sp2-rv`): stars and count in the header, two
 * reviews then "See all", and one public reply per review saved with set_review_reply.
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { reviewsAPI, type Review } from "@/api/reviews";
import { BrandPill } from "@/components/brand";
import { card, input, primaryButton, secondaryButton, smallButton, textButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ProfileReview } from "../CoachProfileView";
import { ownReviewsKey, useOwnReviews } from "./hooks";
import { Avatar, Stars } from "./parts";
import { caption, plural, reviewerContext, sectionTitle, shortDate, shortName, sp2Card } from "./shared";

const NEW_DAYS = 14;
const isNew = (r: Review) => !r.coach_reply && Date.now() - new Date(r.created_at).getTime() < NEW_DAYS * 86_400_000;

export const OwnReviews = ({
  coachId,
  averageRating,
  totalReviews,
  showRating,
  fallback,
}: {
  coachId: string;
  averageRating: number;
  totalReviews: number;
  showRating: boolean;
  /** Reviews from useReviews, used when the full rows can't load. */
  fallback: ProfileReview[];
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data } = useOwnReviews(coachId);
  const reviews: Review[] = data ?? fallback;
  const [all, setAll] = useState(false);
  const [replying, setReplying] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [bad, setBad] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!totalReviews && !reviews.length) return null;
  const count = Math.max(totalReviews, reviews.length);
  const shown = all ? reviews : reviews.slice(0, 2);

  const openReply = (id: string | null) => {
    setReplying(id);
    setText("");
    setBad(false);
  };

  const post = async (review: Review) => {
    const reply = text.trim();
    if (!reply) {
      setBad(true);
      return;
    }
    setSaving(true);
    const res = await reviewsAPI.saveReply(review.id, reply);
    setSaving(false);
    if (res.error) {
      toast({ title: "Couldn't post your reply", description: res.error.message, variant: "destructive" });
      return;
    }
    queryClient.setQueryData<Review[]>(ownReviewsKey(coachId), (old) =>
      (old ?? reviews).map((r) => (r.id === review.id ? { ...r, coach_reply: reply, coach_reply_at: new Date().toISOString() } : r))
    );
    void queryClient.invalidateQueries({ queryKey: ["coach-reviews-family", coachId] });
    openReply(null);
    toast({ title: "Reply posted" });
  };

  return (
    <section id="own-reviews" aria-label="Reviews" className={cn(card, sp2Card, "scroll-mt-20")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={sectionTitle}>Reviews</h2>
        {showRating ? (
          <span className="flex items-center gap-1.5">
            <Stars value={averageRating} />
            <b className="text-[14px] font-medium">{averageRating.toFixed(1)}</b>
            <span className={caption}>· {plural(count, "review")}</span>
          </span>
        ) : null}
      </div>
      {shown.length ? (
        <div>
          {shown.map((r) => (
            <div key={r.id} className="flex flex-col gap-[10px] py-[14px] [&+&]:border-t [&+&]:border-[#EAEADF]">
              <div className="flex items-start justify-between gap-3">
                <span className="flex min-w-0 items-center gap-[10px]">
                  <Avatar name={shortName(r.reviewer_name)} size={32} />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="flex items-center gap-1.5 text-[14px] font-medium leading-[18px] text-[#1A202C]">
                      {shortName(r.reviewer_name)}
                      {isNew(r) ? <BrandPill tone="solid">New</BrandPill> : null}
                    </span>
                    <span className={caption}>{[reviewerContext(r.athlete_age), shortDate(r.created_at)].filter(Boolean).join(" · ")}</span>
                  </span>
                </span>
                <Stars value={r.rating} size={12} />
              </div>
              {r.review_text ? <p className="text-[14px] leading-[20px] tracking-[-0.03em] text-[#484D56]">{r.review_text}</p> : null}
              {r.coach_reply ? (
                <div className="flex flex-col gap-1.5 rounded-[8px] bg-[#F4F4EB] px-3 py-[10px]">
                  <span className="text-[12px] font-medium leading-[13px] text-[#767980]">Your reply</span>
                  <span className="text-[14px] leading-[18px] text-[#1A202C]">{r.coach_reply}</span>
                </div>
              ) : replying === r.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    className={cn(input, "h-auto py-2 leading-[18px]", bad && "ring-2 ring-[#972B2B]")}
                    rows={2}
                    maxLength={1000}
                    autoFocus
                    aria-label="Your reply"
                    placeholder="Thank them or answer their point. One reply per review."
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setBad(false);
                    }}
                  />
                  <div className="flex gap-2">
                    <button type="button" className={cn(primaryButton, smallButton)} disabled={saving} onClick={() => void post(r)}>
                      {saving ? "Posting…" : "Post reply"}
                    </button>
                    <button type="button" className={cn(secondaryButton, smallButton)} disabled={saving} onClick={() => openReply(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className={cn(textButton, "self-start")} onClick={() => openReply(r.id)}>
                  Reply
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className={caption}>Comments from families show here.</p>
      )}
      {reviews.length > 2 ? (
        <button type="button" className={cn(secondaryButton, smallButton, "self-start")} onClick={() => setAll((v) => !v)}>
          {all ? "Show fewer" : `See all ${plural(count, "review")}`}
        </button>
      ) : null}
    </section>
  );
};
