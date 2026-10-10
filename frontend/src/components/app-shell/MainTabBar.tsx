import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { isNavActive, type NavItem } from "./nav";

/** Phone bottom tab bar (ATH-75 coaches, ATH-91 athletes). */
export const MainTabBar = ({ items, badges }: { items: NavItem[]; badges?: Record<string, number> }) => {
  const location = useLocation();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[#EAEADF] bg-[#F7F7F0] px-1 pb-[calc(8px+env(safe-area-inset-bottom))] pt-1.5 md:hidden"
    >
      {items.map((item) => {
        const active = isNavActive(item, location.pathname);
        return (
          <Link
            key={item.url}
            to={item.url}
            aria-current={active ? "page" : undefined}
            aria-label={badges?.[item.url] ? `${item.short}, ${badges[item.url]} overdue` : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-[3px] py-1 text-[10px] font-medium",
              active ? "text-[#0054B4]" : "text-[#767980]"
            )}
          >
            <span className="relative">
              <item.icon className="size-5" strokeWidth={1.5} aria-hidden="true" />
              {badges?.[item.url] ? (
                <i className="absolute -right-2 -top-1.5 min-w-4 rounded-full bg-[#972B2B] px-1 text-center text-[10px] font-bold not-italic leading-4 text-white">
                  {badges[item.url]}
                </i>
              ) : null}
            </span>
            {item.short}
          </Link>
        );
      })}
    </nav>
  );
};
