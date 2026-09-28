import { Navigate } from "react-router-dom";
import { CoachAvailabilitySection } from "@/components/coach-profile/CoachAvailabilitySection";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { ROUTES } from "@/routes";

const AvailabilityPage = () => {
  const { isCoach, ready } = useRole();
  const { userProfile } = useAuth();
  const coachId = userProfile?.coach_id;

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#EAEADF] border-t-[#0054B4]" />
      </div>
    );
  }

  if (!isCoach) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  if (!coachId) {
    return (
      <div className="mx-auto max-w-[1000px] px-4 py-10 md:px-0">
        <h1 className="text-[32px] font-bold leading-[28px] tracking-[-1.6px] text-[#1A202C]">Availability</h1>
        <p className="mt-[10px] text-[16px] leading-[18px] tracking-[-0.48px] text-[#767980]">
          Your coach profile is still being set up. Finish onboarding to manage availability.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-hidden px-4 pb-16 md:px-10">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
        <header className="flex flex-col gap-[10px]">
          <h1 className="text-[32px] font-bold leading-[28px] tracking-[-1.6px] text-[#1A202C]">Availability</h1>
          <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#767980]">
            Set when athletes can book you.
          </p>
        </header>
        <CoachAvailabilitySection coachId={coachId} allowEditing />
      </div>
    </div>
  );
};

export default AvailabilityPage;
