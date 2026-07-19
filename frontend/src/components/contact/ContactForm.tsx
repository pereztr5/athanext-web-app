import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
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

export const ContactForm = ({
  onSubmit,
  isSubmitting = false,
  errors = {},
  initialData = {}
}: ContactFormProps) => {
  const [formData, setFormData] = useState<ContactFormData>({
    fullName: initialData.fullName || "",
    email: initialData.email || "",
    subject: initialData.subject || "",
    message: initialData.message || "",
  });

  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

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
    if (localErrors[name] || errors[name]) {
      setLocalErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    setLocalErrors({});

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

  const allErrors = { ...localErrors, ...errors };

  return (
    <form onSubmit={handleSubmit} className="space-y-12 bg-bg-blue-50 p-6 rounded-lg align-middle flex flex-col align-center justify-center">
      {/* Full Name */}
      <div className="space-y-2">
        <Label htmlFor="fullName" className="text-slate-900 font-medium">
          Full Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="fullName"
          name="fullName"
          type="text"
          value={formData.fullName}
          onChange={handleChange}
          placeholder="Enter your full name"
          className={allErrors.fullName ? "border-red-500 focus:ring-red-500" : ""}
          disabled={isSubmitting}
          required
          maxLength={100}
        />
        {allErrors.fullName && (
          <p className="text-xs text-red-500 mt-1">{allErrors.fullName}</p>
        )}
      </div>

      {/* Email Address */}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-slate-900 font-medium">
          Email Address <span className="text-red-500">*</span>
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="your.email@example.com"
          className={allErrors.email ? "border-red-500 focus:ring-red-500" : ""}
          disabled={isSubmitting}
          required
          maxLength={255}
        />
        {allErrors.email && (
          <p className="text-xs text-red-500 mt-1">{allErrors.email}</p>
        )}
      </div>

      {/* Subject */}
      <div className="space-y-2">
        <Label htmlFor="subject" className="text-slate-900 font-medium">
          Subject <span className="text-red-500">*</span>
        </Label>
        <Input
          id="subject"
          name="subject"
          type="text"
          value={formData.subject}
          onChange={handleChange}
          placeholder="What is this regarding?"
          className={allErrors.subject ? "border-red-500 focus:ring-red-500" : ""}
          disabled={isSubmitting}
          required
          maxLength={200}
        />
        {allErrors.subject && (
          <p className="text-xs text-red-500 mt-1">{allErrors.subject}</p>
        )}
      </div>

      {/* Message */}
      <div className="space-y-2">
        <Label htmlFor="message" className="text-slate-900 font-medium">
          Message <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          placeholder="Tell us how we can help you..."
          className={`min-h-[150px] resize-y ${allErrors.message ? "border-red-500 focus:ring-red-500" : ""}`}
          disabled={isSubmitting}
          required
          maxLength={2000}
        />
        <div className="flex justify-between items-center">
          <div>
            {allErrors.message && (
              <p className="text-xs text-red-500">{allErrors.message}</p>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {formData.message.length}/2000
          </p>
        </div>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-full h-12 text-base font-semibold"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send className="mr-2 h-5 w-5" />
            Send Message
          </>
        )}
      </Button>
    </form>
  );
};
