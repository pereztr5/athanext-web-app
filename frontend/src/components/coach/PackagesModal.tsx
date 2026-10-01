import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check } from "lucide-react";
import { BrandPill } from "@/components/brand";
import { cn } from "@/lib/utils";
import { formatWholePrice } from "@/utils/sessionFormatting";
import { CoachPackage } from "@/hooks/useCoachPackages";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { strings } from "@/config/strings";
import { packagesAPI } from "@/api/packages";
import { apiClient } from "@/api/client";

interface PackagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  packages: CoachPackage[];
  coachName: string;
}

export const PackagesModal = ({ isOpen, onClose, packages, coachName }: PackagesModalProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const handlePurchasePackage = async (pkg: CoachPackage) => {
    setPurchasing(pkg.id);

    try {
      const { data: { user } } = await apiClient.getSupabaseClient().auth.getUser();

      if (!user) {
        toast({
          title: strings.appointments.authenticationRequired,
          description: strings.appointments.pleaseSignInToBook,
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      const payment = await packagesAPI.createPackagePayment({
        package_id: pkg.id,
        coach_id: pkg.coach_id,
      });

      if (payment.error) {
        throw new Error(payment.error.message);
      }

      if (payment.data?.url) {
        window.location.href = payment.data.url;
      } else {
        toast({
          title: strings.packages.purchaseFailed,
          description: "This package is not available for purchase right now.",
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      console.error('Error purchasing package:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to initiate package purchase. Please try again.';
      toast({
        title: strings.packages.purchaseFailed,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setPurchasing(null);
    }
  };

  // No "most booked" data exists, so the first package by display order gets the primary action.
  const orderedPackages = [...packages].sort(
    (a, b) => (a.display_order ?? Number.MAX_SAFE_INTEGER) - (b.display_order ?? Number.MAX_SAFE_INTEGER)
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          "max-w-4xl max-h-[90vh] overflow-y-auto gap-0 p-0",
          "bg-[#F7F7F0] border border-[#EAEADF] rounded-[10px] sm:rounded-[10px] shadow-[0_0_15px_rgba(0,0,0,0.05)] font-sans text-[#1A202C] tracking-[-0.03em]",
          "[&>button]:text-[#767980] [&>button]:opacity-100 [&>button:hover]:text-[#1A202C] [&>button]:right-[13px] [&>button]:top-[11px] sm:[&>button]:right-[17px] sm:[&>button]:top-[19px] [&>button_svg]:stroke-[1.5]"
        )}
      >
        <DialogHeader className="px-[25px] py-5 pr-14 text-left">
          <DialogTitle className="text-[24px] font-semibold leading-[30px] tracking-[-0.05em] text-[#1A202C]">
            Packages with {coachName}
          </DialogTitle>
        </DialogHeader>
        <div className="h-px bg-[#EAEADF]" />

        {orderedPackages.length === 0 ? (
          <div className="px-[25px] py-10 text-center text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
            No packages available at this time.
          </div>
        ) : (
          <div className="grid gap-6 px-[25px] pb-[25px] pt-5 md:grid-cols-2 lg:grid-cols-3">
            {orderedPackages.map((pkg, index) => {
              const isPrimary = index === 0;
              const isPurchasing = purchasing === pkg.id;
              return (
                <div
                  key={pkg.id}
                  className="flex flex-col gap-5 rounded-[10px] border border-[#EAEADF] bg-[#F4F4EB] p-[25px]"
                >
                  <div className="flex flex-col gap-2">
                    <h3 className="text-[20px] font-medium leading-[24px] tracking-[-0.05em] text-[#1A202C]">
                      {pkg.package_name}
                    </h3>
                    {pkg.description && (
                      <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">{pkg.description}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-[32px] font-bold leading-[30px] tracking-[-0.03em] text-[#1A202C]">
                      {formatWholePrice(pkg.total_price / 100)}
                    </span>
                    <span className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
                      {formatWholePrice(pkg.price_per_session / 100)} per session
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <BrandPill tone="neutral">
                      {pkg.session_count} × {pkg.duration_minutes} min
                    </BrandPill>
                    <BrandPill tone="neutral">Valid {pkg.validity_days} days</BrandPill>
                  </div>

                  <div className="flex flex-1 flex-col gap-2 text-[14px] leading-[18px] tracking-[-0.03em]">
                    {Array.isArray(pkg.features) &&
                      pkg.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Check strokeWidth={1.5} className="h-4 w-4 flex-none text-[#0054B4]" aria-hidden="true" />
                          <span>{feature}</span>
                        </div>
                      ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePurchasePackage(pkg)}
                    disabled={isPurchasing}
                    className={cn(
                      "flex h-[34px] w-full items-center justify-center rounded-[8px] border px-4 text-[16px] font-medium tracking-[-0.03em] transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4F4EB]",
                      isPrimary
                        ? "border-[#6698D2] bg-[#0054B4] text-[#F1F1E6] hover:bg-[#004390]"
                        : "border-[#EAEADF] bg-[#F7F7F0] text-[#1A202C] hover:bg-[#F1F1E6]"
                    )}
                  >
                    {isPurchasing ? strings.packages.processing : `Choose ${pkg.package_name}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
