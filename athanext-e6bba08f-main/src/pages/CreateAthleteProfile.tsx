import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { emptyProfileData, deriveInitials, mapFormToDbPayload } from "@/utils/athleteProfileHelpers";
import type { AthleteProfileFormData } from "@/type/athleteProfile";
import { ATHLETE_SPORTS_OPTIONS } from "@/utils/db";
import { ROUTES } from "@/routes";

const CreateAthleteProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, refreshUserProfile } = useAuth();
  const { saveAthleteProfile, refetchProfile } = useProfile();
  const { profile: userProfile, updateProfile } = useUserProfile();

  const [form, setForm] = useState<AthleteProfileFormData>({
    ...emptyProfileData,
    fullName: user?.user_metadata?.name ?? "",
    sport: (user?.user_metadata as any)?.sport ?? "",
    position: (user?.user_metadata as any)?.position ?? "",
    dateOfBirth: (user?.user_metadata as any)?.date_of_birth ?? "",
  });
  const [tagsInput, setTagsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const sportOption = useMemo(
    () => ATHLETE_SPORTS_OPTIONS.find((option) => option.value === form.sport),
    [form.sport]
  );

  useEffect(() => {
    if (userProfile) {
      setForm((prev) => ({
        ...prev,
        fullName: prev.fullName || userProfile.name || "",
        sport: prev.sport || userProfile.sport || "",
        position: prev.position || userProfile.position || "",
        dateOfBirth: prev.dateOfBirth || (userProfile.date_of_birth as string) || "",
        zipCode: prev.zipCode || (userProfile.zip_code as string | null) || null,
        location: prev.location || userProfile.zip_code || "",
      }));
    }
  }, [userProfile]);

  const handleInputChange = (key: keyof AthleteProfileFormData, value: string | null) => {
    setForm((prev) => ({
      ...prev,
      [key]: value ?? "",
      ...(key === "fullName" ? { initials: deriveInitials(value || "") } : {}),
    }));
  };

  const handleTagsChange = (value: string) => {
    setTagsInput(value);
    const tags = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    setForm((prev) => ({ ...prev, tags }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      navigate(ROUTES.AUTH);
      return;
    }

    if (!form.fullName.trim() || !form.sport.trim() || !form.dateOfBirth) {
      toast({
        title: "Missing details",
        description: "Full name, sport, and date of birth are required.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = mapFormToDbPayload({
        ...form,
        coverImageUrls: [],
        profileImageUrl: null,
      });

      const savedProfile = await saveAthleteProfile(payload);

      await updateProfile({
        persona_type: "athlete",
        athlete_id: savedProfile?.id ?? userProfile?.athlete_id ?? null,
        name: form.fullName.trim(),
        sport: form.sport.trim(),
        position: form.position?.trim() || null,
        date_of_birth: form.dateOfBirth,
        zip_code: form.zipCode,
      });

      await refreshUserProfile();
      await refetchProfile();

      toast({
        title: "Profile created",
        description: "Your athlete profile is ready to go.",
      });

      navigate(ROUTES.PROFILE);
    } catch (error) {
      console.error("Failed to create athlete profile", error);
      toast({
        title: "Unable to create profile",
        description: "Please check your details and try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50/40 to-slate-100/40 flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-2xl font-semibold text-slate-900">Sign in to continue</h1>
          <p className="text-sm text-slate-600">
            You need an account to create your athlete profile.
          </p>
          <Button onClick={() => navigate(ROUTES.AUTH)} className="px-6">
            Go to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100 pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-blue-600 text-sm font-semibold">
              <Sparkles className="h-4 w-4" />
              New athlete profile
            </div>
            <CardTitle className="text-3xl font-bold text-slate-900">Create your profile</CardTitle>
            <p className="text-sm text-slate-600">
              Share the basics so coaches can get to know you. You can add more details and photos later.
            </p>
          </CardHeader>
        </Card>

        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={form.fullName}
                    onChange={(event) => handleInputChange("fullName", event.target.value)}
                    placeholder="e.g., Alex Morgan"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(event) => handleInputChange("dateOfBirth", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sport *</Label>
                  <Select
                    value={form.sport}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, sport: value, position: "" }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your sport" />
                    </SelectTrigger>
                    <SelectContent>
                      {ATHLETE_SPORTS_OPTIONS.map((sport) => (
                        <SelectItem key={sport.value} value={sport.value}>
                          {sport.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Primary Position</Label>
                  {sportOption?.positions?.length ? (
                    <Select
                      value={form.position || ""}
                      onValueChange={(value) => handleInputChange("position", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a position" />
                      </SelectTrigger>
                      <SelectContent>
                        {sportOption.positions.map((position) => (
                          <SelectItem key={position.value} value={position.value}>
                            {position.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={form.position || ""}
                      onChange={(event) => handleInputChange("position", event.target.value)}
                      placeholder="e.g., Goalkeeper"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="zipCode">Location / ZIP</Label>
                  <Input
                    id="zipCode"
                    value={form.zipCode || ""}
                    onChange={(event) => {
                      handleInputChange("zipCode", event.target.value);
                      handleInputChange("location", event.target.value);
                    }}
                    placeholder="City, State or ZIP"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone (optional)</Label>
                  <Input
                    id="phoneNumber"
                    value={form.phoneNumber}
                    onChange={(event) => handleInputChange("phoneNumber", event.target.value)}
                    placeholder="123-456-7890"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Interests / Focus areas</Label>
                <Textarea
                  id="tags"
                  value={tagsInput}
                  onChange={(event) => handleTagsChange(event.target.value)}
                  placeholder="Comma-separated interests (e.g., agility, shooting, leadership)"
                  className="min-h-[80px]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(ROUTES.PROFILE)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" className="px-6" disabled={submitting}>
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    "Create profile"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateAthleteProfile;
