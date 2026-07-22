import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Header } from "@/components/common/Header";
import { Footer } from "@/components/sections/Footer";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import ScrollToTop from "@/components/common/ScrollToTop";
import { NetworkStatusBanner } from "@/components/common/NetworkStatusBanner";
import { ALL_ROUTES, NOT_FOUND_ROUTE } from "@/routes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { AthaNextLogo } from "@/assets";
import { CLOUD_IMAGES } from "@/config/cloud-image";

import "./App.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, 
      staleTime: 5 * 60 * 1000, 
    },
  },
});

const AppContent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile, isProfileComplete, loading, initialCheckComplete, profileReady } = useAuth();
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);

  const isRecoveryFlow =
    location.pathname === "/reset-password" ||
    location.hash.includes("type=recovery") ||
    location.search.includes("type=recovery");

  useEffect(() => {
    const hasRecoveryFlag =
      location.hash.includes("type=recovery") ||
      location.search.includes("type=recovery");

    if (hasRecoveryFlag && location.pathname !== "/reset-password") {
      navigate(`/reset-password${location.search}${location.hash}`, { replace: true });
    }
  }, [location, navigate]);

  // Use isProfileComplete from AuthContext - wait for initial auth check to complete
  useEffect(() => {
    if (!user) {
      setNeedsProfileCompletion(false);
      return;
    }

    if (!initialCheckComplete || !profileReady) return;

    const isComplete = userProfile?.is_profile_completed === true;
    setNeedsProfileCompletion(!isComplete);
  }, [user, userProfile, initialCheckComplete, profileReady]);

  useEffect(() => {
    if (!user) return;
    if (!initialCheckComplete || !profileReady) return; // Wait for auth/profile to initialize
    if (isRecoveryFlow) return;
    const isComplete = userProfile?.is_profile_completed === true;
    if (isComplete) {
      if (location.pathname === "/auth" && location.search.includes("mode=complete-profile")) {
        navigate("/", { replace: true });
      }
      return; // Already complete
    }
    if (!needsProfileCompletion) return;
    if (location.pathname === "/auth") return;

    navigate("/auth?mode=complete-profile", { replace: true });
  }, [needsProfileCompletion, location.pathname, navigate, user, initialCheckComplete, profileReady, userProfile, isRecoveryFlow]);
  
  const handleSportClick = (sport: string) => {
    navigate(`/${sport.toLowerCase()}`);
  };

  const onCompleteProfile = location.pathname === '/auth' && location.search.includes('mode=complete-profile');
  const showHeader = !onCompleteProfile;
  const completeProfileLogoUrl = CLOUD_IMAGES.completeProfileLogoUrl;
  const [completeProfileLogoSrc, setCompleteProfileLogoSrc] = useState(AthaNextLogo);
  const [logoFallbackTried, setLogoFallbackTried] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateViewportVars = () => {
      const vv = window.visualViewport;
      const height = vv?.height ?? window.innerHeight;
      const offsetTop = vv?.offsetTop ?? 0;
      document.documentElement.style.setProperty("--vvh", `${height}px`);
      document.documentElement.style.setProperty("--vv-top", `${offsetTop}px`);
    };

    updateViewportVars();
    window.visualViewport?.addEventListener("resize", updateViewportVars);
    window.visualViewport?.addEventListener("scroll", updateViewportVars);
    window.addEventListener("resize", updateViewportVars);

    return () => {
      window.visualViewport?.removeEventListener("resize", updateViewportVars);
      window.visualViewport?.removeEventListener("scroll", updateViewportVars);
      window.removeEventListener("resize", updateViewportVars);
    };
  }, []);

  return (
    <ErrorBoundary>
      <ScrollToTop />
      <NetworkStatusBanner />
      {showHeader ? (
        <Header onSportClick={handleSportClick} />
      ) : (
        onCompleteProfile && (
          <header
            className="fixed w-full z-50 bg-white border-b border-border h-[3.8rem] px-4 flex items-center"
            style={{ top: "var(--network-banner-height, 0px)" }}
          >
            <div className="mx-auto flex items-center gap-3">
              <img
                src={completeProfileLogoSrc}
                alt="AthaNext"
                className="h-8 w-auto"
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
      <Routes>
        {ALL_ROUTES.map(({ path, element }) => (
          <Route key={path} path={path} element={element} />
        ))}
        <Route path={NOT_FOUND_ROUTE.path} element={NOT_FOUND_ROUTE.element} />
      </Routes>
      <Footer onSportClick={handleSportClick} />
    </ErrorBoundary>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ProfileProvider>
            <AppContent />
          </ProfileProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
