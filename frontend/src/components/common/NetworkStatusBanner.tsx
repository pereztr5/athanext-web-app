import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export const NetworkStatusBanner = () => {
  const { isOnline, isSlowConnection } = useNetworkStatus();
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const isBannerVisible = !isOnline || isSlowConnection;
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 640px)").matches : false
  );

  useLayoutEffect(() => {
    if (!isBannerVisible) {
      document.documentElement.style.setProperty("--network-banner-height", "0px");
      return;
    }

    const el = bannerRef.current;
    if (!el) return;

    const updateHeight = () => {
      document.documentElement.style.setProperty("--network-banner-height", `${el.offsetHeight}px`);
    };

    updateHeight();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateHeight);
      observer.observe(el);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [isBannerVisible]);

  useEffect(() => {
    if (!isBannerVisible) {
      document.documentElement.style.setProperty("--network-banner-height", "0px");
    }
  }, [isBannerVisible]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(max-width: 640px)");
    const onChange = () => setIsCompact(media.matches);
    onChange();
    if (media.addEventListener) {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  if (!isOnline) {
    return (
      <div
        ref={bannerRef}
        className="fixed top-0 left-0 right-0 z-[60] w-full border-b border-[#EAEADF] bg-[#FDF7EC] text-[#906A29]"
      >
        <div className="max-w-8xl mx-auto flex items-center gap-2 px-4 py-2 text-[14px] font-medium leading-[18px] tracking-[-0.03em]">
          <WifiOff strokeWidth={1.5} className="h-4 w-4 flex-none" />
          <span>
            {isCompact
              ? "Offline, reconnecting…"
              : "You’re offline. We’ll reconnect when your network is back."}
          </span>
        </div>
      </div>
    );
  }

  if (isSlowConnection) {
    return (
      <div
        ref={bannerRef}
        className="fixed top-0 left-0 right-0 z-[60] w-full border-b border-[#EAEADF] bg-[#F4F4EB] text-[#484D56]"
      >
        <div className="max-w-8xl mx-auto flex items-center gap-2 px-4 py-2 text-[14px] font-medium leading-[18px] tracking-[-0.03em]">
          <Wifi strokeWidth={1.5} className="h-4 w-4 flex-none text-[#767980]" />
          <span>
            {isCompact
              ? "Slow connection, loading…"
              : "Your connection seems slow. Loading may take longer."}
          </span>
        </div>
      </div>
    );
  }

  return null;
};
