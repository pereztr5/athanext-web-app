import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Clock, MapPin, Globe, Calendar, Package } from "@/components/icons";
import { CoachVerificationBadge } from "./CoachVerificationBadge";
import { Card } from "@/components/ui/card";
import { BrandPill } from "@/components/brand";
import { stripRichTextToPlainText } from "@/utils/richText";
import { isPublicCoachRatingVisible, publicCoachRatingLabel } from "@/utils/publicRating";

interface Coach {
  id: string;
  name: string;
  bio?: string;
  rating?: number;
  specialization?: string;
  hourly_rate?: number;
  profile_image_url?: string;
  image_url?: string;
  company?: string;
  locations?: string[];
  [key: string]: any;
}

interface CoachQuickPreviewModalProps {
  coach: Coach | null;
  isOpen: boolean;
  onClose: () => void;
  onBookSession: (serviceType: 'Free Consultation' | 'Single Session') => void;
  onViewPackages: () => void;
  onViewFullProfile: () => void;
}

export const CoachQuickPreviewModal = ({
  coach,
  isOpen,
  onClose,
  onBookSession,
  onViewPackages,
  onViewFullProfile,
}: CoachQuickPreviewModalProps) => {
  if (!coach) return null;

  const plainTextBio = stripRichTextToPlainText(coach.bio);
  const truncatedBio = plainTextBio
    ? plainTextBio.length > 200
      ? `${plainTextBio.substring(0, 200)}…`
      : plainTextBio
    : "No bio available";

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={i < Math.floor(rating) ? "size-4 fill-rating text-rating" : "size-4 fill-light-600 text-light-600"}
      />
    ));
  };

  return (
    <Dialog open={!isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Coach preview</DialogTitle>
        </DialogHeader>

        {/* Header Section */}
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={coach.profile_image_url || coach.image_url} alt={coach.name} />
                <AvatarFallback>{coach.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1">
                <CoachVerificationBadge />
              </div>
            </div>

            <div className="flex-1">
              <h2 className="text-section text-dark mb-1">{coach.name}</h2>
              {coach.company && (
                <p className="text-dark-300 mb-2">{coach.company}</p>
              )}
              {coach.locations && coach.locations.length > 0 && (
                <div className="flex items-center gap-1 text-body-m text-dark-300">
                  <MapPin className="h-4 w-4" />
                  <span>{coach.locations[0]}</span>
                </div>
              )}
            </div>
          </div>

          {/* Rating and Stats Bar */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              {isPublicCoachRatingVisible(coach.total_reviews, coach.rating) ? (
                <div className="flex">{renderStars(coach.rating || 0)}</div>
              ) : null}
              <span className="text-label-sm text-dark">
                {publicCoachRatingLabel(coach.rating, coach.total_reviews)}
              </span>
              {isPublicCoachRatingVisible(coach.total_reviews, coach.rating) ? (
                <span className="text-body-m text-dark-300">
                  ({coach.total_reviews || 0} reviews)
                </span>
              ) : null}
            </div>
            {coach.response_time_hours && (
              <div className="flex items-center gap-1 text-body-m text-dark-300">
                <Clock className="h-4 w-4" />
                <span>Responds in {coach.response_time_hours}h</span>
              </div>
            )}
          </div>

          {/* Bio Preview */}
          <div className="space-y-2">
            <h3 className="text-label-sm text-dark">About</h3>
            <p className="text-paragraph text-dark-300">
              {truncatedBio}
            </p>
            {plainTextBio && plainTextBio.length > 200 && (
              <button
                onClick={onViewFullProfile}
                className="text-primary text-label-sm hover:underline"
              >
                Read more
              </button>
            )}
          </div>

          {/* Quick Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {coach.years_experience && (
              <Card className="bg-light-400 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-label-xsm text-dark-300">Experience</span>
                </div>
                <p className="text-label-sm text-dark">
                  {coach.years_experience} years
                </p>
              </Card>
            )}

            {coach.languages && coach.languages.length > 0 && (
              <Card className="bg-light-400 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="h-4 w-4 text-primary" />
                  <span className="text-label-xsm text-dark-300">Languages</span>
                </div>
                <p className="text-label-sm text-dark">
                  {coach.languages.slice(0, 2).join(", ")}
                  {coach.languages.length > 2 && ` +${coach.languages.length - 2}`}
                </p>
              </Card>
            )}

            {coach.session_types && coach.session_types.length > 0 && (
              <Card className="bg-light-400 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-label-xsm text-dark-300">Sessions</span>
                </div>
                <p className="text-label-sm text-dark">
                  {coach.session_types.join(", ")}
                </p>
              </Card>
            )}
          </div>

          {/* Specialties */}
          {coach.specialties && coach.specialties.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-dark text-label-sm">Specialties</h3>
              <div className="flex flex-wrap gap-2">
                {coach.specialties.slice(0, 5).map((specialty: string, idx: number) => (
                  <BrandPill key={idx} tone="blue">
                    {specialty}
                  </BrandPill>
                ))}
                {coach.specialties.length > 5 && (
                  <BrandPill tone="muted">+{coach.specialties.length - 5} more</BrandPill>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <Button
              onClick={() => onBookSession('Free Consultation')}
              variant="secondary"
              className="w-full"
              size="sm"
            >
              Book free consultation
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => onBookSession('Single Session')}
                size="sm"
              >
                Book session
              </Button>
              <Button
                onClick={onViewPackages}
                size="sm"
              >
                View packages
              </Button>
            </div>

            {/* View Full Profile Button */}
            <Button
              onClick={onViewFullProfile}
              variant="secondary"
              size="sm"
              className="w-full"
            >
              View full profile
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CoachQuickPreviewModal;
