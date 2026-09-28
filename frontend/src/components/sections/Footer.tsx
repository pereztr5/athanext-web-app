import { Link } from "react-router-dom";
import { strings } from "@/config/strings";
import { ROUTES } from "@/routes";
import logo from "@/assets/AthaNext-Logo.svg";
import { useRole } from "@/hooks/useRole";

interface FooterProps {
  onSportClick: (sport: string) => void;
}

const HEADING = "text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]";
const LIST = "flex flex-col gap-2 text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]";
const LINK = "transition-colors hover:text-[#1A202C]";

export const Footer = ({ onSportClick }: FooterProps) => {
  const { role: personaType } = useRole();

  return (
    <footer
      className="bg-[#F7F7F0] border-t border-[#EAEADF] text-[#1A202C] pt-10 pb-[25px]"
      role="contentinfo"
    >
      <div className="max-w-8xl mx-auto px-5">
        <div className="grid md:grid-cols-5 gap-6">
          {/* Brand */}
          <div className="md:col-span-2 flex flex-col gap-3.5">
            <div className="self-start">
              <img src={logo} alt={strings.brand.name} className="h-7 w-auto" />
              <span className="sr-only">{strings.brand.name}</span>
            </div>
            <p className="max-w-[320px] text-pretty text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
              Coaching for athletes who want to get better. Book sessions, track progress and stay in touch with your coach in one place.
            </p>
          </div>

          {/* Sports */}
          <div className="flex flex-col gap-3">
            <h4 className={HEADING}>Sports</h4>
            <ul className={LIST}>
              <li>
                <button type="button" onClick={() => onSportClick("soccer")} className={LINK}>
                  Soccer
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onSportClick("rowing")} className={LINK}>
                  Rowing
                </button>
              </li>
            </ul>
          </div>

          {/* Explore */}
          <div className="flex flex-col gap-3">
            <h4 className={HEADING}>Explore</h4>
            <ul className={LIST}>
              <li>
                <Link to={ROUTES.WHY_ATHALINK} className={LINK}>
                  Why AthaNext
                </Link>
              </li>
              <li>
                <Link to={ROUTES.COACHES} className={LINK}>
                  All coaches
                </Link>
              </li>
              <li>
                <Link to={ROUTES.PARTNERSHIPS} className={LINK}>
                  Resources
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div className="flex flex-col gap-3">
            <h4 className={HEADING}>Company</h4>
            <ul className={LIST}>
              {personaType !== "coach" && (
                <li>
                  <Link to={ROUTES.BECOME_COACH} className={LINK}>
                    Become a coach
                  </Link>
                </li>
              )}
              <li>
                <Link to={ROUTES.ABOUT} className={LINK}>
                  About
                </Link>
              </li>
              <li>
                <Link to={ROUTES.CONTACT_US} className={LINK}>
                  Contact
                </Link>
              </li>
              <li>
                <Link to={ROUTES.PRIVACY_POLICY} className={LINK}>
                  Privacy
                </Link>
              </li>
              <li>
                <Link to={ROUTES.TERMS_AND_CONDITIONS} className={LINK}>
                  Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-[30px] mb-5 h-px bg-[#EAEADF]" role="separator" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-2 md:gap-0 text-[12px] leading-[14px] tracking-[-0.03em] text-[#A3A6AB]">
          <p>&copy; {new Date().getFullYear()} {strings.brand.name}</p>
          <p>Boston, MA</p>
        </div>
      </div>
    </footer>
  );
};
