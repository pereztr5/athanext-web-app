import { Mail, Phone, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
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

const colorMap = {
  email: "bg-blue-500",
  phone: "bg-blue-500",
  location: "bg-blue-500",
};

export const ContactInfoCard = ({ method, className = "" }: ContactInfoCardProps) => {
  const Icon = iconMap[method.icon];
  const bgColor = colorMap[method.icon];
  
  const content = (
    <Card className={`p-6 text-center hover:shadow-lg transition-shadow duration-300 ${className}`}>
      <div className={`${bgColor} w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4`}>
        <Icon className="h-8 w-8 text-white" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">
        {method.title}
      </h3>
      <p className="text-blue-600 font-medium mb-1">
        {method.value}
      </p>
      <p className="text-sm text-slate-600">
        {method.description}
      </p>
    </Card>
  );

  if (method.link) {
    return (
      <a 
        href={method.link}
        target={method.icon === 'location' ? '_blank' : undefined}
        rel={method.icon === 'location' ? 'noopener noreferrer' : undefined}
        className="block"
      >
        {content}
      </a>
    );
  }

  return content;
};
