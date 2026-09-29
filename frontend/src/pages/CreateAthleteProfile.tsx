import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

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
import { emptyProfileData, deriveInitials, mapFormToDbPayload } from "@/utils/athleteProfileHelpers";
import type { AthleteProfileFormData } from "@/types/athleteProfile";
import { ATHLETE_SPORTS_OPTIONS } from "@/utils/db";
import { ROUTES } from "@/routes";
import { PathwayTagChips } from "@/components/common/PathwayTagChips";
import { suggestPathwayTags } from "@/constants/pathwayTags";
import { PhoneInput } from "@/components/common/PhoneInput";
import { isValidE164 } from "@/utils/phone";

const labelClass = "text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]";
const optionalClass = "font-normal text-[#A3A6AB]";
const fieldClass = "grid gap-2";

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


  return (
    <div className="px-4 pb-16 pt-6 md:px-10">
      <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6">
        <div className="flex flex-col gap-[10px]">
          <BrandPill tone="blue" className="w-fit">New athlete profile</BrandPill>
          <h1 className="text-[32px] font-bold leading-[34px] tracking-[-0.05em] text-[#1A202C]">Create your profile</h1>
          <p className="text-[16px] leading-[20px] tracking-[-0.03em] text-[#767980]">
            Share the basics so coaches can get to know you. You can add more details and photos later.
          </p>
        </div>

        <div className="rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] pb-[25px] pt-[30px]">
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <h2 className="text-[20px] font-medium leading-[24px] tracking-[-0.05em] text-[#1A202C]">About you</h2>
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

            <div className="h-px w-full bg-[#EAEADF]" />

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
