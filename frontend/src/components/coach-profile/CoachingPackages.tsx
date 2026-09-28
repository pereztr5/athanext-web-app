import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { CoachPackage } from '@/hooks/useCoachPackages';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { strings } from '@/config/strings';
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { Check } from 'lucide-react';
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
      const message = error instanceof Error ? error.message : 'Failed to initiate package purchase. Please try again.';
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
    <section className="w-full rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] pb-[25px] pt-[30px] font-sans text-[#1A202C] tracking-[-0.03em]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-[24px] font-semibold leading-[30px] tracking-[-0.05em] text-[#1A202C]">Coaching packages</h2>
          <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
            Choose the package that fits your journey. Every path to growth starts with a single step.
          </p>
        </div>
        {showSharePricing && coach?.slug ? (
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="inline-flex h-[34px] shrink-0 items-center justify-center rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] px-4 text-[14px] font-medium tracking-[-0.03em] text-[#1A202C]"
          >
            Share pricing
          </button>
        ) : null}
      </div>

      {resolvedPackages.length === 0 ? (
        <div className="mt-5 rounded-[8px] bg-[#F4F4EB] px-5 py-6 text-center text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
          No packages are currently provided by this coach.
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
                className="flex flex-col gap-5 rounded-[10px] border border-[#EAEADF] bg-[#F4F4EB] p-[25px]"
              >
                <div className="flex flex-col gap-2">
                  <h3 className="text-[20px] font-medium leading-[24px] tracking-[-0.05em] text-[#1A202C]">{pkg.title}</h3>
                  {pkg.description && (
                    <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">{pkg.description}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[32px] font-bold leading-[30px] tracking-[-0.03em] text-[#1A202C]">{pkg.price}</span>
                  <span className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
                    {pkg.perSession} per session
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <BrandPill tone="neutral">
                    {pkg.source.session_count} × {pkg.source.duration_minutes} min
                  </BrandPill>
                  <BrandPill tone="neutral">Valid {pkg.source.validity_days} days</BrandPill>
                </div>
                <div className="flex flex-1 flex-col gap-2 text-[14px] leading-[18px] tracking-[-0.03em]">
                  {features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Check strokeWidth={1.5} className="h-4 w-4 flex-none text-[#0054B4]" aria-hidden="true" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                {!isCoachPersona && (
                  <button
                    type="button"
                    onClick={() => handlePurchase(pkg.id, pkg.source)}
                    disabled={isPurchasing}
                    className={cn(
                      'flex h-[34px] w-full items-center justify-center rounded-[8px] border px-4 text-[16px] font-medium tracking-[-0.03em] transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4F4EB]',
                      isPrimary
                        ? 'border-[#6698D2] bg-[#0054B4] text-[#F1F1E6] hover:bg-[#004390]'
                        : 'border-[#EAEADF] bg-[#F7F7F0] text-[#1A202C] hover:bg-[#F1F1E6]'
                    )}
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
