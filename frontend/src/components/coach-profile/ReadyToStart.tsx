import { Button } from "@/components/ui/button";
import { CoachProfileCard, CoachProfileCardHeader } from "./CoachProfileCard";

interface ReadyToStartProps {
  onFreeConsultation: () => void;
  onBookSession: () => void;
  onViewPackages: () => void;
  hourlyRate?: number;
  /** @deprecated no longer used by the brand-kit card */
  buttonClass?: string;
}

export function ReadyToStart({ onFreeConsultation }: ReadyToStartProps) {
  return (
    <CoachProfileCard>
      <div className="flex flex-col gap-[10px]">
        <CoachProfileCardHeader title="Ready to start" />
        <p className="text-body-m text-dark-300">
          Book your first session and get a training plan built around your goals.
        </p>
      </div>
      <Button className="w-full" onClick={onFreeConsultation}>
        Free 15-minute consultation
      </Button>
    </CoachProfileCard>
  );
}
