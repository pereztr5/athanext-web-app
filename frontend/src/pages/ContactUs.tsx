import { ContactHero, ContactInfoCard, ContactForm } from "@/components/contact";
import { useContactSubmission } from "@/hooks/useContactSubmission";
import { useContactInfo } from "@/hooks/useContactInfo";
import { useRole } from "@/hooks/useRole";
import { FALLBACK_CONTACT_METHODS } from "@/utils/db";
import type { ContactMethod, ContactFormData } from "@/types/contact";
import contactBanner from "@/assets/images/contact-us-hero-section.svg";
import contactMessageImg from "@/assets/images/Trophy.svg";

/**
 * Contact Us Page Component
 * Displays contact information, form, and handles submissions with security
 */
const ContactUs = () => {
  const { submitContactForm, isSubmitting, errors } = useContactSubmission();
  const { contactInfo, loading: contactInfoLoading } = useContactInfo();
  const { isAuthenticated, ready } = useRole();

  // Dynamic contact methods from database
  const contactMethods: ContactMethod[] = (contactInfo
    ? [
        {
          icon: "email" as const,
          title: "Email Us",
          value: contactInfo.email || FALLBACK_CONTACT_METHODS[0].value,
          description: "We typically respond within 24 hours",
          link: `mailto:${contactInfo.email || FALLBACK_CONTACT_METHODS[0].value}`,
        },
        {
          icon: "phone" as const,
          title: "Call Us",
          value: contactInfo.contact_number || FALLBACK_CONTACT_METHODS[1].value,
          description: "Mon-Fri from 8am to 8pm PST",
          link: `tel:${contactInfo.contact_number?.replace(/\D/g, "") || "15551234568"}`,
        },
        {
          icon: "location" as const,
          title: "Visit Us",
          value: contactInfo.location || FALLBACK_CONTACT_METHODS[2].value,
          description: "Building the future of athletic development",
          link: `https://maps.google.com/?q=${encodeURIComponent(
            contactInfo.location || "San Francisco, CA"
          )}`,
        },
      ]
    : FALLBACK_CONTACT_METHODS).filter((method) => method.icon !== "phone");

  const handleFormSubmit = async (formData: ContactFormData): Promise<boolean> => {
    return await submitContactForm(formData);
  };

  return (
    <div className={ready && isAuthenticated ? "min-h-screen pt-6" : "min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pt-[3.8rem]"}>
      {/* Hero Section */}
      <ContactHero
        backgroundImage={contactBanner}
        title="Get in Touch"
        description="Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible."
      />

      {/* Contact Information Section */}
      <main className="px-4">
        <section className="max-w-8xl mx-auto py-12 md:py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Contact Information
            </h2>
            <p className="text-slate-600 text-lg">
              Multiple ways to reach our team
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {contactMethods.map((method, index) => (
              <ContactInfoCard
                key={`${method.icon}-${index}`}
                method={method}
              />
            ))}
          </div>
        </section>
      </main>

      {/* Contact Form Section */}
      <section className="max-w-7xl mx-auto px-4 py-12 md:py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Send Us a Message
          </h2>
          <p className="text-slate-600 text-lg">
            We want to be the best. Let us know how we can improve, and we will be in touch soon!
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-10">
          <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-center">
            {/* Vertical divider for desktop */}
            <div
              className="hidden lg:block absolute inset-y-0 left-1/2 w-px bg-slate-200"
              aria-hidden="true"
            />

            {/* Image */}
            <div className="order-2 lg:order-1 flex items-center justify-center">
              <div className="w-full flex items-center justify-center px-2">
                <img
                  src={contactMessageImg}
                  alt="Contact us illustration with sports equipment"
                  className="max-w-md w-full h-auto object-contain"
                />
              </div>
            </div>

            {/* Form */}
            <div className="order-1 lg:order-2">
              <div className="p-0 lg:px-4">
                <ContactForm
                  onSubmit={handleFormSubmit}
                  isSubmitting={isSubmitting}
                  errors={errors}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Additional Info Section */}
      <section className="bg-slate-900 text-white py-12 md:py-16 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h3 className="text-2xl md:text-3xl font-bold mb-4">
            Need Immediate Assistance?
          </h3>
          <p className="text-slate-300 text-lg mb-6 max-w-2xl mx-auto">
            For urgent matters or immediate support, please call us directly during business hours.
            Our team is ready to help you with any questions or concerns.
          </p>
          <span className="inline-flex items-center justify-center bg-slate-600 text-white font-semibold px-8 py-3 rounded-full opacity-80 cursor-not-allowed">
            Will be Available soon
          </span>
        </div>
      </section>
    </div>
  );
};

export default ContactUs;
