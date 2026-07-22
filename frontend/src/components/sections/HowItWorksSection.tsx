import { ROUTES } from "@/routes";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { strings } from "@/config/strings";
import trainIcon from "../../assets/images/train.png"
import signupIcon from "../../assets/images/signup.png"
import BrowserIcon from "../../assets/images/browse.png"
import { Card, CardContent } from "@/components/ui/card";
import calendarIcon from "../../assets/images/calendar.png"
import bgImage from "../../assets/images/how-it-workd-bg.png"

export const HowItWorksSection = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const personaType =
    (userProfile as any)?.persona_type || (user?.user_metadata as any)?.persona_type || null;
  const shouldShowFindCoach = personaType !== "coach";

  const processSteps = [
    {
      step: 1,
      icon: signupIcon,
      title: "Sign Up & Create Profile",
      description: "Create your athlete or coach profile, set your goals and preferences",
      color: "from-blue-500 to-blue-600",
      bgColor: "from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/30"
    },
    {
      step: 2,
      icon: BrowserIcon,
      title: "Browse & Connect",
      description: "Explore coaches by sport, read reviews, and find your perfect match",
      color: "from-cyan-500 to-cyan-600",
      bgColor: "from-cyan-50 to-cyan-100 dark:from-cyan-950/20 dark:to-cyan-900/30"
    },
    {
      step: 3,
      icon: calendarIcon,
      title: "Schedule & Book",
      description: "Choose flexible scheduling options with secure payment processing",
      color: "from-green-500 to-green-600",
      bgColor: "from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/30"
    },
    {
      step: 4,
      icon: trainIcon,
      title: "Train & Improve",
      description: "Receive personalized coaching and track your progress with analytics",
      color: "from-purple-500 to-purple-600",
      bgColor: "from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/30"
    }
  ];

  const handleGetStarted = () => {
    if (user) {
      // toast({
      //   title: "You've already made an account!",
      //   description: "Get matching with coaches today!",
      //   duration: 4000,
      // });
      navigate(ROUTES.COACHES);
    } else {
      navigate(ROUTES.AUTH);
    }
  };

  return (
    <section
      data-section="value-proposition"
      className="py-12 !bg-white dark:from-slate-900 dark:via-blue-900/30 dark:to-slate-800 px-4"
      aria-labelledby="how-it-works-heading"
    >
      <div className="max-w-8xl mx-auto">
        <div className="text-center mb-16 animate-fade-in">
          <h2
            id="how-it-works-heading"
            className="text-2xl sm:text-4xl font-bold text-slate-800 dark:text-slate-200 mb-4"
          >
            How <span className="text-primary">{strings.brand.name}</span> Works
          </h2>
          <p className="text-xs sm:text-lg text-black max-w-2xl mx-auto">
            Your journey to better performance starts here - connect with world-class coaches in just 4 simple steps
          </p>
        </div>

        {/* Process Steps */}
        <div className="mb-12">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {processSteps.map((step, index) => (
              <div
                key={step.step}
                className="relative animate-fade-in hover-scale"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* <Card className={`bg-gradient-to-br ${step.bgColor} border-0 shadow-lg h-full`}>
                  <CardContent className="p-6 text-center">
                    <div className={`w-16 h-16 mx-auto mb-4 flex items-center justify-center`}>
                      <step.icon className={`h-8 w-8 bg-clip-text ${step.color}`}/>
                    </div>
                    <div className={`w-8 h-8 mx-auto mb-3 rounded-full bg-gradient-to-r ${step.color} flex items-center justify-center text-white text-sm font-bold`}>
                      {step.step}
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card> */}

                <Card className={`border-0 h-full bg-center bg-cover bg-no-repeat`}
                  style={{
                    backgroundImage: `url(${bgImage})`,
                  }}

                >
                  <CardContent className="p-5 w-full h-full flex flex-col rounded-md">
                    <div className="">
                      <div className={`w-8 h-8 flex items-center justify-center text-black text-sm font-bold border-2 border-[#2F659C]`}>
                        {step.step}
                      </div>
                    </div>
                    <section>
                      <img src={step.icon} alt={`Step ${step.step} Icon`} className="mx-auto" />
                      <h3 className="text-lg font-bold text-foreground mb-2 text-center items-center justify-center">{step.title}</h3>
                      <p className="text-sm text-muted-foreground text-center items-center justify-center mb-3">{step.description}</p>
                    </section>
                  </CardContent>
                </Card>

                {/* Connection Line */}
                {/* {index < processSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-primary/30 to-primary/60 transform -translate-y-1/2"></div>
                )} */}
              </div>
            ))}
          </div>

          {/* CTA Button */}
          {shouldShowFindCoach && (
            <div className="text-center mt-8">
              <Button
                size="lg"
                className="animate-fade-in hover-scale"
                onClick={handleGetStarted}
              >
                Find a Coach
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
