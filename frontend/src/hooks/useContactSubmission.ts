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
import contactSubmissionTemplate from "@/template/contactSubmissionEmailTemplate.html?raw";

const RATE_LIMIT_KEY = "contact_form_last_submission";
const RATE_LIMIT_MINUTES = 5;

/**
 * Replaces template placeholders with actual values
 */
const populateTemplate = (
  template: string,
  data: {
    subject: string;
    fullName: string;
    email: string;
    message: string;
  }
): string => {
  return template
    .replace(/\{\{subject\}\}/g, data.subject)
    .replace(/\{\{fullName\}\}/g, data.fullName)
    .replace(/\{\{email\}\}/g, data.email)
    .replace(/\{\{message\}\}/g, data.message);
};

/**
 * Custom hook for handling contact form submissions
 * Includes validation, rate limiting, and security measures
 */
export const useContactSubmission = () => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const submitContactForm = async (
    formData: ContactFormData
  ): Promise<boolean> => {
    setErrors({});

    try {
      // Check rate limiting
      if (!checkRateLimit(RATE_LIMIT_KEY, RATE_LIMIT_MINUTES)) {
        toast({
          title: "Too Many Requests",
          description: `Please wait ${RATE_LIMIT_MINUTES} minutes before submitting another message.`,
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

      // Try to send notification email to admin via Supabase Edge Function with fetch fallback
      const sendNotificationEmail = async () => {
        const { data: configRows, error: configError } = await supabase
          .from("configurations")
          .select("key,value")
          .in("key", ["contact_admin_email", "smtp_email"]);

        if (configError) {
          throw new Error(
            configError.message ||
              "Unable to load contact email configuration from database."
          );
        }

        const configMap = Object.fromEntries(
          (configRows || []).map((row: { key: string; value: string }) => [
            row.key,
            row.value,
          ])
        );

        const adminEmail = configMap.contact_admin_email;
        const fromEmail = configMap.smtp_email || sanitizedData.email;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        if (!adminEmail) {
          throw new Error("Admin notification email is not configured.");
        }

        // Populate HTML template with dynamic values
        const htmlMessage = populateTemplate(contactSubmissionTemplate, {
          subject: validatedData.subject,
          fullName: validatedData.fullName,
          email: validatedData.email,
          message: validatedData.message,
        });

        const payload = {
          to: adminEmail,
          from: fromEmail,
          subject: `New Contact Submission: ${validatedData.subject}`,
          html: htmlMessage,
        };

        const { data: functionData, error: functionError } =
          await supabase.functions.invoke("send-email", {
            body: payload,
          });

        if (functionError) {
          console.error(
            "Supabase function invoke failed, attempting fetch fallback:",
            functionError
          );

          if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error(
              functionError.message ||
                "Email service is not configured correctly."
            );
          }

          const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify(payload),
          });

          const responseText = await response.text();
          if (!response.ok) {
            let errorMessage =
              response.statusText || "Failed to send notification email";
            try {
              const errorBody = responseText ? JSON.parse(responseText) : null;
              errorMessage =
                errorBody?.error || errorBody?.message || errorMessage;
            } catch {
              if (responseText) {
                errorMessage = responseText;
              }
            }
            throw new Error(errorMessage);
          }

          return null;
        }

        return functionData;
      };

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
      toast({
        title: emailNotificationFailed
          ? "Message Received (Email Issue)"
          : "Message Sent Successfully!",
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

        toast({
          title: "Validation Error",
          description: "Please check the form for errors and try again.",
          variant: "destructive",
        });
      }
      // Handle network/database errors
      else if (error instanceof Error) {
        const errorMessage = error.message.includes("unique constraint")
          ? "A message with this email was recently submitted. Please try again later."
          : error.message.includes("network")
          ? "Network error. Please check your connection and try again."
          : error.message || "An unexpected error occurred";

        toast({
          title: "Submission Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
      // Handle unknown errors
      else {
        toast({
          title: "Unexpected Error",
          description: "Unable to send your message. Please try again later.",
          variant: "destructive",
        });
      }

      return false;
    }
  };

  const submitMutation = useMutation({
    mutationFn: submitContactForm,
  });

  return {
    submitContactForm: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
    errors,
  };
};
 
