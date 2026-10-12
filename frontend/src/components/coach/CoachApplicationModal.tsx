import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useCoachApplication } from "@/hooks/useCoachApplication";
import { Loader2 } from "lucide-react";
import { strings } from "@/config/strings";

interface CoachApplicationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CoachApplicationModal = ({ open, onOpenChange }: CoachApplicationModalProps) => {
  const { submitApplication, isSubmitting } = useCoachApplication();
  
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone_number: "",
    sport: "",
    years_experience: "",
    certifications: "",
    current_coaching_role: "",
    why_join: "",
    website_url: "",
    instagram_handle: "",
    linkedin_url: "",
    background_check_consent: false,
    insurance_confirmation: false
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.full_name.trim() || formData.full_name.length < 2) {
      newErrors.full_name = "Name must be at least 2 characters";
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }

    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(formData.phone_number.replace(/[\s\-()]/g, ''))) {
      newErrors.phone_number = "Invalid phone number format";
    }

    if (!formData.sport.trim()) {
      newErrors.sport = "Please specify your sport";
    }

    const yearsExp = parseInt(formData.years_experience);
    if (isNaN(yearsExp) || yearsExp < 1) {
      newErrors.years_experience = "Experience must be at least 1 year";
    }

    if (!formData.certifications.trim() || formData.certifications.length < 10) {
      newErrors.certifications = "Please provide certification details (min 10 characters)";
    }

    if (!formData.why_join.trim() || formData.why_join.length < 50) {
      newErrors.why_join = "Please write at least 50 characters";
    } else if (formData.why_join.length > 500) {
      newErrors.why_join = "Maximum 500 characters allowed";
    }

    if (formData.website_url && !/^https?:\/\/.+/.test(formData.website_url)) {
      newErrors.website_url = "Please enter a valid URL";
    }

    if (formData.instagram_handle && !/^[a-zA-Z0-9._]{1,30}$/.test(formData.instagram_handle)) {
      newErrors.instagram_handle = "Invalid Instagram handle format";
    }

    if (formData.linkedin_url && !/^https?:\/\/(www\.)?linkedin\.com\/.+/.test(formData.linkedin_url)) {
      newErrors.linkedin_url = "Please enter a valid LinkedIn URL";
    }

    if (!formData.insurance_confirmation) {
      newErrors.insurance_confirmation = "You must confirm insurance";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const success = await submitApplication({
      ...formData,
      years_experience: parseInt(formData.years_experience)
    });

    if (success) {
      setFormData({
        full_name: "",
        email: "",
        phone_number: "",
        sport: "",
        years_experience: "",
        certifications: "",
        current_coaching_role: "",
        why_join: "",
        website_url: "",
        instagram_handle: "",
        linkedin_url: "",
        background_check_consent: false,
        insurance_confirmation: false
      });
      setErrors({});
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{strings.coach.applyToBecomeCoach}</DialogTitle>
          <DialogDescription>
            {strings.coach.applicationDescription}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{strings.coach.personalInformation}</h3>
            
            <div className="space-y-2">
              <Label htmlFor="full_name">{strings.form.labels.fullName} *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => handleChange("full_name", e.target.value)}
                placeholder="John Doe"
              />
              {errors.full_name && <p className="text-sm text-destructive">{errors.full_name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{strings.form.labels.email} *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="john@example.com"
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone_number">{strings.form.labels.phone} *</Label>
              <Input
                id="phone_number"
                type="tel"
                value={formData.phone_number}
                onChange={(e) => handleChange("phone_number", e.target.value)}
                placeholder="+1234567890"
              />
              {errors.phone_number && <p className="text-sm text-destructive">{errors.phone_number}</p>}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{strings.coach.professionalBackground}</h3>
            
            <div className="space-y-2">
              <Label htmlFor="sport">{strings.coach.sportsYouCoach} *</Label>
              <Input
                id="sport"
                value={formData.sport}
                onChange={(e) => handleChange("sport", e.target.value)}
                placeholder="e.g., Soccer, Rowing, Basketball"
              />
              {errors.sport && <p className="text-sm text-destructive">{errors.sport}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="years_experience">{strings.coach.yearsOfCoachingExperience} *</Label>
              <Input
                id="years_experience"
                type="number"
                min="1"
                value={formData.years_experience}
                onChange={(e) => handleChange("years_experience", e.target.value)}
                placeholder="5"
              />
              {errors.years_experience && <p className="text-sm text-destructive">{errors.years_experience}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="current_coaching_role">{strings.coach.currentCoachingRole}</Label>
              <Input
                id="current_coaching_role"
                value={formData.current_coaching_role}
                onChange={(e) => handleChange("current_coaching_role", e.target.value)}
                placeholder="Head Coach at ABC High School"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="certifications">{strings.coach.coachingCertifications} *</Label>
              <Textarea
                id="certifications"
                value={formData.certifications}
                onChange={(e) => handleChange("certifications", e.target.value)}
                placeholder="List your coaching certifications, licenses, and credentials..."
                rows={3}
              />
              {errors.certifications && <p className="text-sm text-destructive">{errors.certifications}</p>}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{strings.coach.onlinePresence}</h3>
            
            <div className="space-y-2">
              <Label htmlFor="website_url">{strings.coach.websiteUrl}</Label>
              <Input
                id="website_url"
                type="url"
                value={formData.website_url}
                onChange={(e) => handleChange("website_url", e.target.value)}
                placeholder="https://yourwebsite.com"
              />
              {errors.website_url && <p className="text-sm text-destructive">{errors.website_url}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="instagram_handle">{strings.coach.instagramHandle}</Label>
              <Input
                id="instagram_handle"
                value={formData.instagram_handle}
                onChange={(e) => handleChange("instagram_handle", e.target.value)}
                placeholder="yourhandle"
              />
              {errors.instagram_handle && <p className="text-sm text-destructive">{errors.instagram_handle}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="linkedin_url">{strings.coach.linkedinProfile}</Label>
              <Input
                id="linkedin_url"
                type="url"
                value={formData.linkedin_url}
                onChange={(e) => handleChange("linkedin_url", e.target.value)}
                placeholder="https://linkedin.com/in/yourprofile"
              />
              {errors.linkedin_url && <p className="text-sm text-destructive">{errors.linkedin_url}</p>}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{strings.coach.applicationStatement}</h3>
            
            <div className="space-y-2">
              <Label htmlFor="why_join">{strings.coach.whyJoinMyKonnect}</Label>
              <Textarea
                id="why_join"
                value={formData.why_join}
                onChange={(e) => handleChange("why_join", e.target.value)}
                placeholder="Share your motivation for joining our coaching network..."
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {formData.why_join.length}/500 characters
              </p>
              {errors.why_join && <p className="text-sm text-destructive">{errors.why_join}</p>}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{strings.coach.requiredConfirmations}</h3>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="insurance_confirmation"
                checked={formData.insurance_confirmation}
                onCheckedChange={(checked) => handleChange("insurance_confirmation", checked as boolean)}
              />
              <div className="space-y-1">
                <Label htmlFor="insurance_confirmation" className="font-normal cursor-pointer">
                  {strings.coach.confirmProfessionalInsurance} *
                </Label>
                {errors.insurance_confirmation && (
                  <p className="text-sm text-destructive">{errors.insurance_confirmation}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="flex-1"
            >
              {strings.buttons.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {strings.coach.submittingApplication}
                </>
              ) : (
                strings.coach.submitApplication
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
