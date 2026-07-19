import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CoachPackage } from '@/hooks/useCoachPackages';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { strings } from '@/config/strings';
import { useAuth } from "@/hooks/useAuth";
import { Package } from 'lucide-react';
import { PROFILE_TYPE } from "@/utils/db";
import { packagesAPI } from "@/api/packages";
import { apiClient } from "@/api/client";
import { COACH_PROFILE_THEMES } from "@/config/colors";

interface CoachingPackagesProps {
  packages?: CoachPackage[];
  coachId?: string;
  coachName?: string;
  iconColor?: string;
  coachSport?: string;
}

export const CoachingPackages = ({
  packages,
  coachId,
  coachName,
  iconColor,
  coachSport,
}: CoachingPackagesProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const { userProfile } = useAuth();
  const isCoachPersona = (userProfile?.persona_type || "").toLowerCase() === PROFILE_TYPE.coach;

  const derivedIconColor = useMemo(() => {
    if (iconColor) return iconColor;
    const sport = (coachSport || "").toLowerCase();
    const isSoccer = ["soccer", "football", "scoccer"].some((s) => sport.includes(s));
    const isRowing = sport.includes("row");
    if (isSoccer) return COACH_PROFILE_THEMES.soccer.iconColor;
    if (isRowing) return COACH_PROFILE_THEMES.rowing.iconColor;
    return COACH_PROFILE_THEMES.default.iconColor;
  }, [iconColor, coachSport]);

  const resolvedPackages = useMemo(() => {
    return (packages || []).map((pkg) => ({
      id: pkg.id,
      title: pkg.package_name,
      description: pkg.description || '',
      price: `$${(pkg.total_price / 100).toFixed(2)}`,
      sessions: `${pkg.session_count} sessions`,
      duration: `${pkg.validity_days} days`,
      highlighted: pkg.display_order === 1 || pkg.is_active,
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
    <div className="w-full rounded-2xl bg-white shadow-sm border border-slate-200 p-6 space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Package className={`h-5 w-5 ${derivedIconColor}`} />
          <h2 className="text-2xl font-semibold text-slate-900">Coaching Packages</h2>
        </div>
        <p className="text-sm text-slate-600">
          Choose the package that fits your journey. Every path to growth starts with a single step.
        </p>
      </div>

      {resolvedPackages.length === 0 ? (
        <div className="text-sm text-slate-600 p-4 text-center font-bold">
          * No packages are currently provided by this coach.
        </div>
      ) : (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {resolvedPackages.map((pkg) => (
          <div
            key={pkg.id}
            className={cn(
              'relative rounded-2xl border bg-slate-50 p-5 flex flex-col gap-3 shadow-sm',
              pkg.highlighted
                ? 'border-blue-400 shadow-[0_10px_30px_rgba(37,99,235,0.15)] bg-white'
                : 'border-slate-200'
            )}
          >
            {'badge' in pkg && pkg.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 shadow-sm">
                {String(pkg.badge)}
              </span>
            )}
            <div className="space-y-1 pt-2">
              <h3 className="text-lg font-semibold text-slate-900">{pkg.title}</h3>
              <p className="text-sm text-slate-600">{pkg.description}</p>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-semibold text-slate-900">{pkg.price}</p>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <span>• {pkg.sessions}</span>
                <span>• {pkg.duration}</span>
              </div>
            </div>
            {!isCoachPersona && (
              <div className="mt-auto">
                <Button
                  className={cn(
                    'w-full rounded-full text-sm font-semibold',
                    pkg.highlighted
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-white hover:bg-slate-100 text-slate-900 border border-slate-200'
                  )}
                  onClick={() => handlePurchase(pkg.id, (pkg as any).source)}
                  disabled={purchasing === pkg.id}
                >
                  {purchasing === pkg.id ? strings.packages.processing : 'Select Package'}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      )}
    </div>
  );
};

export default CoachingPackages;
