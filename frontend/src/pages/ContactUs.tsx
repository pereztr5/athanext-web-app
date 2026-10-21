import { ContactHero, ContactInfoCard, ContactForm } from "@/components/contact";
import { useContactSubmission } from "@/hooks/useContactSubmission";
import { useContactInfo } from "@/hooks/useContactInfo";
import { useRole } from "@/hooks/useRole";
import { FALLBACK_CONTACT_METHODS } from "@/utils/db";
import type { ContactMethod, ContactFormData } from "@/types/contact";
import contactBanner from "@/assets/images/contact-us-hero-section.svg";
import contactMessageImg from "@/assets/images/Trophy.svg";

/**
 * Contact us page component
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
          title: "Email us",
          value: contactInfo.email || FALLBACK_CONTACT_METHODS[0].value,
          description: "We typically respond within 24 hours",
          link: `mailto:${contactInfo.email || FALLBACK_CONTACT_METHODS[0].value}`,
        },
        {
          icon: "phone" as const,
          title: "Call us",
          value: contactInfo.contact_number || FALLBACK_CONTACT_METHODS[1].value,
          description: "Monday to Friday, 8am to 8pm PST",
          link: `tel:${contactInfo.contact_number?.replace(/\D/g, "") || "15551234568"}`,
        },
        {
          icon: "location" as const,
          title: "Visit us",
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
    <div className={ready && isAuthenticated ? "overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12" : "overflow-x-hidden px-4 pb-12 md:px-5"}>
      <div className="mx-auto flex w-full max-w-wrapper flex-col gap-4 md:gap-6">
        <ContactHero
          backgroundImage={contactBanner}
          title="Get in touch"
          description="Have questions? Send us a message and we'll reply as soon as we can."
        />

        {/* Contact information */}
        <section className="flex flex-col gap-4" aria-labelledby="contact-info-heading">
          <div className="flex flex-col gap-1">
            <h2 id="contact-info-heading" className="text-section text-dark">Contact information</h2>
            <p className="text-body-m text-dark-300">Ways to reach our team</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            {contactMethods.map((method, index) => (
              <ContactInfoCard
                key={`${method.icon}-${index}`}
                method={method}
              />
            ))}
          </div>
        </section>

        {/* Contact form */}
        <section className="flex flex-col gap-4" aria-labelledby="contact-form-heading">
          <div className="flex flex-col gap-1">
            <h2 id="contact-form-heading" className="text-section text-dark">Send us a message</h2>
            <p className="text-body-m text-dark-300">
              Let us know how we can improve, and we'll be in touch soon.
            </p>
          </div>

          <div className="rounded-card border border-light-525 bg-light-300 px-[18px] pb-5 pt-[22px] md:px-[25px] md:pb-[25px] md:pt-[30px]">
            <div className="relative grid grid-cols-1 items-center gap-6 lg:grid-cols-2">
              {/* Vertical divider for desktop */}
              <div
                className="absolute inset-y-0 left-1/2 hidden w-px bg-light-525 lg:block"
                aria-hidden="true"
              />

              {/* Image */}
              <div className="order-2 flex items-center justify-center lg:order-1">
                <div className="flex w-full items-center justify-center px-2">
                  <img
                    src={contactMessageImg}
                    alt="Contact us illustration with sports equipment"
                    className="h-auto w-full max-w-md object-contain"
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

        {/* Additional info */}
        <section className="flex flex-col items-center gap-3 rounded-card border border-light-525 bg-light-400 px-[18px] pb-5 pt-[22px] text-center md:px-[25px] md:pb-[25px] md:pt-[30px]">
          <h3 className="text-card-title text-dark">Need help right away?</h3>
          <p className="max-w-2xl text-paragraph text-dark-300">
            For urgent matters, call us during business hours. Our team is ready to help with any questions or concerns.
          </p>
          <span className="inline-flex h-control cursor-not-allowed items-center justify-center rounded-control border border-light-525 bg-light-400 px-4 text-label text-dark-200">
            Coming soon
          </span>
        </section>
      </div>
    </div>
  );
};

export default ContactUs;
