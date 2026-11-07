import { errorMessage } from "@/utils/errorMessage";
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import type { CoachPackage } from '@/hooks/useCoachPackages';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { strings } from '@/config/strings';
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { Check } from "@/components/icons";
import { BrandPill } from '@/components/brand';
import { formatWholePrice } from '@/utils/sessionFormatting';
import { packagesAPI } from "@/api/packages";
import { apiClient } from "@/api/client";
import { SharePricingDialog } from "./SharePricingDialog";
import { useCoachDetails } from "@/hooks/useCoachDetails";
import { useReviews } from "@/hooks/useReviews";

interface CoachingPackagesProps {
  packages?: CoachPackage[];
  coachId?: string;
  coachName?: string;
  iconColor?: string;
  coachSport?: string;
  showSharePricing?: boolean;
}

export const CoachingPackages = ({
  packages,
  coachId,
  showSharePricing = false,
}: CoachingPackagesProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const { userProfile } = useAuth();
  const { isCoach: isCoachPersona } = useRole();
  const { coach } = useCoachDetails(showSharePricing ? coachId : undefined);
  const { averageRating = 0, totalReviews = 0 } = useReviews(
    showSharePricing ? coachId : undefined
  );

  // Ordered by display order; the first package carries the section's one primary action.
  const resolvedPackages = useMemo(() => {
    return [...(packages || [])]
      .sort(
        (a, b) => (a.display_order ?? Number.MAX_SAFE_INTEGER) - (b.display_order ?? Number.MAX_SAFE_INTEGER)
      )
      .map((pkg) => ({
        id: pkg.id,
        title: pkg.package_name,
        description: pkg.description || '',
        price: formatWholePrice(pkg.total_price / 100),
        perSession: formatWholePrice(pkg.price_per_session / 100),
        source: pkg,
      }));
  }, [packages]);

  const handlePurchase = async (pkgId: string, sourcePkg?: CoachPackage) => {
    if (!coachId && !sourcePkg?.coach_id) return;
    setPurchasing(pkgId);

    try {
      if (!userProfile) {
        setPurchasing(null);
        toast({
          title: strings.appointments.authenticationRequired,
          description: strings.appointments.pleaseSignInToBook,
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      if (!sourcePkg) {
        toast({
          title: strings.packages.purchaseFailed,
          description: "This package is not available for purchase right now.",
          variant: "destructive",
        });
        return;
      }

      const { data: { user } } = await apiClient.getSupabaseClient().auth.getUser();
      if (!user) {
        setPurchasing(null);
        toast({
          title: strings.appointments.authenticationRequired,
          description: strings.appointments.pleaseSignInToBook,
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      const payment = await packagesAPI.createPackagePayment({
        package_id: sourcePkg.id,
        coach_id: sourcePkg.coach_id || coachId,
      });

      if (payment.error) throw new Error(payment.error.message);

      if (payment.data?.url) {
        window.location.href = payment.data.url;
      } else {
        throw new Error("No checkout URL returned.");
      }
    } catch (error: unknown) {
      console.error('Error purchasing package:', error);
      const message = errorMessage(error, 'Failed to initiate package purchase. Please try again.');
      toast({
        title: strings.packages.purchaseFailed,
        description: message,
        variant: "destructive",
      });
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <section className="w-full rounded-card border border-light-525 bg-light-300 px-[18px] pb-5 pt-[22px] font-sans text-dark md:px-[25px] md:pb-[25px] md:pt-[30px]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-card-title text-dark">Coaching packages</h2>
          <p className="text-body-m text-dark-300">
            Choose the package that fits your journey. Every path to growth starts with a single step.
          </p>
        </div>
        {showSharePricing && coach?.slug ? (
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className={cn(buttonVariants({ variant: "secondary" }), "shrink-0")}
          >
            Share pricing
          </button>
        ) : null}
      </div>

      {resolvedPackages.length === 0 ? (
        <div className="mt-5 rounded-control bg-light-400 px-5 py-6 text-center text-body-m text-dark-300">
          No packages yet.
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {resolvedPackages.map((pkg, index) => {
            const isPrimary = index === 0;
            const isPurchasing = purchasing === pkg.id;
            const features = Array.isArray(pkg.source.features) ? pkg.source.features : [];
            return (
              <div
                key={pkg.id}
                className="flex flex-col gap-5 rounded-card border border-light-525 bg-light-400 p-[25px]"
              >
                <div className="flex flex-col gap-2">
                  <h3 className="text-card-title text-dark">{pkg.title}</h3>
                  {pkg.description && (
                    <p className="text-body-m text-dark-300">{pkg.description}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-highlight tabular-nums text-dark">{pkg.price}</span>
                  <span className="text-caption text-dark-300">
                    {pkg.perSession} per session
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <BrandPill tone="neutral">
                    {pkg.source.session_count} × {pkg.source.duration_minutes} min
                  </BrandPill>
                  <BrandPill tone="neutral">Valid {pkg.source.validity_days} days</BrandPill>
                </div>
                <div className="flex flex-1 flex-col gap-2 text-body-m">
                  {features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Check strokeWidth={1.5} className="h-4 w-4 flex-none text-primary" aria-hidden="true" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                {!isCoachPersona && (
                  <button
                    type="button"
                    onClick={() => handlePurchase(pkg.id, pkg.source)}
                    disabled={isPurchasing}
                    className={cn(buttonVariants({ variant: isPrimary ? "default" : "secondary" }), "w-full")}
                  >
                    {isPurchasing ? strings.packages.processing : `Choose ${pkg.title}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showSharePricing && coach?.slug ? (
        <SharePricingDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          coach={{
            id: coach.id,
            name: coach.name,
            slug: coach.slug,
            sport: coach.sport,
            coach_position: coach.coach_position ?? coach.position,
            position: coach.position,
            specialties: coach.specialties,
            session_types: coach.session_types,
            hourly_rate: coach.hourly_rate,
            profile_image_url: coach.profile_image_url,
            image_url: coach.image_url,
            is_verified: coach.is_verified,
          }}
          packages={packages || []}
          averageRating={averageRating}
          totalReviews={totalReviews}
        />
      ) : null}
    </section>
  );
};

export default CoachingPackages;
