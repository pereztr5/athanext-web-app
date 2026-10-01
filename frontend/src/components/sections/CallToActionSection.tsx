import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, Award, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface CallToActionSectionProps {
  email: string;
  setEmail: (email: string) => void;
  isLoading: boolean;
  errors: { email?: string };
  onEmailSignup: (e: React.FormEvent) => void;
}

export const CallToActionSection = ({ 
  email, 
  setEmail, 
  isLoading, 
  errors, 
  onEmailSignup 
}: CallToActionSectionProps) => {
  const { user } = useAuth();

  if (user) return null;

  return (<section id="signup-section" className="bg-[#233050] py-16" aria-labelledby="cta-heading">
    
      <div className="max-w-4xl mx-auto px-4 text-center sm:px-6 lg:px-8">
        <div className="animate-fade-in">
          <h2 id="cta-heading" className="text-2xl sm:text-4xl font-bold text-white mb-4">
            Ready to Transform Your Training?
          </h2>
          <p className="text-sm sm:text-lg text-white mb-6 max-w-2xl mx-auto">
            Register now and connect with elite coaches to start your journey to peak performance. 
            Take your training to the next level with personalized coaching.
          </p>
          
          <form onSubmit={onEmailSignup} className="max-w-md mx-auto space-y-4" noValidate>
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`h-12 text-base ${errors.email ? 'border-destructive' : ''}`}
                    aria-describedby={errors.email ? 'email-error' : 'email-help'}
                    aria-invalid={!!errors.email}
                    disabled={isLoading}
                  />
                  {errors.email && (
                    <p id="email-error" className="text-destructive text-sm mt-1 text-left" role="alert">
                      {errors.email}
                    </p>
                  )}
                </div>
                <Button 
                  type="submit" 
                  size="lg" 
                  className="px-6 h-12 font-semibold hover-scale transition-all duration-300"
                  disabled={isLoading}
                  aria-describedby="join-beta-desc"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Registering...
                    </>
                  ) : (
                    'Register Now'
                  )}
                </Button>
              </div>
              <p id="email-help" className="text-xs text-white text-center mt-1">
                Get started with personalized coaching today
              </p>
              <span id="join-beta-desc" className="sr-only">Register to start connecting with coaches</span>
            </div>
          </form>
          
          <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm text-white">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-white" />
              <span>Global Coach Network</span>
            </div>
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-white" />
              <span>Certified Professionals</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-white" />
              <span>Flexible Scheduling</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
