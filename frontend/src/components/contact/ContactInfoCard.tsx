import { Mail, Phone, MapPin } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ContactMethod } from "@/types/contact";

/**
 * Contact information card component
 * Displays contact methods (email, phone, location) with icons
 */
interface ContactInfoCardProps {
  method: ContactMethod;
  className?: string;
}

const iconMap = {
  email: Mail,
  phone: Phone,
  location: MapPin,
};

export const ContactInfoCard = ({ method, className = "" }: ContactInfoCardProps) => {
  const Icon = iconMap[method.icon];

  const content = (
    <Card
      className={cn(
        "flex flex-col items-center gap-2 px-[18px] pb-5 pt-[22px] text-center transition-colors md:px-[25px] md:pb-[25px] md:pt-[30px]",
        method.link && "hover:bg-light-200",
        className
      )}
    >
      <div className="mb-2 flex size-12 items-center justify-center rounded-control border border-primary-300 bg-primary-50 text-primary">
        <Icon className="size-6" strokeWidth={1.5} />
      </div>
      <h3 className="text-subtitle text-dark">{method.title}</h3>
      <p className="text-label-sm text-primary">{method.value}</p>
      <p className="text-caption text-dark-300">{method.description}</p>
    </Card>
  );

  if (method.link) {
    return (
      <a
        href={method.link}
        target={method.icon === 'location' ? '_blank' : undefined}
        rel={method.icon === 'location' ? 'noopener noreferrer' : undefined}
        className="block rounded-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {content}
      </a>
    );
  }

  return content;
};
