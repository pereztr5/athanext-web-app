import { PageHeader } from "@/components/ui/page-header";

/**
 * Contact page header: page title and a short description.
 * `backgroundImage` is kept for API compatibility; the design system has no image heroes.
 */
interface ContactHeroProps {
  backgroundImage?: string;
  title?: string;
  description?: string;
}

export const ContactHero = ({
  title = "Get in touch",
  description = "Have questions? Send us a message and we'll reply as soon as we can.",
}: ContactHeroProps) => {
  return <PageHeader title={title} subtitle={description} />;
};
