import { Button } from '@/components/ui/button';
import { MapPin, Award, Clock } from "@/components/icons";
import { PRIMARY } from '@/config/colors';
import { strings } from "@/config/strings";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/routes";
import { useAuth } from "@/contexts/AuthContext";
import { PROFILE_TYPE } from "@/utils/db";

export function AboutCTA() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const showButtons = !user;

  return (
    <section className="w-full py-20 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#2C3E5F' }}>
      <div className="max-w-6xl mx-auto">
        {/* Main heading */}
        <div className="text-center mb-8">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-8">
            Join the {strings.brand.name} Community
          </h2>
          <p className="text-lg text-gray-200 max-w-3xl mx-auto">
            Whether you're an athlete looking to elevate your game or a coach ready to share your expertise, we'd love to have you join us.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className={`flex flex-col sm:flex-row gap-4 justify-center ${showButtons ? "mb-8" : ""}`}>
          {showButtons && (
            <>
              <Button
                size="lg"
                className="text-white px-10 py-7 rounded-full text-lg font-semibold hover:opacity-90 transition-opacity"
                style={{ backgroundColor: PRIMARY.main }}
                onClick={() => navigate(`${ROUTES.AUTH}?mode=signup&persona=${PROFILE_TYPE.athlete}`)}
              >
                Sign Up as Athlete
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 bg-transparent text-white hover:bg-slate-300/10 px-10 py-6 rounded-full text-lg font-semibold transition-all"
                style={{ borderColor: 'white' }}
                onClick={() => navigate(ROUTES.BECOME_COACH)}
              >
                Become a Coach
              </Button>
            </>
          )}
        </div>

        {/* Features/Benefits Row */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-4">
          {/* Global Coach Network */}
          <div className="flex items-center gap-3">
            <MapPin className="h-6 w-6 text-gray-300" />
            <p className="text-white font-medium text-base">Global Coach Network</p>
          </div>

          {/* Certified Professionals */}
          <div className="flex items-center gap-3">
            <Award className="h-6 w-6 text-gray-300" />
            <p className="text-white font-medium text-base">Certified Professionals</p>
          </div>

          {/* Flexible Scheduling */}
          <div className="flex items-center gap-3">
            <Clock className="h-6 w-6 text-gray-300" />
            <p className="text-white font-medium text-base">Flexible Scheduling</p>
          </div>
        </div>
      </div>
    </section>
  );
}
