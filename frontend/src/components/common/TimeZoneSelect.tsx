import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { userProfilesAPI } from "@/api";
import { useToast } from "@/hooks/use-toast";
import { browserTimeZone, getTimeZoneOptions, isValidTimeZone, timeZoneAbbreviation } from "@/utils/viewerTime";

const AUTOMATIC = "__automatic";

/** Saves the viewer's IANA time zone on user_profiles.timezone (empty = follow the browser). */
export const TimeZoneSelect = ({ className }: { className?: string }) => {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const saved = isValidTimeZone(userProfile?.timezone) ? userProfile!.timezone! : null;
  const options = useMemo(() => getTimeZoneOptions(saved), [saved]);
  const detected = browserTimeZone();

  const handleChange = async (value: string) => {
    if (!user?.id) return;
    const next = value === AUTOMATIC ? null : value;
    if (next === saved) return;
    setSaving(true);
    const { error } = await userProfilesAPI.updateUserProfile(user.id, { timezone: next });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save time zone", description: "Please try again.", variant: "destructive" });
      return;
    }
    await refreshUserProfile();
    toast({ title: "Time zone updated", description: "Session times now show in your time zone." });
  };

  return (
    <Select value={saved ?? AUTOMATIC} onValueChange={handleChange} disabled={saving || !user?.id}>
      <SelectTrigger className={className} aria-label="Time zone">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-[320px]">
        <SelectItem value={AUTOMATIC}>
          Automatic ({detected.replace(/_/g, " ")}, {timeZoneAbbreviation(detected)})
        </SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label} ({timeZoneAbbreviation(option.value)})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
