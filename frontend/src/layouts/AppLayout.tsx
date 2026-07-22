import { Outlet, useNavigate } from "react-router-dom";
import { Header } from "@/components/common/Header";
import { Footer } from "@/components/sections/Footer";

// v1: identical chrome to MarketingLayout so the shell split lands with zero
// visual change. PR 8 replaces the internals with the sidebar shell.
// App routes never render /auth?mode=complete-profile, so no mini-header here.
export const AppLayout = () => {
  const navigate = useNavigate();

  const handleSportClick = (sport: string) => {
    navigate(`/${sport.toLowerCase()}`);
  };

  return (
    <>
      <Header onSportClick={handleSportClick} />
      <Outlet />
      <Footer onSportClick={handleSportClick} />
    </>
  );
};
