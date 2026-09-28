import { Check } from "lucide-react";

import { BrandPill, BrandStar } from "@/components/brand";
import { RateCoachDialogSkeleton } from "@/components/reviews/RateCoachDialogSkeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { AthleteSession } from "@/types/athlete-sessions";
import {
  formatLocationSentence,
  formatTimeSpan,
  getAvatarUrlFromName,
  getInitialsFromName,
} from "@/utils/sessionFormatting";

type RatingStarsProps = {
  value: number;
  onChange: (newValue: number) => void;
  onHover: (newValue: number) => void;
  onLeave: () => void;
  disabled?: boolean;
};

const RatingStars = ({ value, onChange, onHover, onLeave, disabled = false }: RatingStarsProps) => (
  <div className="flex items-center gap-1.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        className={cn(
          "rounded-[4px] p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]",
          disabled && "cursor-not-allowed opacity-60"
        )}
        onClick={() => !disabled && onChange(star)}
        onMouseEnter={() => !disabled && onHover(star)}
        onMouseLeave={onLeave}
        disabled={disabled}
        aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
      >
        <BrandStar filled={star <= value} size={24} />
      </button>
    ))}
  </div>
);

type RateCoachDialogProps = {
  open: boolean;
  session: AthleteSession | null;
  /** Coach's sport. The sport pill is hidden when it isn't known. */
  coachSport?: "soccer" | "rowing";
  rating: number;
  hoverRating: number | null;
  comment: string;
  isSubmitting: boolean;
  isSubmitted?: boolean;
  existingFeedback?: {
    rating: number | null;
    comment: string | null;
    created_at: string;
    feedback_to_athlete: string | null;
    athlete_rated_at: string | null;
  } | null;
  isLoadingFeedback?: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  onRatingChange: (value: number) => void;
  onHoverChange: (value: number) => void;
  onHoverLeave: () => void;
  onCommentChange: (value: string) => void;
  /** Formats the session start (ISO) as a date, e.g. "Mon, Mar 9". */
  formatDate: (iso: string) => string;
};

const sectionClass = "px-[25px] py-5";
const Divider = () => <div className="h-px bg-[#EAEADF]" />;
const buttonBase =
  "h-[34px] rounded-[8px] border px-4 text-[16px] font-medium leading-[18px] tracking-[-0.03em]";

export const RateCoachDialog = ({
  open,
  session,
  coachSport,
  rating,
  hoverRating,
  comment,
  isSubmitting,
  isSubmitted = false,
  existingFeedback = null,
  isLoadingFeedback = false,
  onSubmit,
  onCancel,
  onRatingChange,
  onHoverChange,
  onHoverLeave,
  onCommentChange,
  formatDate,
}: RateCoachDialogProps) => {
  const hasExistingFeedback = Boolean(existingFeedback?.athlete_rated_at);
  const locationLabel = formatLocationSentence(session?.locationType || session?.location).toLowerCase();
  const displayedRating = hoverRating ?? rating;
  const metaLine = session
    ? [session.title, formatDate(session.start), formatTimeSpan(session.start, session.end), locationLabel]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="max-w-[720px] gap-0 overflow-hidden rounded-[10px] border-[#EAEADF] bg-[#F7F7F0] p-0 font-sans tracking-[-0.03em] text-[#1A202C] shadow-[0_0_15px_rgba(0,0,0,0.05)] sm:rounded-[10px] [&>button]:right-[17px] [&>button]:top-[19px] [&>button]:text-[#767980] [&>button[data-state=open]]:bg-transparent [&>button[data-state=open]]:text-[#767980]">
        {session && (
          <>
            <DialogHeader className={cn(sectionClass, "space-y-0 pr-14 text-left")}>
              <DialogTitle className="text-[24px] font-semibold leading-[30px] tracking-[-0.05em] text-[#1A202C]">Rate your coach</DialogTitle>
              <DialogDescription className="sr-only">
                Share your experience to help coaches improve and guide other athletes.
              </DialogDescription>
            </DialogHeader>

            <Divider />

            <div className={cn(sectionClass, "flex flex-col gap-5")}>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={session.coachAvatar ?? getAvatarUrlFromName(session.coach)} alt={session.coach} />
                  <AvatarFallback className="bg-[#E5EDF7] text-[14px] font-medium text-[#0054B4]">
                    {getInitialsFromName(session.coach)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <p className="text-[16px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">{session.coach}</p>
                  <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">{metaLine}</p>
                </div>
                {coachSport ? (
                  <BrandPill tone="teal" className="shrink-0">
                    {coachSport === "rowing" ? "Rowing" : "Soccer"}
                  </BrandPill>
                ) : null}
              </div>

              {existingFeedback?.feedback_to_athlete ? (
                <div className="flex flex-col gap-1.5 rounded-[10px] border border-[#EAEADF] bg-[#F4F4EB] p-4">
                  <p className="text-[14px] leading-[18px] font-medium text-[#1A202C]">From your coach</p>
                  <p className="text-[14px] leading-[18px] text-[#767980]">{existingFeedback.feedback_to_athlete}</p>
                </div>
              ) : null}

              {hasExistingFeedback && existingFeedback ? (
                <p className="text-[14px] leading-[18px] text-[#767980]">
                  You can update the rating you sent on{" "}
                  {new Date(existingFeedback.athlete_rated_at || existingFeedback.created_at).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric", year: "numeric" }
                  )}
                  .
                </p>
              ) : null}

              {isLoadingFeedback ? (
                <RateCoachDialogSkeleton />
              ) : (
                <>
                  <div className="flex flex-col gap-[10px]">
                    <p className="text-[16px] font-medium leading-[18px] text-[#1A202C]">Overall rating</p>
                    <div className="flex items-center gap-3">
                      <RatingStars
                        value={displayedRating}
                        onChange={onRatingChange}
                        onHover={onHoverChange}
                        onLeave={onHoverLeave}
                      />
                      {displayedRating > 0 ? (
                        <span className="text-[16px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]" aria-live="polite">
                          {displayedRating} of 5
                        </span>
                      ) : null}
                    </div>
                    {rating < 1 && (
                      <p className="text-[12px] leading-[14px] text-[#767980]">Select at least 1 star to submit</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-[10px]">
                    <label htmlFor="rate-coach-comment" className="text-[16px] font-medium leading-[18px] text-[#1A202C]">
                      What went well
                    </label>
                    <Textarea
                      id="rate-coach-comment"
                      value={comment}
                      onChange={(event) => onCommentChange(event.target.value)}
                      placeholder="Optional. Your coach sees this"
                      className="min-h-[90px] rounded-[8px] border-0 bg-[#F1F1E6] p-3 text-[14px] leading-[18px] tracking-[-0.03em] text-[#1A202C] placeholder:text-[#A3A6AB] focus-visible:ring-[#6698D2]"
                      maxLength={2000}
                    />
                  </div>
                </>
              )}
            </div>

            {!isLoadingFeedback ? (
              <>
                <Divider />
                <div className={cn(sectionClass, "flex flex-col-reverse gap-[10px] sm:flex-row sm:justify-end")}>
                  <Button
                    variant="outline"
                    className={cn(buttonBase, "border-[#EAEADF] bg-[#F4F4EB] text-[#1A202C] hover:bg-[#EAEADF] hover:text-[#1A202C]")}
                    onClick={onCancel}
                    disabled={isSubmitting || isSubmitted}
                  >
                    Cancel
                  </Button>
                  <Button
                    className={cn(
                      buttonBase,
                      "border-[#6698D2] bg-[#0054B4] text-[#F1F1E6] hover:bg-[#0054B4]/90",
                      isSubmitted && "disabled:opacity-100"
                    )}
                    onClick={onSubmit}
                    disabled={isSubmitting || isSubmitted || rating < 1}
                  >
                    {isSubmitted ? (
                      <>
                        <Check strokeWidth={1.5} aria-hidden="true" />
                        Feedback submitted
                      </>
                    ) : isSubmitting ? (
                      "Submitting..."
                    ) : hasExistingFeedback ? (
                      "Update rating"
                    ) : (
                      "Submit rating"
                    )}
                  </Button>
                </div>
              </>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
