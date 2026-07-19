import { BadgeCheck } from "lucide-react";

interface CoachVerificationBadgeProps {
  className?: string;
}

export const CoachVerificationBadge = ({ className = "" }: CoachVerificationBadgeProps) => {
  return (
    <BadgeCheck className={`h-6 w-6 text-white fill-primary ${className}`} />
  );
};