import { useRole } from "@/hooks/useRole";
import { AppLayout } from "./AppLayout";
import { MarketingLayout } from "./MarketingLayout";

// Dual-chrome routes (/coaches, /coach/:id): app shell for signed-in users,
// marketing chrome for visitors. While auth is still resolving, marketing
// chrome, which is today's behavior for signed-in users on these pages.
export const ChromeSwitch = () => {
  const { isAuthenticated, ready } = useRole();
  return ready && isAuthenticated ? <AppLayout /> : <MarketingLayout />;
};
