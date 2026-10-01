import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CoachApplicationData {
  full_name: string;
  email: string;
  phone_number: string;
  sport: string;
  years_experience: number;
  certifications: string;
  current_coaching_role: string;
  why_join: string;
  website_url: string;
  instagram_handle: string;
  linkedin_url: string;
  background_check_consent: boolean;
  insurance_confirmation: boolean;
}

export const useCoachApplication = () => {
  const submitApplication = async (data: CoachApplicationData): Promise<boolean> => {
    try {
      const { data: { user } } = await apiClient.getSupabaseClient().auth.getUser();

      const applicationData = {
        user_id: user?.id || null,
        full_name: data.full_name.trim(),
        email: data.email.trim().toLowerCase(),
        phone_number: data.phone_number.trim(),
        sport: data.sport.trim(),
        years_experience: data.years_experience,
        certifications: data.certifications.trim(),
        current_coaching_role: data.current_coaching_role?.trim() || null,
        why_join: data.why_join.trim(),
        website_url: data.website_url?.trim() || null,
        instagram_handle: data.instagram_handle?.trim() || null,
        linkedin_url: data.linkedin_url?.trim() || null,
        background_check_consent: data.background_check_consent,
        insurance_confirmation: data.insurance_confirmation,
        application_status: 'pending'
      };

      const { error } = await supabase
        .from('coach_applications')
        .insert(applicationData);

      if (error) {
        console.error('Error submitting application:', error);
        toast.error("Failed to submit application", {
          description: error.message || "Please try again later."
        });
        return false;
      }

      toast.success("Application submitted successfully!", {
        description: "We'll review your application and contact you within 3-5 business days."
      });

      return true;
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error("An unexpected error occurred", {
        description: "Please try again later."
      });
      return false;
    }
  };

  const submitMutation = useMutation({
    mutationFn: submitApplication,
  });

  return {
    submitApplication: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending
  };
};
