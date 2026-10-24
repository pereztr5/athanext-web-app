import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  contactFormSchema,
  sanitizeInput,
  checkRateLimit,
  setRateLimit,
} from "@/utils/contactValidation";
import type { ContactFormData } from "@/types/contact";
import { z } from "zod";
import { sendPublicEmail } from "@/api/publicEmail";
import { contactEmailRequest } from "@/utils/publicEmail";

const RATE_LIMIT_KEY = "contact_form_last_submission";
const RATE_LIMIT_MINUTES = 5;

/**
 * Custom hook for handling contact form submissions
 * Includes validation, rate limiting, and security measures
 */
export const useContactSubmission = () => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const submitContactForm = async (
    formData: ContactFormData,
    quiet = false
  ): Promise<boolean> => {
    const notify = (options: {
      title: string;
      description?: string;
      variant?: "default" | "destructive";
    }) => {
      if (!quiet) toast(options);
    };
    setErrors({});

    try {
      // Check rate limiting
      if (!checkRateLimit(RATE_LIMIT_KEY, RATE_LIMIT_MINUTES)) {
        notify({
          title: "Too many requests",
          description: `Wait ${RATE_LIMIT_MINUTES} minutes before sending another message.`,
          variant: "destructive",
        });
        return false;
      }

      // Validate form data
      const validatedData = contactFormSchema.parse({
        fullName: formData.fullName?.trim() || "",
        email: formData.email?.trim().toLowerCase() || "",
        subject: formData.subject?.trim() || "",
        message: formData.message?.trim() || "",
      });

      // Get current user if logged in
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Sanitize inputs for extra security
      const sanitizedData = {
        full_name: sanitizeInput(validatedData.fullName),
        email: sanitizeInput(validatedData.email),
        subject: sanitizeInput(validatedData.subject),
        message: sanitizeInput(validatedData.message),
        user_id: user?.id || null,
        status: "new" as const,
      };

      // Submit to database
      const { data, error } = await supabase
        .from("contact_submissions")
        .insert([sanitizedData])
        .select()
        .single();

      if (error) {
        console.error("Database error:", error);
        throw new Error(error.message || "Failed to submit your message");
      }

      if (!data) {
        throw new Error("No response received from server");
      }

      // send-email builds the email to support@ (and the visitor's confirmation) from these fields.
      const sendNotificationEmail = () => sendPublicEmail(contactEmailRequest(validatedData));

      let emailNotificationFailed = false;
      try {
        await sendNotificationEmail();
      } catch (emailError) {
        emailNotificationFailed = true;
        console.error("Contact email notification error:", emailError);
      }

      // Set rate limit timestamp
      setRateLimit(RATE_LIMIT_KEY);

      // Show success message
      notify({
        title: emailNotificationFailed
          ? "Message received"
          : "Message sent",
        description: emailNotificationFailed
          ? "We saved your message but couldn't send the notification email. Our team will review it shortly."
          : "Thank you for contacting us. We'll get back to you within 24 hours.",
        variant: emailNotificationFailed ? "destructive" : "default",
      });

      return !emailNotificationFailed;
    } catch (error: unknown) {
      console.error("Contact form submission error:", error);

      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.issues.forEach((issue) => {
          const fieldName =
            issue.path && issue.path[0] ? String(issue.path[0]) : "form";
          fieldErrors[fieldName] = issue.message;
        });
        setErrors(fieldErrors);

        notify({
          title: "Check the form",
          description: "Fix the highlighted fields and try again.",
          variant: "destructive",
        });
      }
      // Handle network/database errors
      else if (error instanceof Error) {
        const errorMessage = error.message.includes("unique constraint")
          ? "A message with this email was sent recently. Try again later."
          : error.message.includes("network")
          ? "Network error. Check your connection and try again."
          : error.message || "An unexpected error occurred";

        notify({
          title: "Message didn't send",
          description: errorMessage,
          variant: "destructive",
        });
      }
      // Handle unknown errors
      else {
        notify({
          title: "Message didn't send",
          description: "Try again later.",
          variant: "destructive",
        });
      }

      return false;
    }
  };

  const submitMutation = useMutation({
    mutationFn: (input: { formData: ContactFormData; quiet?: boolean }) =>
      submitContactForm(input.formData, input.quiet === true),
  });

  return {
    submitContactForm: (formData: ContactFormData, options?: { quiet?: boolean }) =>
      submitMutation.mutateAsync({ formData, quiet: options?.quiet }),
    isSubmitting: submitMutation.isPending,
    errors,
  };
};
 
