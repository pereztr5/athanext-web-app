import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { CoachApplicationModal } from "@/components/CoachApplicationModal";
import { strings } from "@/config/strings";
import { useProfile } from "@/contexts/ProfileContext";
import { ROUTES } from "@/routes";
import { getConfigurationValue } from "@/api/configurations";

const BecomeACoach = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  const handleApplyToCoach = () => {
    if (!profile?.userProfile) {
      // Not logged in, navigate to signup with coach persona preselected
      navigate(ROUTES.AUTH + '?mode=signup&persona=coach');
    } else if (profile.userProfile.persona_type === 'coach') {
      // Logged in as coach, navigate to their profile
      navigate(ROUTES.PROFILE);
    }
    // If athlete/parent, button is disabled so this won't be called
  };

  const isAthlete = profile?.userProfile?.persona_type === 'athlete' || profile?.userProfile?.persona_type === 'parent';
  const isCoach = profile?.userProfile?.persona_type === 'coach';
  const fallbackAdminEmail = "support@athanext.com";

  useEffect(() => {
    const loadAdminEmail = async () => {
      const { data } = await getConfigurationValue("contact_admin_email");
      if (data && typeof data === "string" && data.trim()) {
        setAdminEmail(data.trim());
      }
    };
    void loadAdminEmail();
  }, []);

  const requirements = [
    strings.coach.requirement1,
    strings.coach.requirement2,
    // strings.coach.requirement3,
    // strings.coach.requirement4,
    strings.coach.requirement5
  ];

  const howItWorks = [
    {
      step: "1",
      title: strings.coach.howItWorksStep1Title,
      description: strings.coach.howItWorksStep1Desc
    },
    {
      step: "2",
      title: strings.coach.howItWorksStep2Title,
      description: strings.coach.howItWorksStep2Desc
    },
    {
      step: "3",
      title: strings.coach.howItWorksStep3Title,
      description: strings.coach.howItWorksStep3Desc
    },
    {
      step: "4",
      title: strings.coach.howItWorksStep4Title,
      description: strings.coach.howItWorksStep4Desc
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-100/40 via-blue-50/30 to-slate-100/20 dark:from-blue-900/40 dark:via-blue-800/30 dark:to-slate-900/20 pt-24 pb-12 px-4 border-b border-primary/20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.15),transparent_50%)]" />
        <div className="relative container mx-auto max-w-6xl text-center">
          <div className="mb-8 animate-fade-in">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              <span className="text-slate-800 dark:text-slate-200">Become an AthaNext </span>
              <span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">Coach</span>
            </h1>
            <p className="text-xl sm:text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
              {strings.coach.becomeCoachHeroSubtitle}
            </p>
            <p className="text-lg text-slate-700 dark:text-slate-300 max-w-3xl mx-auto">
              {strings.coach.becomeCoachHeroDescription}
            </p>
          </div>

          <div className="flex justify-center">
            <Button 
              size="lg" 
              onClick={() => {
                const requirementsSection = document.getElementById('requirements');
                if (requirementsSection) {
                  const elementPosition = requirementsSection.getBoundingClientRect().top;
                  const offsetPosition = elementPosition + window.pageYOffset - 100;
                  
                  window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                  });
                }
              }}
              className="text-lg px-8 py-6"
            >
              {strings.buttons.learnMore}
            </Button>
          </div>
        </div>
      </section>

      {/* Requirements Section */}
      <section id="requirements" className="py-12 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 animate-fade-in">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3 text-slate-800 dark:text-slate-200">
              Coach&nbsp;<span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">Requirements</span>
            </h2>
            <p className="text-base text-slate-700 dark:text-slate-300">
              {strings.coach.coachRequirementsDescription}
            </p>
          </div>

          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-blue-500/5">
            <CardContent className="p-5 sm:p-6">
              <ul className="space-y-3">
                {requirements.map((requirement, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-800 dark:text-slate-200 text-sm font-medium">{requirement}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary/5 to-blue-500/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3 text-slate-800 dark:text-slate-200">
              How It&nbsp;<span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">Works</span>
            </h2>
            <p className="text-base text-slate-700 dark:text-slate-300">
              {strings.coach.howItWorksDescription}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {howItWorks.map((item, index) => (
              <Card 
                key={index}
                className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-blue-500/5 transition-all duration-300"
              >
                <CardContent className="p-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center mb-3 mx-auto text-white text-lg font-bold">
                    {item.step}
                  </div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">{item.title}</h3>
                  <p className="text-slate-700 dark:text-slate-300 text-xs">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="max-w-4xl mx-auto text-center animate-fade-in">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-slate-800 dark:text-slate-200">
            Ready to Join Our&nbsp;<span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">Coaching Network</span>?
          </h2>
          <p className="text-lg text-slate-700 dark:text-slate-300 mb-6">
            {strings.coach.readyToJoinNetworkSubtitle}
          </p>
          <Button 
            size="lg"
            onClick={handleApplyToCoach}
            disabled={isAthlete}
            className="text-lg px-8 py-6"
          >
            {isCoach ? 'Go to Profile' : strings.coach.applyToBecomeCoachButton}
          </Button>
          {isAthlete && (
            <p className="text-sm text-muted-foreground mt-4">
              This option is only available for coaches. Please contact{" "}
              <a
                href={`mailto:${adminEmail || fallbackAdminEmail}`}
                className="font-semibold text-primary hover:underline"
              >
                {adminEmail || fallbackAdminEmail}
              </a>{" "}
              if you're an athlete wanting to become a coach!
            </p>
          )}
        </div>

        <CoachApplicationModal 
          open={isModalOpen} 
          onOpenChange={setIsModalOpen}
        />
      </section>
    </div>
  );
};

export default BecomeACoach;
