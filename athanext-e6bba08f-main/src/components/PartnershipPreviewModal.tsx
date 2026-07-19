import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { CheckCircle2, Sparkles } from "lucide-react";
import { colors } from "@/config/colors";
import { PartnershipStatus, type Partnership } from "@/api/endpoints/partnerships";

interface PartnershipPreviewModalProps {
  partnership: Partnership;
  open: boolean;
  onClose: () => void;
  onPurchase: (partnership: Partnership) => void;
}

export const PartnershipPreviewModal = ({
  partnership,
  open,
  onClose,
  onPurchase,
}: PartnershipPreviewModalProps) => {
  const features = Array.isArray(partnership.features) 
    ? partnership.features 
    : [];
  
  const benefits = Array.isArray(partnership.benefits) 
    ? partnership.benefits 
    : [];
  
  const previewImages = Array.isArray(partnership.preview_images) 
    ? partnership.preview_images 
    : [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-4">
          <div className="flex items-start gap-4">
            <DialogTitle className="text-2xl flex-1">{partnership.name}</DialogTitle>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              variant={partnership.status ===  PartnershipStatus.AVAILABLE_NOW ? "default" : "secondary"}
            >
              {partnership.status}
            </Badge>
            {partnership.status === PartnershipStatus.AVAILABLE_NOW && (
              <span className="text-2xl font-bold text-primary">
                ${(partnership.price / 100).toFixed(2)}
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Image Gallery */}
          {previewImages.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Preview Gallery</h3>
              <Carousel className="w-full">
                <CarouselContent>
                  {previewImages.map((image, index) => (
                    <CarouselItem key={index}>
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                        <img
                          src={image}
                          alt={`${partnership.name} preview ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {previewImages.length > 1 && (
                  <>
                    <CarouselPrevious />
                    <CarouselNext />
                  </>
                )}
              </Carousel>
            </div>
          )}

          {/* Demo Video */}
          {partnership.demo_video_url && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Demo Video</h3>
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                <iframe
                  src={partnership.demo_video_url}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={`${partnership.name} demo`}
                />
              </div>
            </div>
          )}

          {/* Detailed Description */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">About This Resource</h3>
            <p className="text-muted-foreground leading-relaxed">
              {partnership.detailed_description || partnership.description}
            </p>
          </div>

          {/* Features */}
          {features.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles style={{ color: colors.primary.main }} className="w-5 h-5" />
                Key Features
              </h3>
              <ul className="grid gap-2">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle2 style={{ color: colors.primary.main }} className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Benefits */}
          {benefits.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">What You'll Get</h3>
              <ul className="grid gap-2">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle2 style={{ color: colors.status.success }} className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CTA */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={() => onPurchase(partnership)}
              disabled={partnership.status === "Coming Soon"}
              className="flex-1"
              size="lg"
            >
              Purchase Now
            </Button>
            <Button onClick={onClose} variant="outline" size="lg">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
