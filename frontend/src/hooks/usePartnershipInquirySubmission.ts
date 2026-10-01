import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  sanitizeInput,
  checkRateLimit,
  setRateLimit,
} from "@/utils/contactValidation";
import partnershipInquiryTemplate from "@/template/partnershipInquiryEmailTemplate.html?raw";

const RATE_LIMIT_KEY = "partnership_inquiry_last_submission";
const RATE_LIMIT_MINUTES = 5;

const partnershipInquirySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  organization: z
    .string()
    .trim()
    .min(1, "Organization is required")
    .max(100, "Organization must be less than 100 characters"),
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .max(255, "Email must be less than 255 characters"),
  partnershipInterest: z
    .string()
    .trim()
    .min(10, "Please provide at least 10 characters")
    .max(1000, "Message must be less than 1000 characters")
    .refine((val) => {
      const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /<iframe/i,
        /eval\(/i,
        /exec\(/i,
      ];
      return !suspiciousPatterns.some((pattern) => pattern.test(val));
    }, "Message contains prohibited content"),
});

type PartnershipInquiryFormData = z.infer<typeof partnershipInquirySchema>;

const populateTemplate = (
  template: string,
  data: {
    name: string;
    organization: string;
    email: string;
    partnershipInterest: string;
  }
): string => {
  return template
    .replace(/\{\{name\}\}/g, data.name)
    .replace(/\{\{organization\}\}/g, data.organization)
    .replace(/\{\{email\}\}/g, data.email)
    .replace(/\{\{partnershipInterest\}\}/g, data.partnershipInterest);
};

export const usePartnershipInquirySubmission = () => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const submitInquiry = async (
    formData: PartnershipInquiryFormData
  ): Promise<boolean> => {
    setErrors({});

    try {
      if (!checkRateLimit(RATE_LIMIT_KEY, RATE_LIMIT_MINUTES)) {
        toast({
          title: "Too Many Requests",
          description: `Please wait ${RATE_LIMIT_MINUTES} minutes before submitting another inquiry.`,
          variant: "destructive",
        });
        return false;
      }

      const validatedData = partnershipInquirySchema.parse({
        name: formData.name?.trim() || "",
        organization: formData.organization?.trim() || "",
        email: formData.email?.trim().toLowerCase() || "",
        partnershipInterest: formData.partnershipInterest?.trim() || "",
      });

      const sanitizedData = {
        name: sanitizeInput(validatedData.name),
        organization: sanitizeInput(validatedData.organization),
        email: sanitizeInput(validatedData.email),
        partnership_interest: sanitizeInput(validatedData.partnershipInterest),
      };

      const { error: dbError } = await supabase
        .from("partnership_inquiries")
        .insert({
          name: sanitizedData.name,
          organization: sanitizedData.organization,
          email: sanitizedData.email,
          partnership_interest: sanitizedData.partnership_interest,
        });

      if (dbError) {
        console.error("Database error:", dbError);
        throw new Error(dbError.message || "Failed to submit inquiry");
      }

      const sendInquiryNotificationEmail = async () => {
        const { data: configRows, error: configError } = await supabase
          .from("configurations")
          .select("key,value")
          .in("key", ["contact_admin_email", "smtp_email"]);

        if (configError) {
          throw new Error(
            configError.message ||
              "Unable to load partnership email configuration from database."
          );
        }

        const configMap = Object.fromEntries(
          (configRows || []).map((row: { key: string; value: string }) => [
            row.key,
            row.value,
          ])
        );

        const adminEmail = configMap.contact_admin_email;
        const fromEmail = configMap.smtp_email || validatedData.email;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        if (!adminEmail) {
          throw new Error("Admin notification email is not configured.");
        }

        const htmlMessage = populateTemplate(partnershipInquiryTemplate, {
          name: validatedData.name,
          organization: validatedData.organization,
          email: validatedData.email,
          partnershipInterest: validatedData.partnershipInterest,
        });

        const payload = {
          to: adminEmail,
          from: fromEmail,
          subject: `New Partnership Inquiry: ${validatedData.organization}`,
          html: htmlMessage,
        };

        const { error: functionError } = await supabase.functions.invoke(
          "send-email",
          {
            body: payload,
          }
        );

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
        }
      };

      let emailNotificationFailed = false;
      try {
        await sendInquiryNotificationEmail();
      } catch (emailError) {
        emailNotificationFailed = true;
        console.error("Partnership inquiry notification email error:", emailError);
      }

      setRateLimit(RATE_LIMIT_KEY);

      toast({
        title: emailNotificationFailed
          ? "Inquiry Received (Email Issue)"
          : "Inquiry Submitted!",
        description: emailNotificationFailed
          ? "We saved your inquiry but couldn't send the notification email. Our team will review it shortly."
          : "Thanks for reaching out. We'll get back to you soon.",
        variant: emailNotificationFailed ? "destructive" : "default",
      });

      return !emailNotificationFailed;
    } catch (error: unknown) {
      console.error("Partnership inquiry submission error:", error);

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
      } else if (error instanceof Error) {
        toast({
          title: "Submission Failed",
          description: error.message || "Failed to submit inquiry.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Unexpected Error",
          description: "Unable to submit your inquiry. Please try again later.",
          variant: "destructive",
        });
      }

      return false;
    }
  };

  const submitMutation = useMutation({
    mutationFn: submitInquiry,
  });

  return {
    submitInquiry: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
    errors,
  };
};
