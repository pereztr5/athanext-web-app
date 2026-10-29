import { useLocation, useNavigate } from "react-router-dom";

/**
 * Back that returns to the previous in-app page, or to `fallback` when the page was
 * opened directly (fresh tab, shared link). BrowserRouter keeps an `idx` in history
 * state that stays 0 on the first entry, even after a replace (e.g. a canonical slug
 * redirect); other routers fall back to the "default" location key.
 */
export const useBack = (fallback: string) => {
  const navigate = useNavigate();
  const location = useLocation();
  const idx = (window.history.state as { idx?: unknown } | null)?.idx;
  const canGoBack = typeof idx === "number" ? idx > 0 : location.key !== "default";
  const back = () => {
    if (canGoBack) navigate(-1);
    else navigate(fallback);
  };
  return { back, canGoBack };
};
