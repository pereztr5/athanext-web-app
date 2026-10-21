import { useRole } from "@/hooks/useRole";

// Privacy Policy and Terms render in both chromes. Visitors get the marketing
// gradient (the marketing layout pads for its fixed header); signed-in users sit under the
// app shell's in-flow top bar, so no offset is needed. Uses the same check as
// ChromeSwitch so the padding always matches the chrome on screen.
export function usePolicyPageClass() {
  const { isAuthenticated, ready } = useRole();
  return ready && isAuthenticated
    ? "min-h-screen px-4 pb-12 pt-6 md:px-10"
    : "min-h-screen pt-5 pb-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-background to-primary/5";
}
