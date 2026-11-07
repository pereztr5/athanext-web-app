import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "@/components/icons";
import { PageHeader } from "@/components/ui/page-header";

import { Button } from "@/components/ui/button";
import { BrandPill } from "@/components/brand";
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
import { useRole } from "@/hooks/useRole";
import { emptyProfileData, deriveInitials, mapFormToDbPayload } from "@/utils/athleteProfileHelpers";
import type { AthleteProfileFormData } from "@/types/athleteProfile";
import { ATHLETE_SPORTS_OPTIONS, toSportKey } from "@/utils/db";
import { ROUTES } from "@/routes";
import { PathwayTagChips } from "@/components/common/PathwayTagChips";
import { suggestPathwayTags } from "@/constants/pathwayTags";
import { PhoneInput } from "@/components/common/PhoneInput";
import { isValidE164 } from "@/utils/phone";

const labelClass = "text-label-sm text-dark";
const optionalClass = "font-normal text-dark-200";
const fieldClass = "grid gap-2";

const CreateAthleteProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, refreshUserProfile } = useAuth();
  const { saveAthleteProfile, refetchProfile } = useProfile();
  const { profile: userProfile, updateProfile } = useUserProfile();
  // A parent creates their child's profile: the account stays a parent account with its own name.
  const isParent = useRole().role === "parent";

  const [form, setForm] = useState<AthleteProfileFormData>({
    ...emptyProfileData,
    fullName: user?.user_metadata?.name ?? "",
    sport: toSportKey((user?.user_metadata as any)?.sport),
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
        sport: prev.sport || toSportKey(userProfile.sport),
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

    if (form.phoneNumber && !isValidE164(form.phoneNumber)) {
      toast({
        title: "Check your phone number",
        description: "Enter a valid phone number for the selected country, or leave it blank.",
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
        ...(isParent ? {} : { persona_type: "athlete" as const, name: form.fullName.trim() }),
        athlete_id: savedProfile?.id ?? userProfile?.athlete_id ?? null,
        sport: toSportKey(form.sport),
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


  return (
    <div className="px-4 pb-16 pt-6 md:px-10">
      <div className="mx-auto flex w-full max-w-wrapper-focused flex-col gap-6">
        <PageHeader
          title="Create your profile"
          titleSuffix={<BrandPill tone="blue">New athlete profile</BrandPill>}
          subtitle="Share the basics so coaches can get to know you. You can add more details and photos later."
        />

        <div className="rounded-card border border-light-525 bg-light-300 px-[25px] pb-[25px] pt-[30px]">
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <h2 className="text-card-title text-dark">About you</h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className={fieldClass}>
                <Label htmlFor="fullName" className={labelClass}>Full name</Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(event) => handleInputChange("fullName", event.target.value)}
                  placeholder="e.g. Alex Morgan"
                  aria-required="true"
                />
              </div>
              <div className={fieldClass}>
                <Label htmlFor="dateOfBirth" className={labelClass}>Date of birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(event) => handleInputChange("dateOfBirth", event.target.value)}
                  aria-required="true"
                />
              </div>
              <div className={fieldClass}>
                <Label htmlFor="sport" className={labelClass}>Sport</Label>
                <Select
                  value={form.sport}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, sport: value, position: "" }))
                  }
                >
                  <SelectTrigger id="sport" aria-required="true">
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
              <div className={fieldClass}>
                <Label htmlFor="position" className={labelClass}>
                  Primary position <span className={optionalClass}>(optional)</span>
                </Label>
                {sportOption?.positions?.length ? (
                  <Select
                    value={form.position || ""}
                    onValueChange={(value) => handleInputChange("position", value)}
                  >
                    <SelectTrigger id="position">
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
                    id="position"
                    value={form.position || ""}
                    onChange={(event) => handleInputChange("position", event.target.value)}
                    placeholder="e.g. Goalkeeper"
                  />
                )}
              </div>
              <div className={fieldClass}>
                <Label htmlFor="zipCode" className={labelClass}>
                  Location or ZIP <span className={optionalClass}>(optional)</span>
                </Label>
                <Input
                  id="zipCode"
                  value={form.zipCode || ""}
                  onChange={(event) => {
                    handleInputChange("zipCode", event.target.value);
                    handleInputChange("location", event.target.value);
                  }}
                  placeholder="City, state or ZIP"
                />
              </div>
              <div className={fieldClass}>
                <Label htmlFor="phoneNumber" className={labelClass}>
                  Phone <span className={optionalClass}>(optional)</span>
                </Label>
                <PhoneInput
                  id="phoneNumber"
                  value={form.phoneNumber}
                  onChange={(value) => handleInputChange("phoneNumber", value)}
                />
              </div>
            </div>

            <div className={fieldClass}>
              <Label htmlFor="tags" className={labelClass}>
                Interests and focus areas <span className={optionalClass}>(optional)</span>
              </Label>
              <Textarea
                id="tags"
                value={tagsInput}
                onChange={(event) => handleTagsChange(event.target.value)}
                placeholder="Separate with commas, e.g. agility, shooting, leadership"
                className="min-h-[90px]"
              />
            </div>

            <div className={fieldClass}>
              <Label className={labelClass}>
                Pathway tags <span className={optionalClass}>(optional)</span>
              </Label>
              <PathwayTagChips
                selected={form.pathwayTags}
                suggestions={suggestPathwayTags(
                  form.dateOfBirth,
                  typeof form.graduationYear === "number"
                    ? form.graduationYear
                    : form.graduationYear
                      ? Number(form.graduationYear)
                      : null
                )}
                onChange={(tags) => setForm((prev) => ({ ...prev, pathwayTags: tags }))}
              />
            </div>

            <div className="h-px w-full bg-light-525" />

            <div className="flex flex-col-reverse gap-[10px] sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(ROUTES.PROFILE)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="size-4 animate-spin" strokeWidth={1.5} aria-hidden="true" />
                    Saving...
                  </span>
                ) : (
                  "Create profile"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateAthleteProfile;
