import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Header } from "@/components/common/Header";
import { Footer } from "@/components/sections/Footer";
import { AthaNextLogo } from "@/assets";
import { CLOUD_IMAGES } from "@/config/cloud-image";

export const MarketingLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleSportClick = (sport: string) => {
    navigate(`/${sport.toLowerCase()}`);
  };

  const onCompleteProfile = location.pathname === '/auth' && location.search.includes('mode=complete-profile');
  const showHeader = !onCompleteProfile;
  const completeProfileLogoUrl = CLOUD_IMAGES.completeProfileLogoUrl;
  const [completeProfileLogoSrc, setCompleteProfileLogoSrc] = useState(AthaNextLogo);
  const [logoFallbackTried, setLogoFallbackTried] = useState(false);

  return (
    <>
      {showHeader ? (
        <Header onSportClick={handleSportClick} />
      ) : (
        onCompleteProfile && (
          <header
            className="fixed w-full z-50 bg-[#F7F7F0] border-b border-[#EAEADF] h-[3.8rem] px-5 flex items-center"
            style={{ top: "var(--network-banner-height, 0px)" }}
          >
            <div className="mx-auto flex items-center gap-3">
              <img
                src={completeProfileLogoSrc}
                alt="AthaNext"
                className="h-7 w-auto"
                onError={() => {
                  if (logoFallbackTried) return;
                  setLogoFallbackTried(true);
                  setCompleteProfileLogoSrc(completeProfileLogoUrl);
                }}
              />
            </div>
          </header>
        )
      )}
      <Outlet />
      <Footer onSportClick={handleSportClick} />
    </>
  );
};
