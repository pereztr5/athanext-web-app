import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
  const { pathname } = useLocation();
  const prevPathname = useRef(pathname);
  const scrollPositions = useRef<Record<string, number>>({});

  useEffect(() => {
    // Save current scroll position before pathname changes
    if (prevPathname.current !== pathname) {
      scrollPositions.current[prevPathname.current] = window.scrollY;
      
      // For new navigation, scroll to top
      window.scrollTo(0, 0);
      prevPathname.current = pathname;
    }
  }, [pathname]);

  // Save scroll position on scroll and before unload
  useEffect(() => {
    const handleScroll = () => {
      scrollPositions.current[pathname] = window.scrollY;
    };

    const handleBeforeUnload = () => {
      // Browser's native scroll restoration will handle this on refresh
      // We just need to not interfere
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [pathname]);

  return null;
};

export default ScrollToTop;
