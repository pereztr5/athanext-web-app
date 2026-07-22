import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { colors } from "@/config/colors";
import { strings } from "@/config/strings";

interface FreeConsultationInfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
  coachId: string;
  coachName: string;
  hourlyRate: number;
}

export function FreeConsultationInfoDialog({
  isOpen,
  onClose,
  onContinue,
  coachId,
  coachName,
  hourlyRate,
}: FreeConsultationInfoDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totalUsed, setTotalUsed] = useState(0);
  const [usedWithThisCoach, setUsedWithThisCoach] = useState(false);

  useEffect(() => {
    const fetchConsultationStatus = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("free_consultation_tracking")
          .select("coach_id")
          .eq("user_id", user.id)
          .in("status", ["booked", "completed"]);

        if (error) throw error;

        setTotalUsed(data?.length || 0);
        setUsedWithThisCoach(data?.some(record => record.coach_id === coachId) || false);
      } catch (error) {
        console.error("Error fetching consultation status:", error);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchConsultationStatus();
    }
  }, [isOpen, user, coachId]);

  const remaining = 2 - totalUsed;
  const canBook = !usedWithThisCoach && remaining > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CheckCircle2 style={{ color: colors.status.success }} className="h-6 w-6" />
            {strings.appointments.bookFreeConsultation}
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            {strings.appointments.complimentaryConsultation}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Platform Rules */}
          <div 
            className="rounded-lg p-4 border"
            style={{
              backgroundColor: colors.pastel.blue.main,
              borderColor: colors.pastel.blue.foreground,
            }}
          >
            <div className="flex items-start gap-3">
              <Info style={{ color: colors.pastel.blue.foreground }} className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="text-sm font-medium" style={{ color: colors.pastel.blue.foreground }}>
                  {strings.appointments.freeConsultationRules}
                </p>
                <ul className="text-sm space-y-1 list-disc list-inside" style={{ color: colors.pastel.blue.foreground }}>
                  <li>2 free consultations total across AthaLink</li>
                  <li>1 free consultation per coach</li>
                  <li>15 minutes per consultation</li>
                </ul>
              </div>
            </div>
          </div>

          {/* User Status */}
          {!loading && user && (
            <div 
              className="border rounded-lg p-4"
              style={{
                backgroundColor: canBook ? colors.pastel.green.main : colors.pastel.yellow.main,
                borderColor: canBook ? colors.pastel.green.foreground : colors.pastel.yellow.foreground,
              }}
            >
              <div className="flex items-start gap-3">
                {canBook ? (
                  <CheckCircle2 style={{ color: colors.status.success }} className="h-5 w-5 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle style={{ color: colors.status.warning }} className="h-5 w-5 mt-0.5 flex-shrink-0" />
                )}
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {canBook ? strings.appointments.youAreEligible : strings.appointments.limitReached}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {usedWithThisCoach ? (
                      strings.appointments.youveAlreadyUsedWithCoach(coachName)
                    ) : remaining > 0 ? (
                      strings.appointments.youHaveRemaining(remaining)
                    ) : (
                      strings.appointments.youveUsedBoth
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Next Steps */}
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">
              💡 <strong>{strings.appointments.whatNext}</strong> {strings.appointments.afterConsultations(coachName, hourlyRate)}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            {strings.buttons.cancel}
          </Button>
          {user && canBook ? (
            <Button onClick={onContinue} className="w-full sm:w-auto">
              {strings.appointments.continueToBook}
            </Button>
          ) : user && !canBook ? (
            <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
              {strings.appointments.viewPaidOptions}
            </Button>
          ) : (
            <Button onClick={onContinue} className="w-full sm:w-auto">
              {strings.appointments.signInToBook}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
