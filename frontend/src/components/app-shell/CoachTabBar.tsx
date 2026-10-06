import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { COACH_NAV } from "./coachNav";

/** Phone bottom tab bar for coaches (ATH-75): Home, Sessions, Athletes, Schedule, Profile. */
export const CoachTabBar = () => {
  const location = useLocation();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[#EAEADF] bg-[#F7F7F0]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {COACH_NAV.map((item) => {
        const active =
          location.pathname === item.url || (item.url !== ROUTES.DASHBOARD && location.pathname.startsWith(item.url));
        return (
          <Link
            key={item.url}
            to={item.url}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium",
              active ? "text-[#0054B4]" : "text-[#767980]"
            )}
          >
            <item.icon className="size-5" strokeWidth={1.5} aria-hidden="true" />
            {item.short}
          </Link>
        );
      })}
    </nav>
  );
};
