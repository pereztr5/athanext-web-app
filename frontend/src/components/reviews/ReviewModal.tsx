import { useState } from "react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { BrandStar } from "@/components/brand";
import { strings } from "@/config/strings";

const reviewSchema = z.object({
  rating: z.number().min(1, "Please select a rating").max(5),
  reviewText: z.string().max(1000, "Review must be less than 1000 characters")
});

interface ReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coachName: string;
  onSubmit: (rating: number, reviewText: string) => Promise<{ error: Error | null }>;
}

export const ReviewModal = ({ open, onOpenChange, coachName, onSubmit }: ReviewModalProps) => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    try {
      const validation = reviewSchema.safeParse({ rating, reviewText });
      
      if (!validation.success) {
        toast({
          title: strings.errors.formInvalid,
          description: validation.error.issues[0].message,
          variant: "destructive"
        });
        return;
      }

      setIsSubmitting(true);
      const { error } = await onSubmit(rating, reviewText);

      if (error) {
        toast({
          title: strings.errors.somethingWentWrong,
          description: error.message,
          variant: "destructive"
        });
      } else {
        // Reset form
        setRating(0);
        setReviewText("");
        onOpenChange(false);
      }
    } catch (error) {
      toast({
        title: strings.errors.somethingWentWrong,
        description: strings.errors.failedToSubmitReview,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayedRating = hoveredRating || rating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] gap-0 overflow-hidden p-0 font-sans tracking-[-0.03em] text-dark [&>button]:right-[17px] [&>button]:top-[19px]">
        <DialogHeader className="space-y-1.5 px-[25px] py-5 pr-14 text-left">
          <DialogTitle className="text-section text-dark">
            Rate your session with {coachName}
          </DialogTitle>
          <DialogDescription className="text-body-m text-dark-300">
            Your review helps other athletes find the right coach
          </DialogDescription>
        </DialogHeader>

        <div className="h-px bg-light-525" />

        <div className="flex flex-col gap-5 px-[25px] py-5">
          <div className="flex flex-col gap-[10px]">
            <p id="review-rating-label" className="text-subtitle text-dark">
              Overall rating
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5" role="group" aria-labelledby="review-rating-label">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                    aria-pressed={star <= rating}
                    className="rounded-pill p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <BrandStar filled={star <= displayedRating} size={24} />
                  </button>
                ))}
              </div>
              {displayedRating > 0 ? (
                <span className="text-subtitle text-dark" aria-live="polite">
                  {displayedRating} of 5
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-[10px]">
            <label htmlFor="review-modal-text" className="text-subtitle text-dark">
              Your review
            </label>
            <Textarea
              id="review-modal-text"
              placeholder="Optional. What you worked on and how the coach helped"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={5}
              maxLength={1000}
              className="min-h-[90px] p-3 text-paragraph"
            />
            <p className="text-caption text-dark-300">
              {reviewText.length} of 1,000 characters
            </p>
          </div>
        </div>

        <div className="h-px bg-light-525" />

        <div className="flex flex-col-reverse gap-[10px] px-[25px] py-5 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={rating === 0 || isSubmitting}>
            {isSubmitting ? "Submitting…" : "Submit review"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
