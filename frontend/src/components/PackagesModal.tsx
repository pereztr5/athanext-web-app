import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { CoachPackage } from "@/hooks/useCoachPackages";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { colors } from "@/config/colors";
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{strings.packages.packageOptionsWith} {coachName}</DialogTitle>
        </DialogHeader>
        
        {packages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {strings.packages.noPackagesAvailable}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {packages.map((pkg) => (
              <Card key={pkg.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-xl">{pkg.package_name}</CardTitle>
                  <CardDescription>{pkg.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="space-y-4">
                    <div>
                      <div className="text-3xl font-bold">${(pkg.total_price / 100).toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">
                        ${(pkg.price_per_session / 100).toFixed(2)} per session
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Badge variant="secondary">
                        {pkg.session_count} {strings.packages.sessionCount} × {pkg.duration_minutes} min
                      </Badge>
                      <Badge variant="outline">
                        {strings.packages.validFor} {pkg.validity_days} {strings.packages.days}
                      </Badge>
                    </div>

                    {pkg.features && Array.isArray(pkg.features) && pkg.features.length > 0 && (
                      <div className="space-y-2 pt-4 border-t">
                        {pkg.features.map((feature, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <Check style={{ color: colors.status.success }} className="h-4 w-4 mt-0.5" />
                            <span className="text-sm">{feature}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full"
                    onClick={() => handlePurchasePackage(pkg)}
                    disabled={purchasing === pkg.id}
                  >
                    {purchasing === pkg.id ? strings.packages.processing : strings.packages.purchasePackageButton}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
