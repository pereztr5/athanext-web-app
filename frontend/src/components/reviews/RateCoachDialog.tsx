import type { ReactNode } from "react";
import { Calendar, Clock4, MapPin, SendHorizontal, Users, X } from "lucide-react";

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
import { getAvatarUrlFromName, getInitialsFromName } from "@/utils/sessionFormatting";

type RatingStarsProps = {
  value: number;
  onChange: (newValue: number) => void;
  onHover: (newValue: number) => void;
  onLeave: () => void;
  disabled?: boolean;
};

const RatingStars = ({ value, onChange, onHover, onLeave, disabled = false }: RatingStarsProps) => (
  <div className="flex items-center gap-2">
    {[1, 2, 3, 4, 5].map((star) => {
      const isActive = star <= value;
      return (
        <button
          key={star}
          type="button"
          className={cn("p-1", disabled && "cursor-not-allowed opacity-60")}
          onClick={() => !disabled && onChange(star)}
          onMouseEnter={() => !disabled && onHover(star)}
          onMouseLeave={onLeave}
          disabled={disabled}
          aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
        >
          <StarIcon isActive={isActive} />
        </button>
      );
    })}
  </div>
);

const StarIcon = ({ isActive }: { isActive: boolean }) => (
  <svg
    aria-hidden="true"
    focusable="false"
    className={cn("h-8 w-8 transition-all", isActive ? "fill-yellow-400 text-yellow-400" : "text-slate-300")}
    viewBox="0 0 24 24"
    role="img"
  >
    <path d="M12 .587l3.668 7.434 8.2 1.192-5.934 5.787 1.402 8.18L12 18.896l-7.336 3.86 1.402-8.18L.132 9.213l8.2-1.192z" />
  </svg>
);

type RateCoachDialogProps = {
  open: boolean;
  session: AthleteSession | null;
  coachSport: "soccer" | "rowing";
  rating: number;
  hoverRating: number | null;
  comment: string;
  isSubmitting: boolean;
  isSubmitted?: boolean;
  existingFeedback?: { rating: number; comment: string | null; created_at: string } | null;
  isLoadingFeedback?: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  onRatingChange: (value: number) => void;
  onHoverChange: (value: number) => void;
  onHoverLeave: () => void;
  onCommentChange: (value: string) => void;
  formatDate: (iso: string) => string;
  formatTime: (iso: string) => string;
};

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
  formatTime,
}: RateCoachDialogProps) => {
  const hasExistingFeedback = Boolean(existingFeedback);
  const locationLabel = session?.locationType
    ? session.locationType === "In Person"
      ? "In-Person"
      : session.locationType
    : session?.location === "in-person" || session?.location === "in person" || session?.location === "In Person"
      ? "In-Person"
      : session?.location === "online" || session?.location === "Online"
        ? "Online"
        : session?.location ?? "";
  
  return (
  <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
    <DialogContent className="max-w-2xl p-0 overflow-hidden">
      {session && (
        <div className="p-6 space-y-6">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-2xl font-semibold text-slate-900">Rate Your Coach</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Share your experience to help coaches improve and guide other athletes.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3">
            <div className="flex items-start gap-3">
              <Avatar className="h-12 w-12 border border-slate-200">
                <AvatarImage src={session.coachAvatar ?? getAvatarUrlFromName(session.coach)} alt={session.coach} />
                <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                  {getInitialsFromName(session.coach)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <p className="text-base font-semibold text-slate-900">{session.coach}</p>
                <p className="text-sm text-slate-700">{session.title}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-700">
              <InfoRow icon={<Calendar className="h-4 w-4 text-blue-600" />} text={formatDate(session.start)} />
              <InfoRow
                icon={<Clock4 className="h-4 w-4 text-blue-600" />}
                text={`${formatTime(session.start)} - ${formatTime(session.end)}`}
              />
              <InfoRow icon={<MapPin className="h-4 w-4 text-blue-600" />} text={locationLabel} />
              <InfoRow
                icon={<Users className="h-4 w-4 text-blue-600" />}
                text={`${coachSport === "soccer" ? "Soccer" : "Rowing"}${
                  session.sportPillars?.length ? ` - ${session.sportPillars[0]}` : ""
                }`}
              />
            </div>
          </div>

          {hasExistingFeedback && existingFeedback && (
            <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex items-start gap-3">
              <svg className="h-5 w-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-green-900">Feedback Already Submitted</p>
                <p className="text-sm text-green-700 mt-1">
                  You submitted this feedback on {new Date(existingFeedback.created_at).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </p>
              </div>
            </div>
          )}

          {isLoadingFeedback ? (
            <RateCoachDialogSkeleton />
          ) : (
            <>
              <div className="space-y-2">
            <p className="text-base font-semibold text-slate-900 flex items-center gap-1">
              Overall Rating <span className="text-amber-600">*</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {hasExistingFeedback ? "Your rating" : "How would you rate your overall experience?"}
            </p>
            <div className="flex items-center gap-3">
              <RatingStars
                value={hoverRating ?? rating}
                onChange={onRatingChange}
                onHover={onHoverChange}
                onLeave={onHoverLeave}
                disabled={hasExistingFeedback}
              />
              <span className="text-lg font-semibold text-slate-900">{(hoverRating ?? rating).toFixed(1)}</span>
            </div>
            {!hasExistingFeedback && rating < 1 && (
              <p className="text-xs text-amber-600 mt-1">Please select at least 1 star to submit.</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-base font-semibold text-slate-900 flex items-center gap-1">
              Share more details
            </p>
            <p className="text-sm text-muted-foreground">
              {hasExistingFeedback ? "Your feedback" : "What went well? Any suggestions for your coach?"}
            </p>
            <Textarea
              value={comment}
              onChange={(event) => onCommentChange(event.target.value)}
              placeholder="Add optional feedback for your coach"
              className="bg-slate-50"
              maxLength={2000}
              disabled={hasExistingFeedback}
              readOnly={hasExistingFeedback}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
            <Button variant="outline" className="rounded-full px-6" onClick={onCancel} disabled={isSubmitting || isSubmitted}>
              <X className="h-4 w-4 mr-2" />
              {hasExistingFeedback ? "Close" : "Cancel"}
            </Button>
            {!hasExistingFeedback && (
              <Button 
                className="rounded-full px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-green-600 disabled:hover:bg-green-600" 
                onClick={onSubmit} 
                disabled={isSubmitting || isSubmitted || rating < 1}
              >
                {isSubmitted ? (
                  <>
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Feedback Submitted
                  </>
                ) : isSubmitting ? (
                  <>
                    <SendHorizontal className="h-4 w-4 mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <SendHorizontal className="h-4 w-4 mr-2" />
                    Submit Rating
                  </>
                )}
              </Button>
            )}
              </div>
            </>
          )}
        </div>
      )}
    </DialogContent>
  </Dialog>
  );
};

const InfoRow = ({ icon, text }: { icon: ReactNode; text: string }) => (
  <div className="flex items-center gap-2">
    {icon}
    <span>{text}</span>
  </div>
);
