import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { Check } from "@/components/icons";
import { Link } from "react-router-dom";

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
import { ROUTES } from "@/routes";
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
          "rounded-pill p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          disabled && "cursor-not-allowed"
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
    edit_count?: number | null;
  } | null;
  isLoadingFeedback?: boolean;
  /** The coach's summary for everyone who came, or their message after a no-show (ATH-82). */
  coachSummary?: string | null;
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
const Divider = () => <div className="h-px bg-light-525" />;

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
  coachSummary = null,
  isLoadingFeedback = false,
  onSubmit,
  onCancel,
  onRatingChange,
  onHoverChange,
  onHoverLeave,
  onCommentChange,
  formatDate,
}: RateCoachDialogProps) => {
  const timeZone = useViewerTimeZone();
  // Ratings are final once submitted (ATH-57).
  const isFeedbackLocked = Boolean(existingFeedback?.athlete_rated_at);
  const locationLabel = formatLocationSentence(session?.locationType || session?.location).toLowerCase();
  const displayedRating = hoverRating ?? rating;
  const metaLine = session
    ? [session.title, formatDate(session.start), formatTimeSpan(session.start, session.end, timeZone, true), locationLabel]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="max-w-[720px] gap-0 overflow-hidden rounded-card border-light-525 bg-light-300 p-0 font-sans tracking-[-0.03em] text-dark shadow-overlay sm:rounded-card [&>button]:right-[17px] [&>button]:top-[19px] [&>button]:text-dark-300 [&>button[data-state=open]]:bg-transparent [&>button[data-state=open]]:text-dark-300">
        {session && (
          <>
            <DialogHeader className={cn(sectionClass, "space-y-0 pr-14 text-left")}>
              <DialogTitle className="text-section text-dark">
                {isFeedbackLocked ? "Your rating" : "Rate your coach"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {isFeedbackLocked
                  ? "Your submitted rating for this session."
                  : "Share your experience to help coaches improve and guide other athletes."}
              </DialogDescription>
            </DialogHeader>

            <Divider />

            <div className={cn(sectionClass, "flex flex-col gap-5")}>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={session.coachAvatar ?? getAvatarUrlFromName(session.coach)} alt={session.coach} />
                  <AvatarFallback className="bg-primary-50 text-label-sm text-primary">
                    {getInitialsFromName(session.coach)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <p className="text-subtitle text-dark">{session.coach}</p>
                  <p className="text-body-m text-dark-300">{metaLine}</p>
                </div>
                {coachSport ? (
                  <BrandPill tone="teal" className="shrink-0">
                    {coachSport === "rowing" ? "Rowing" : "Soccer"}
                  </BrandPill>
                ) : null}
              </div>

              {coachSummary || existingFeedback?.feedback_to_athlete ? (
                <div className="flex flex-col gap-1.5 rounded-card border border-light-525 bg-light-400 p-4">
                  <p className="text-label-sm text-dark">From your coach</p>
                  {coachSummary ? <p className="whitespace-pre-wrap text-paragraph text-dark-300">{coachSummary}</p> : null}
                  {existingFeedback?.feedback_to_athlete ? (
                    <p className="whitespace-pre-wrap text-paragraph text-dark-400">
                      {coachSummary ? <b className="font-medium">Just for you: </b> : null}
                      {existingFeedback.feedback_to_athlete}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {isFeedbackLocked && existingFeedback ? (
                <p className="text-body-m text-dark-300">
                  You sent this rating on{" "}
                  {new Date(existingFeedback.athlete_rated_at || existingFeedback.created_at).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric", year: "numeric" }
                  )}
                  . Ratings are final once submitted.
                </p>
              ) : !isLoadingFeedback ? (
                <p className="text-body-m text-dark-300">
                  Ratings are final once submitted and can't be changed.
                </p>
              ) : null}

              {isLoadingFeedback ? (
                <RateCoachDialogSkeleton />
              ) : (
                <>
                  <div className="flex flex-col gap-[10px]">
                    <p className="text-subtitle text-dark">Overall rating</p>
                    <div className="flex items-center gap-3">
                      <RatingStars
                        value={displayedRating}
                        onChange={onRatingChange}
                        onHover={onHoverChange}
                        onLeave={onHoverLeave}
                        disabled={isFeedbackLocked}
                      />
                      {displayedRating > 0 ? (
                        <span className="text-subtitle text-dark" aria-live="polite">
                          {displayedRating} of 5
                        </span>
                      ) : null}
                    </div>
                    {!isFeedbackLocked && rating < 1 && (
                      <p className="text-caption text-dark-300">Select at least 1 star to submit</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-[10px]">
                    <label htmlFor="rate-coach-comment" className="text-subtitle text-dark">
                      What went well
                    </label>
                    <Textarea
                      id="rate-coach-comment"
                      value={comment}
                      onChange={(event) => onCommentChange(event.target.value)}
                      placeholder="Optional. Your coach sees this"
                      readOnly={isFeedbackLocked}
                      disabled={isFeedbackLocked}
                      className="min-h-[90px] rounded-control border border-dark-250 bg-light p-3 text-paragraph text-dark placeholder:text-dark-200 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-primary focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-default disabled:bg-light-400 disabled:border-light-525 disabled:text-dark-200"
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
                    onClick={onCancel}
                    disabled={isSubmitting || isSubmitted}
                  >
                    {isFeedbackLocked ? "Close" : "Cancel"}
                  </Button>
                  {isFeedbackLocked ? (
                    <Button
                      asChild
                    >
                      <Link to={ROUTES.CONTACT_US}>Contact support</Link>
                    </Button>
                  ) : (
                    <Button
                      onClick={onSubmit}
                      disabled={isSubmitting || isSubmitted || rating < 1}
                    >
                      {isSubmitted ? (
                        <>
                          <Check strokeWidth={1.5} aria-hidden="true" />
                          Feedback submitted
                        </>
                      ) : isSubmitting ? (
                        "Submitting…"
                      ) : (
                        "Submit rating"
                      )}
                    </Button>
                  )}
                </div>
              </>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
