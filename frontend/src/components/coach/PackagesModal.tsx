import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check } from "@/components/icons";
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
          description: "This package isn't available to buy right now.",
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      console.error('Error purchasing package:', error);
      const errorMessage = error instanceof Error ? error.message : "That didn't go through. Try again.";
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
          "bg-light-300 border border-light-525 rounded-card sm:rounded-card shadow-overlay font-sans text-dark",
          "[&>button]:text-dark-300 [&>button]:opacity-100 [&>button:hover]:text-dark [&>button]:right-[13px] [&>button]:top-[11px] sm:[&>button]:right-[17px] sm:[&>button]:top-[19px] [&>button_svg]:stroke-[1.5]"
        )}
      >
        <DialogHeader className="px-[25px] py-5 pr-14 text-left">
          <DialogTitle className="text-section text-dark">
            Packages with {coachName}
          </DialogTitle>
        </DialogHeader>
        <div className="h-px bg-light-525" />

        {orderedPackages.length === 0 ? (
          <div className="px-[25px] py-10 text-center text-body-m text-dark-300">
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
                  className="flex flex-col gap-5 rounded-card border border-light-525 bg-light-400 p-[25px]"
                >
                  <div className="flex flex-col gap-2">
                    <h3 className="text-card-title text-dark">
                      {pkg.package_name}
                    </h3>
                    {pkg.description && (
                      <p className="text-body-m text-dark-300">{pkg.description}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-stat text-dark">
                      {formatWholePrice(pkg.total_price / 100)}
                    </span>
                    <span className="text-caption text-dark-300">
                      {formatWholePrice(pkg.price_per_session / 100)} per session
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <BrandPill tone="neutral">
                      {pkg.session_count} × {pkg.duration_minutes} min
                    </BrandPill>
                    <BrandPill tone="neutral">Valid {pkg.validity_days} days</BrandPill>
                  </div>

                  <div className="flex flex-1 flex-col gap-2 text-body-m">
                    {Array.isArray(pkg.features) &&
                      pkg.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Check strokeWidth={1.5} className="h-4 w-4 flex-none text-primary" aria-hidden="true" />
                          <span>{feature}</span>
                        </div>
                      ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePurchasePackage(pkg)}
                    disabled={isPurchasing}
                    className={cn(
                      "flex h-[34px] w-full items-center justify-center rounded-control border px-4 text-label-sm transition-colors disabled:pointer-events-none disabled:border-light-525 disabled:bg-light-400 disabled:text-dark-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                      isPrimary
                        ? "border-primary-300 bg-primary text-light hover:bg-primary-600"
                        : "border-light-525 bg-light-300 text-dark hover:bg-light"
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
