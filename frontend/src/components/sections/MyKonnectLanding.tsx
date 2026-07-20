import { useNavigate } from "react-router-dom";
import { useTopCoaches } from "@/hooks/useTopCoaches";
import { useEmailSignup } from "@/hooks/useEmailSignup";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { HeroSection } from "@/components/sections/HeroSection";
import { SportsSection } from "@/components/sections/SportsSection";
import { CoachesSection } from "@/components/sections/CoachesSection";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";

import { CallToActionSection } from "@/components/sections/CallToActionSection";
import { BackToTopButton } from "@/components/sections/BackToTopButton";
import { ROUTES } from "@/routes";

const MyKonnectLanding = () => {
  const navigate = useNavigate();

  // Custom hooks
  const { coaches, coachesLoading } = useTopCoaches(3);
  const { email, setEmail, isLoading: emailLoading, errors, handleEmailSignup } = useEmailSignup();
  const showBackToTop = useScrollToTop();

  // Handle sport navigation
  const handleSportClick = (sport: string) => {
    navigate(`/${sport}`);
  };


  return (
    <div className="flex flex-col bg-gradient-to-br from-blue-50 via-slate-50/30 to-slate-100/20 dark:from-blue-900 dark:via-slate-950/30 dark:to-slate-950/20">
      {/* Add top padding to account for fixed header */}
      <div className="mt-[3.8rem] flex-1">

        <HeroSection />

        <SportsSection onSportClick={handleSportClick} />

        <HowItWorksSection />

        <CoachesSection
          coaches={coaches}
          coachesLoading={coachesLoading}
          onViewProfile={(coachId) => navigate(`/coach/${coachId}`)}
          onSession={(coachId) =>
            navigate(`/coach/${coachId}`, { state: { scrollToAvailability: true } })
          }
          onViewPackages={(coachId) =>
            navigate(`/coach/${coachId}`, { state: { scrollToPackages: true } })
          }
        />
        <CallToActionSection
          email={email}
          setEmail={setEmail}
          isLoading={emailLoading}
          errors={errors}
          onEmailSignup={handleEmailSignup}
        />
      </div>

      <BackToTopButton show={showBackToTop} />
    </div>
  );
};

export default MyKonnectLanding;
