import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Info } from "@/components/icons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { formatWholePrice } from "@/utils/sessionFormatting";

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

  const statusMessage = usedWithThisCoach
    ? `You've already used your free consultation with ${coachName}.`
    : remaining > 0
    ? `You have ${remaining} free consultation${remaining !== 1 ? "s" : ""} left.`
    : "You've used both of your free consultations.";
  const nextStepMessage =
    hourlyRate > 0
      ? `After your free consultations, paid sessions with ${coachName} start at ${formatWholePrice(hourlyRate)} an hour.`
      : `After your free consultations, you can book paid sessions with ${coachName}.`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[520px] gap-0 overflow-hidden p-0 font-sans text-dark [&>button]:right-[17px] [&>button]:top-[19px]">
        <DialogHeader className="space-y-1.5 px-[25px] py-5 pr-14 text-left">
          <DialogTitle className="text-section text-dark">
            Book a free 15-minute consultation
          </DialogTitle>
          <DialogDescription className="text-body-m text-dark-300">
            A short call to meet the coach and talk through your goals.
          </DialogDescription>
        </DialogHeader>

        <div className="h-px bg-light-525" />

        <div className="flex flex-col gap-2.5 px-[25px] py-5">
          <div className="flex items-start gap-2.5 rounded-control border border-primary-300 bg-primary-50 p-[15px]">
            <Info className="mt-px size-4 shrink-0 text-primary" strokeWidth={1.5} aria-hidden="true" />
            <div className="flex flex-col gap-1.5">
              <p className="text-label-sm text-primary">How free consultations work</p>
              <ul className="flex list-disc flex-col gap-1 pl-4 text-body-m text-dark-400">
                <li>2 free consultations in total on AthaNext</li>
                <li>1 free consultation per coach</li>
                <li>15 minutes each</li>
              </ul>
            </div>
          </div>

          {!loading && user && (
            <div
              className={cn(
                "flex items-start gap-2.5 rounded-control border p-[15px]",
                canBook ? "border-success-300 bg-success-50" : "border-info-300 bg-info-50"
              )}
            >
              {canBook ? (
                <CheckCircle2 className="mt-px size-4 shrink-0 text-success-700" strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <AlertCircle className="mt-px size-4 shrink-0 text-info-700" strokeWidth={1.5} aria-hidden="true" />
              )}
              <div className="flex flex-col gap-1">
                <p className={cn("text-label-sm", canBook ? "text-success-700" : "text-info-700")}>
                  {canBook ? "You're eligible" : "Limit reached"}
                </p>
                <p className="text-body-m text-dark-400">{statusMessage}</p>
              </div>
            </div>
          )}

          <div className="rounded-control border border-light-525 bg-light-400 p-[15px]">
            <p className="text-body-m text-dark-300">{nextStepMessage}</p>
          </div>
        </div>

        <div className="h-px bg-light-525" />

        <DialogFooter className="flex-col-reverse gap-2.5 px-[25px] py-5 sm:flex-row sm:space-x-0">
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          {user && canBook ? (
            <Button onClick={onContinue} className="w-full sm:w-auto">
              Continue to book
            </Button>
          ) : user && !canBook ? (
            <Button onClick={onClose} className="w-full sm:w-auto">
              View paid options
            </Button>
          ) : (
            <Button onClick={onContinue} className="w-full sm:w-auto">
              Sign in to book
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
