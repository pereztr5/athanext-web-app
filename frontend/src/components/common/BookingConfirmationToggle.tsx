import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { useProfile } from "@/contexts/ProfileContext";
import { coachesAPI } from "@/api";
import { useToast } from "@/hooks/use-toast";

/** Coach setting (ATH-49): individual sessions are requested and held until the coach accepts. */
export const BookingConfirmationToggle = () => {
  const { profile, refetchProfile } = useProfile();
  const { toast } = useToast();
  const coach = profile?.type === "coach" ? (profile.data as { id?: string; requires_booking_confirmation?: boolean }) : null;
  const [saving, setSaving] = useState(false);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const checked = optimistic ?? Boolean(coach?.requires_booking_confirmation);

  const handleChange = async (next: boolean) => {
    if (!coach?.id) return;
    setOptimistic(next);
    setSaving(true);
    const { error } = await coachesAPI.updateCoach(coach.id, { requires_booking_confirmation: next });
    setSaving(false);
    if (error) {
      setOptimistic(null);
      toast({ title: "Couldn't save setting", description: "Please try again.", variant: "destructive" });
      return;
    }
    await refetchProfile();
    setOptimistic(null);
    toast({
      title: next ? "Requests turned on" : "Requests turned off",
      description: next
        ? "Athletes now request individual sessions and pay after you accept."
        : "Athletes book and pay for individual sessions right away.",
    });
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <label htmlFor="booking-confirmation" className="text-[16px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">
          Confirm sessions before booking
        </label>
        <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
          Individual sessions are held as requests until you accept or decline. Group sessions stay instant.
        </p>
      </div>
      <Switch
        id="booking-confirmation"
        checked={checked}
        disabled={saving || !coach?.id}
        onCheckedChange={handleChange}
        className="data-[state=checked]:bg-[#0054B4]"
      />
    </div>
  );
};
