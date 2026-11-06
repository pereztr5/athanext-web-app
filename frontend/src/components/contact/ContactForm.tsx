import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "@/components/icons";
import type { ContactFormData } from "@/types/contact";

/**
 * Contact form component with validation and error handling
 * Reusable form component for collecting user messages
 */
interface ContactFormProps {
  onSubmit: (data: ContactFormData) => Promise<boolean>;
  isSubmitting?: boolean;
  errors?: Record<string, string>;
  initialData?: Partial<ContactFormData>;
}

const NO_ERRORS: Record<string, string> = {};

export const ContactForm = ({
  onSubmit,
  isSubmitting = false,
  errors = NO_ERRORS,
  initialData = {}
}: ContactFormProps) => {
  const [formData, setFormData] = useState<ContactFormData>({
    fullName: initialData.fullName || "",
    email: initialData.email || "",
    subject: initialData.subject || "",
    message: initialData.message || "",
  });

  // Fields edited since the current `errors` arrived: their error is stale, so hide it.
  const [editedFields, setEditedFields] = useState<ReadonlySet<string>>(() => new Set());
  const [errorsShown, setErrorsShown] = useState(errors);
  if (errorsShown !== errors) {
    setErrorsShown(errors);
    setEditedFields(new Set());
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (!name || !e.target) return;

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error for this field
    if (errors[name] && !editedFields.has(name)) {
      setEditedFields(prev => new Set(prev).add(name));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    try {
      const success = await onSubmit(formData);

      // Only reset form if submission was successful
      if (success) {
        setFormData({
          fullName: "",
          email: "",
          subject: "",
          message: "",
        });
      }

    } catch (error) {
      // Error handling is done in parent component
      console.error('Form submission error:', error);
    }
  };

  const allErrors = Object.fromEntries(
    Object.entries(errors).filter(([field]) => !editedFields.has(field))
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col justify-center gap-5">
      {/* Full name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fullName" className="text-label-xsm text-dark-300">
          Full name <span className="text-error-700">*</span>
        </Label>
        <Input
          id="fullName"
          name="fullName"
          type="text"
          value={formData.fullName}
          onChange={handleChange}
          placeholder="Enter your full name"
          className={allErrors.fullName ? "border-error-600" : ""}
          disabled={isSubmitting}
          required
          maxLength={100}
        />
        {allErrors.fullName && (
          <p className="text-caption text-error-700">{allErrors.fullName}</p>
        )}
      </div>

      {/* Email address */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email" className="text-label-xsm text-dark-300">
          Email address <span className="text-error-700">*</span>
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="your.email@example.com"
          className={allErrors.email ? "border-error-600" : ""}
          disabled={isSubmitting}
          required
          maxLength={255}
        />
        {allErrors.email && (
          <p className="text-caption text-error-700">{allErrors.email}</p>
        )}
      </div>

      {/* Subject */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="subject" className="text-label-xsm text-dark-300">
          Subject <span className="text-error-700">*</span>
        </Label>
        <Input
          id="subject"
          name="subject"
          type="text"
          value={formData.subject}
          onChange={handleChange}
          placeholder="What is this regarding?"
          className={allErrors.subject ? "border-error-600" : ""}
          disabled={isSubmitting}
          required
          maxLength={200}
        />
        {allErrors.subject && (
          <p className="text-caption text-error-700">{allErrors.subject}</p>
        )}
      </div>

      {/* Message */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="message" className="text-label-xsm text-dark-300">
          Message <span className="text-error-700">*</span>
        </Label>
        <Textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          placeholder="Tell us how we can help"
          className={cn("min-h-[150px] resize-y", allErrors.message && "border-error-600")}
          disabled={isSubmitting}
          required
          maxLength={2000}
        />
        <div className="flex justify-between items-center">
          <div>
            {allErrors.message && (
              <p className="text-caption text-error-700">{allErrors.message}</p>
            )}
          </div>
          <p className="text-caption tabular-nums text-dark-300">
            {formData.message.length}/2000
          </p>
        </div>
      </div>

      {/* Submit button */}
      <Button
        type="submit"
        disabled={isSubmitting}
        size="lg"
        className="w-full"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" strokeWidth={1.5} />
            Sending…
          </>
        ) : (
          <>
            <Send strokeWidth={1.5} />
            Send message
          </>
        )}
      </Button>
    </form>
  );
};
