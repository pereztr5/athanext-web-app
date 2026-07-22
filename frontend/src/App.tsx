import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import ScrollToTop from "@/components/common/ScrollToTop";
import { NetworkStatusBanner } from "@/components/common/NetworkStatusBanner";
import { PUBLIC_ROUTES, AUTH_FLOW_ROUTES, APP_ROUTES, DUAL_CHROME_ROUTES, NOT_FOUND_ROUTE } from "@/routes";
import { MarketingLayout } from "@/layouts/MarketingLayout";
import { AppLayout } from "@/layouts/AppLayout";
import { ChromeSwitch } from "@/layouts/ChromeSwitch";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProfileProvider } from "@/contexts/ProfileContext";

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

  useEffect(() => {
    const hasRecoveryFlag =
      location.hash.includes("type=recovery") ||
      location.search.includes("type=recovery");

    if (hasRecoveryFlag && location.pathname !== "/reset-password") {
      navigate(`/reset-password${location.search}${location.hash}`, { replace: true });
    }
  }, [location, navigate]);

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
      <Routes>
        <Route element={<MarketingLayout />}>
          {[...PUBLIC_ROUTES, ...AUTH_FLOW_ROUTES].map(({ path, element }) => (
            <Route key={path} path={path} element={element} />
          ))}
          <Route path={NOT_FOUND_ROUTE.path} element={NOT_FOUND_ROUTE.element} />
        </Route>
        <Route element={<ChromeSwitch />}>
          {DUAL_CHROME_ROUTES.map(({ path, element }) => (
            <Route key={path} path={path} element={element} />
          ))}
        </Route>
        <Route element={<AppLayout />}>
          {APP_ROUTES.map(({ path, element }) => (
            <Route key={path} path={path} element={element} />
          ))}
        </Route>
      </Routes>
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
