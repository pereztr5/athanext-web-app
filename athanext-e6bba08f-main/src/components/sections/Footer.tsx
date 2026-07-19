import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";
import { strings } from "@/config/strings";
import { ROUTES } from "@/routes";
import logo from "@/assets/AthaNext-Logo-White.svg";
import { useAuth } from "@/contexts/AuthContext";

interface FooterProps {
  onSportClick: (sport: string) => void;
}

export const Footer = ({ onSportClick }: FooterProps) => {
  const { user } = useAuth();
  const personaType = (user?.user_metadata as any)?.persona_type || null;

  return (
    <footer className="bg-gradient-to-br from-slate-800 via-gray-900 to-slate-900 dark:from-slate-900 dark:via-black dark:to-slate-800 text-white py-12" role="contentinfo">
      <div className="max-w-8xl mx-auto px-4">
        <div className="grid md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="mb-3">
              <img src={logo} alt={strings.brand.name} className="h-10 w-auto" />
              <span className="sr-only">{strings.brand.name}</span>
            </div>
            <p className="text-gray-300 mb-4 max-w-sm">
              Connecting athletes with world-class coaching. Unlock your potential with personalized training from elite professionals.
            </p>
          </div>

          {/* Sports */}
          <div>
            <h4 className="font-semibold text-white mb-4">Sports</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>
                <button 
                  onClick={() => onSportClick("soccer")}
                  className="hover:text-white transition-colors"
                >
                  Soccer Training
                </button>
              </li>
              <li>
                <button 
                  onClick={() => onSportClick("rowing")}
                  className="hover:text-white transition-colors"
                >
                  Rowing Training
                </button>
              </li>
            </ul>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-semibold text-white mb-4">Navigation</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>
                <Link 
                  to={ROUTES.WHY_ATHALINK}
                  className="hover:text-white transition-colors"
                >
                  {strings.titles.whyMyKonnect}
                </Link>
              </li>
              <li>
                <Link 
                  to={ROUTES.COACHES}
                  className="hover:text-white transition-colors"
                >
                  {strings.titles.allCoaches}
                </Link>
              </li>
              <li>
                <Link 
                  to={ROUTES.PARTNERSHIPS}
                  className="hover:text-white transition-colors"
                >
                  Specialized Resources
                </Link>
              </li>
            </ul>
          </div>

          {/* Platform */}
          <div>
            <h4 className="font-semibold text-white mb-4">Platform</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              {personaType !== "coach" && (
                <li>
                  <Link 
                    to={ROUTES.BECOME_COACH}
                    className="hover:text-white transition-colors"
                  >
                    Become a Coach
                  </Link>
                </li>
              )}
              <li>
                <Link 
                  to={ROUTES.ABOUT}
                  className="hover:text-white transition-colors"
                >
                  {strings.about.navigation.aboutUs}
                </Link>
              </li>
              <li>
                <Link 
                  to={ROUTES.CONTACT_US}
                  className="hover:text-white transition-colors"
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <Link 
                  to={ROUTES.PRIVACY_POLICY}
                  className="hover:text-white transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link 
                  to={ROUTES.TERMS_AND_CONDITIONS}
                  className="hover:text-white transition-colors"
                >
                  Terms & Conditions
                </Link>
              </li>
            </ul>
          </div>
        </div>
        
        <Separator className="my-6" />
        
        <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
          <p>&copy; {new Date().getFullYear()} {strings.brand.name}. All rights reserved.</p>
          <p className="mt-2 md:mt-0">
            Building the future of athletic development.{" "}
            {/* <span className="hidden md:inline">| </span>
            <span className="block md:inline">
              {strings.brand.poweredBy.replace('HazenTech', '')}
              <a
                href="https://hazentech.com/it-services/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                HazenTech
              </a>
            </span> */}
          </p>
        </div>
      </div>
    </footer>
  );
};
