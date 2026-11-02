/**
 * Boots PostHog behind cookie consent, records SPA pageviews, and identifies the signed-in
 * account by id only.
 */
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { bindPostHogConsent, capturePageview, identifyUser, resetUser } from "./posthog";

export const PostHogApp = () => {
  const location = useLocation();
  const { user } = useAuth();
  const lastPath = useRef<string | null>(null);
  const wasIdentified = useRef(false);

  useEffect(() => bindPostHogConsent(), []);

  useEffect(() => {
    const path = `${location.pathname}${location.search}`;
    if (lastPath.current === path) return;
    lastPath.current = path;
    capturePageview(path);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (user?.id) {
      identifyUser(user.id);
      wasIdentified.current = true;
    } else if (wasIdentified.current) {
      // Only reset after a real sign-out, so the website→app anonymous id stays.
      resetUser();
      wasIdentified.current = false;
    }
  }, [user?.id]);

  return null;
};
