import { useState } from "react";
import { Star } from "lucide-react";
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
import { colors } from "@/config/colors";
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Rate Your Session with {coachName}</DialogTitle>
          <DialogDescription>
            Share your experience to help other athletes find the right coach
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Star Rating */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{strings.reviews.rating}</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className="h-8 w-8"
                    style={{
                      fill: star <= (hoveredRating || rating) ? colors.status.warning : colors.neutral.border,
                      color: star <= (hoveredRating || rating) ? colors.status.warning : colors.neutral.border,
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Review Text */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {strings.reviews.yourReview} (Optional)
            </label>
            <Textarea
              placeholder="Share details about your experience, what you learned, and how the coach helped you..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={5}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">
              {reviewText.length}/1000 characters
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {strings.buttons.cancel}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || isSubmitting}
          >
            {isSubmitting ? "Submitting..." : strings.reviews.submitReview}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
