import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Clock, MapPin, Globe, Calendar, Package } from "lucide-react";
import { CoachVerificationBadge } from "./CoachVerificationBadge";
import { Card } from "@/components/ui/card";
import { colors } from "@/config/colors";
import { stripRichTextToPlainText } from "@/utils/richText";

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
      ? `${plainTextBio.substring(0, 200)}...`
      : plainTextBio
    : "No bio available";

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className="h-4 w-4"
        style={{
          fill: i < Math.floor(rating) ? colors.status.warning : colors.neutral.border,
          color: i < Math.floor(rating) ? colors.status.warning : colors.neutral.border,
        }}
      />
    ));
  };

  return (
    <Dialog open={!isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Coach Preview</DialogTitle>
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
              <h2 className="text-2xl font-bold text-foreground mb-1">{coach.name}</h2>
              {coach.company && (
                <p className="text-muted-foreground mb-2">{coach.company}</p>
              )}
              {coach.locations && coach.locations.length > 0 && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{coach.locations[0]}</span>
                </div>
              )}
            </div>
          </div>

          {/* Rating and Stats Bar */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="flex">{renderStars(coach.rating || 4.8)}</div>
              <span className="text-sm font-medium text-foreground">
                {coach.rating || 4.8}
              </span>
              <span className="text-sm text-muted-foreground">
                ({coach.total_reviews || 0} reviews)
              </span>
            </div>
            {coach.response_time_hours && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Responds in {coach.response_time_hours}h</span>
              </div>
            )}
          </div>

          {/* Bio Preview */}
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">About</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {truncatedBio}
            </p>
            {plainTextBio && plainTextBio.length > 200 && (
              <button
                onClick={onViewFullProfile}
                className="text-primary text-sm hover:underline font-medium"
              >
                Read more
              </button>
            )}
          </div>

          {/* Quick Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {coach.years_experience && (
              <Card className="p-4 bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">Experience</span>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {coach.years_experience} years
                </p>
              </Card>
            )}

            {coach.languages && coach.languages.length > 0 && (
              <Card className="p-4 bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">Languages</span>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {coach.languages.slice(0, 2).join(", ")}
                  {coach.languages.length > 2 && ` +${coach.languages.length - 2}`}
                </p>
              </Card>
            )}

            {coach.session_types && coach.session_types.length > 0 && (
              <Card className="p-4 bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">Sessions</span>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {coach.session_types.join(", ")}
                </p>
              </Card>
            )}
          </div>

          {/* Specialties */}
          {coach.specialties && coach.specialties.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground text-sm">Specialties</h3>
              <div className="flex flex-wrap gap-2">
                {coach.specialties.slice(0, 5).map((specialty: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full"
                  >
                    {specialty}
                  </span>
                ))}
                {coach.specialties.length > 5 && (
                  <span className="px-3 py-1 bg-muted text-muted-foreground text-xs font-medium rounded-full">
                    +{coach.specialties.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <Button
              onClick={() => onBookSession('Free Consultation')}
              style={{
                backgroundColor: colors.neutral.background,
                color: colors.neutral.foreground,
                borderColor: colors.neutral.border,
              }}
              className="w-full border"
              size="sm"
            >
              Book Free Consultation
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => onBookSession('Single Session')}
                style={{
                  backgroundColor: colors.primary.main,
                  color: colors.primary.foreground,
                }}
                size="sm"
              >
                Book Session
              </Button>
              <Button
                onClick={onViewPackages}
                style={{
                  backgroundColor: colors.primary.main,
                  color: colors.primary.foreground,
                }}
                size="sm"
              >
                View Packages
              </Button>
            </div>

            {/* View Full Profile Button */}
            <Button
              onClick={onViewFullProfile}
              style={{
                backgroundColor: colors.neutral.foreground,
                color: colors.neutral.background,
              }}
              size="sm"
              className="w-full"
            >
              View Full Profile
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CoachQuickPreviewModal;
