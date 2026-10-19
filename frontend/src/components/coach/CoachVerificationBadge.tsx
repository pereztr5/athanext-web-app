import { BadgeCheck } from "@/components/icons";

interface CoachVerificationBadgeProps {
  className?: string;
}

export const CoachVerificationBadge = ({ className = "" }: CoachVerificationBadgeProps) => {
  return (
    <BadgeCheck className={`h-6 w-6 text-light fill-primary ${className}`} />
  );
};