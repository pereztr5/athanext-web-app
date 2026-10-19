import { Link, Outlet, useLocation } from "react-router-dom";
import { AthaNextLogo } from "@/assets";

// Sign-in and sign-up pages stand alone: no bar at all.
const AUTH_PATHS = ["/", "/auth", "/forgot-password", "/reset-password", "/signupconfirmation"];

// Signed-out visitors on public pages (coach profiles, directory, invites, legal)
// get only the logo, which leads back to sign-in. The marketing navbar and
// footer live on athanext.com now.
export const MarketingLayout = () => {
  const { pathname } = useLocation();
  const isAuthPage = AUTH_PATHS.includes(pathname);

  return (
    <>
      {!isAuthPage && (
        <header
          className="fixed w-full z-50 bg-[#F7F7F0] border-b border-[#EAEADF] h-[3.8rem] px-5 flex items-center"
          style={{ top: "var(--network-banner-height, 0px)" }}
        >
          <Link to="/" aria-label="AthaNext sign in" className="flex items-center">
            <img src={AthaNextLogo} alt="AthaNext" className="h-7 w-auto" />
          </Link>
        </header>
      )}
      <Outlet />
    </>
  );
};
