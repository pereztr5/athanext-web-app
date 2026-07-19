import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/contexts/ProfileContext";
import { ROUTES } from "@/routes";
import Banner from "@/assets/Banner-latest.png";

type HeroSectionProps = object

export const HeroSection = (props: HeroSectionProps) => {
  const navigate = useNavigate();
  const { profile } = useProfile();

  const handleBeginTraining = () => {
    if (!profile?.userProfile) {
      // Not logged in, navigate to signup
      navigate(ROUTES.AUTH + '?mode=signup');
    } else {
      const sport = (profile.userProfile as any)?.sport?.toLowerCase?.().trim?.();
      if (sport === 'soccer' || sport === 'football' || sport === 'scoccer') {
        navigate('/soccer');
        return;
      }
      if (sport === 'rowing' || sport === 'crew') {
        navigate('/rowing');
        return;
      }
      navigate(ROUTES.COACHES);
    }
  };

  const handleBeginCoaching = () => {
    if (!profile?.userProfile) {
      // Not logged in, navigate to signup with coach persona preselected
      navigate(ROUTES.AUTH + '?mode=signup&persona=coach');
    } else if (profile.userProfile.persona_type === 'coach') {
      // Logged in as coach, navigate to their profile
      navigate(ROUTES.PROFILE);
    }
  };

  return (
    <section
      className="relative min-h-[40rem] w-full h-[80vh] bg-cover bg-no-repeat bg-center pt-0 sm:pt-0 flex items-center"
      style={{ backgroundImage: `url(${Banner})` }}
    >
      <div className="text-center space-y-10 animate-fade-in w-full px-4 flex flex-col items-center justify-center mb-20">
        
        <div className="flex flex-col space-y-16">
          <h1
            id="hero-heading"
            className=" mt-1 text-3xl sm:text-4xl lg:text-4xl font-bold !text-black !leading-tight mb-2 sm:mb-6"
          >
            THE NEXT GENERATION <br />
            OF ATHLETIC DEVELOPMENT
          </h1>
        </div>

        {/* <p className="text-xs sm:text-2xl text-muted-foreground max-w-[95%] md:max-w-3xl mx-auto !text-white">
          Meet {strings.brand.name}, a sport-specific platform to connect aspiring athletes with elite development coaches and specialized resources in their respective sports. Helping athletes develop, coaches grow, and brands unite.
        </p> */}

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-6">
          {/* Show "Begin Training" for non-logged in users and athletes */}
          {(!profile?.userProfile || profile.userProfile.persona_type === 'athlete' || profile.userProfile.persona_type === 'parent') && (
            <Button
              size="lg"
              className="w-full max-w-[280px] sm:w-auto px-5 py-3 sm:px-8 sm:py-6 !rounded-full text-sm sm:text-lg font-semibold bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 hover-scale"
              onClick={handleBeginTraining}
              aria-describedby="explore-sports-desc"
            >
              Begin Training
            </Button>
          )}
          {/* Show "Begin Coaching" for non-logged in users and coaches */}
          {(!profile?.userProfile || profile.userProfile.persona_type === 'coach') && (
            <Button
              variant="outline"
              size="lg"
              className="w-full max-w-[280px] sm:w-auto px-5 py-3 sm:px-8 sm:py-6 !rounded-full text-sm sm:text-lg !bg-transparent !text-primary border border-primary font-semibold hover:bg-primary hover:text-primary-foreground transition-all duration-300 hover-scale"
              onClick={handleBeginCoaching}
              aria-describedby="join-early-desc"
            >
              Begin Coaching
            </Button>
          )}
          <span id="join-early-desc" className="sr-only">Sign up for early access to our platform</span>
        </div>
      </div>
    </section >
  );
};
